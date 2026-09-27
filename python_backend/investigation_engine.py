"""Evidence-fusion query engine with automatic Gemini -> OpenRouter -> Ollama fallback."""
from __future__ import annotations
import json, os, time
from typing import Any
import requests
from .db import get_db
from .rag_engine import search as rag_search
from .ml_link_prediction import build_case_graph, rank_candidates


def build_package(case_id: int, question: str, rag_limit=8):
    conn = get_db()
    case = conn.execute('SELECT * FROM cases WHERE id=?', (case_id,)).fetchone()
    if not case:
        conn.close()
        raise ValueError('Case not found')
    entities = [dict(r) for r in conn.execute("SELECT id,label,entity_type,verification_status,confidence_score FROM entities WHERE case_id=? ORDER BY id DESC LIMIT 500", (case_id,)).fetchall()]
    rels = [dict(r) for r in conn.execute("SELECT id,source_entity_id,target_entity_id,relationship_type,verification_status,confidence_score,source_document_id,evidence_sentence FROM relationships WHERE case_id=? ORDER BY id DESC LIMIT 1000", (case_id,)).fetchall()]
    locs = [dict(r) for r in conn.execute("SELECT id,label,latitude,longitude,location_type,verification_status,event_timestamp,primary_evidence_id FROM locations WHERE case_id=? ORDER BY id DESC LIMIT 500", (case_id,)).fetchall()]
    events = [dict(r) for r in conn.execute("SELECT id,event_type,event_time,description,verification_status,evidence_id FROM timeline_events WHERE case_id=? ORDER BY event_time DESC LIMIT 500", (case_id,)).fetchall()]
    evidence = [dict(r) for r in conn.execute("SELECT id,filename,file_type,processing_status,sha256,uploaded_at FROM documents WHERE case_id=? ORDER BY id DESC LIMIT 200", (case_id,)).fetchall()]
    pending = [dict(r) for r in conn.execute("SELECT id,suggestion_type,title,confidence_score,status,evidence_id,source_document FROM review_items WHERE case_id=? AND status='PENDING' ORDER BY id DESC LIMIT 200", (case_id,)).fetchall()]
    face_matches = [dict(r) for r in conn.execute("SELECT id,evidence_id,face_profile_id,candidate_entity_id,similarity,model_name,status,source_reference FROM face_matches WHERE case_id=? ORDER BY similarity DESC LIMIT 100", (case_id,)).fetchall()]
    conn.close()
    rag = rag_search(case_id, question, rag_limit)
    verified_entities = [e for e in entities if str(e.get('verification_status', '')).lower() == 'verified']
    verified_rels = [r for r in rels if str(r.get('verification_status', '')).lower() == 'verified']

    # Query-aware structured retrieval keeps the LLM context focused while preserving
    # the complete case in the authoritative database. RAG remains documentary
    # retrieval; this block supplies verified graph/GIS/timeline context separately.
    ql = question.lower()
    matched_entity_ids = {int(e['id']) for e in verified_entities if str(e.get('label') or '').lower() in ql}
    matched_entity_ids.update(int(e['id']) for e in verified_entities if any(tok and tok in ql for tok in str(e.get('label') or '').lower().split() if len(tok) >= 4))
    matched_location_ids = {int(l['id']) for l in locs if str(l.get('label') or '').lower() in ql or any(tok and tok in ql for tok in str(l.get('label') or '').lower().split() if len(tok) >= 4)}

    if matched_entity_ids:
        focused_rels = [r for r in verified_rels if int(r.get('source_entity_id') or -1) in matched_entity_ids or int(r.get('target_entity_id') or -1) in matched_entity_ids]
        related_ids = set(matched_entity_ids)
        for r in focused_rels:
            related_ids.add(int(r.get('source_entity_id') or -1)); related_ids.add(int(r.get('target_entity_id') or -1))
        focused_entities = [e for e in verified_entities if int(e['id']) in related_ids][:120]
        focused_rels = focused_rels[:250]
    else:
        focused_entities = verified_entities[:80]
        focused_rels = verified_rels[:120]

    focused_locs = [l for l in locs if int(l['id']) in matched_location_ids] if matched_location_ids else locs[:80]
    focused_events = [e for e in events if (not matched_entity_ids or int(e.get('entity_id') or -1) in matched_entity_ids) or (matched_location_ids and int(e.get('location_id') or -1) in matched_location_ids)][:120]

    try:
        ml = rank_candidates(build_case_graph(verified_entities, verified_rels), limit=10, threshold=0.20) if len(verified_entities) >= 2 else []
    except Exception:
        ml = []
    return {
        'case': dict(case), 'entities': focused_entities, 'relationships': focused_rels, 'locations': focused_locs,
        'timeline': focused_events, 'evidence': evidence, 'pending_review': pending,
        'rag': rag, 'rag_retrieval': {'count': len(rag), 'top_score': max((float(x.get('score', 0)) for x in rag), default=0.0), 'case_isolated': True}, 'face_matches': face_matches, 'ml_findings': ml,
        'provenance_policy': 'Verified records are facts; pending review, face matches and model findings are candidates/model findings only.'
    }


SYSTEM_PROMPT = (
    'You are CIPHER investigation assistant. Use ONLY the supplied case-isolated evidence package. '
    'Never invent facts, identities, locations, dates, relationships, or sources. '
    'VERIFIED records are factual case records. PENDING review records, face matches and ML findings are candidates/model findings only. '
    'Clearly label inference and uncertainty. If the supplied evidence does not answer the question, say that the evidence is insufficient. '
    'Return strict JSON with keys: answer, evidence, inferences, uncertainties, sources. '
    'Each source should identify the evidence filename/page/chunk when available.'
)


def _parse_json_text(text: str) -> dict:
    text = str(text or '').strip()
    if text.startswith('```'):
        lines = text.splitlines()
        if lines and lines[0].startswith('```'):
            lines = lines[1:]
        if lines and lines[-1].strip() == '```':
            lines = lines[:-1]
        text = '\n'.join(lines).strip()
    try:
        value = json.loads(text)
    except Exception as exc:
        start, end = text.find('{'), text.rfind('}')
        if start >= 0 and end > start:
            try:
                value = json.loads(text[start:end + 1])
            except Exception:
                raise ValueError(f'LLM returned invalid JSON: {text[:500]}') from exc
        else:
            raise ValueError(f'LLM returned invalid JSON: {text[:500]}') from exc
    if not isinstance(value, dict):
        raise ValueError('LLM returned a non-object JSON response')
    return value


def _validate_llm_payload(payload: dict, package: dict, provider: str, model: str) -> dict:
    answer_text = str(payload.get('answer') or payload.get('text') or '').strip()
    if not answer_text:
        raise ValueError(f'{provider} returned an empty answer')
    payload.setdefault('evidence', payload.get('document_evidence', []))
    payload.setdefault('inferences', [])
    payload.setdefault('uncertainties', [])
    # RAG sources are authoritative retrieval references. If the model omitted
    # sources or invented a source list, preserve the actual retrieved sources.
    retrieved = package.get('rag', [])
    model_sources = payload.get('sources')
    if not isinstance(model_sources, list) or not model_sources:
        payload['sources'] = retrieved
    else:
        valid_refs = {str(x.get('source_reference') or x.get('reference') or '') for x in retrieved}
        filtered = [x for x in model_sources if isinstance(x, dict) and str(x.get('reference') or x.get('source_reference') or '') in valid_refs]
        payload['sources'] = filtered or retrieved
    payload['retrieval'] = package.get('rag_retrieval', {})
    payload['provider'] = provider
    payload['model'] = model
    return payload


def _llm_package(package: dict) -> dict:
    # Keep requests small for free API limits while preserving only trusted records.
    out = dict(package)
    out['rag'] = package.get('rag', [])[:8]
    out['entities'] = [e for e in package.get('entities', []) if str(e.get('verification_status', '')).lower() == 'verified'][:120]
    out['relationships'] = [r for r in package.get('relationships', []) if str(r.get('verification_status', '')).lower() == 'verified'][:250]
    out['locations'] = [l for l in package.get('locations', []) if str(l.get('verification_status', '')).lower() == 'verified'][:120]
    out['timeline'] = [e for e in package.get('timeline', []) if str(e.get('verification_status', '')).lower() == 'verified'][:120]
    # Do not send raw pending review or face-candidate records as trusted facts.
    out['pending_review'] = package.get('pending_review', [])[:100]
    out['face_matches'] = package.get('face_matches', [])[:50]
    out['ml_findings'] = package.get('ml_findings', [])[:20]
    return out


def _prompt(package: dict, question: str) -> str:
    data = json.dumps(_llm_package(package), default=str, ensure_ascii=False)
    rules = (
        '\nRAG RULES: Use retrieved evidence as the primary documentary context. ' \
        'Cite only source references present in the supplied package. ' \
        'Do not convert a candidate face match, pending review item, or ML prediction into a verified fact. ' \
        'If retrieved evidence is insufficient, explicitly say so.\n'
    )
    return f'Question: {question}{rules}Evidence package (case-isolated):\n{data[:40000]}'


def _gemini_models() -> list[str]:
    primary = (os.getenv('GEMINI_MODEL', 'gemini-3.1-flash-lite') or 'gemini-3.1-flash-lite').strip()
    fallback = [x.strip() for x in os.getenv('GEMINI_MODEL_FALLBACKS', '').split(',') if x.strip()]
    result = []
    for model in [primary] + fallback:
        if model and model not in result:
            result.append(model)
    return result


def gemini_llm(package: dict, question: str) -> tuple[dict, str]:
    api_key = os.getenv('GEMINI_API_KEY', '').strip()
    if not api_key:
        raise RuntimeError('GEMINI_API_KEY not configured')
    prompt = _prompt(package, question)
    timeout = float(os.getenv('GEMINI_TIMEOUT', '30'))
    last = None
    for model in _gemini_models():
        try:
            base_url = os.getenv('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com').rstrip('/')
            url = f'{base_url}/v1beta/models/{model}:generateContent?key={api_key}'
            payload = {
                'system_instruction': {'parts': [{'text': SYSTEM_PROMPT}]},
                'contents': [{'parts': [{'text': prompt}]}],
                'generationConfig': {
                    'temperature': 0.1,
                    'responseMimeType': 'application/json',
                    'maxOutputTokens': int(os.getenv('GEMINI_MAX_OUTPUT_TOKENS', '700')),
                },
            }
            response = requests.post(url, json=payload, timeout=timeout)
            if response.status_code in (404, 429, 500, 502, 503, 504):
                last = RuntimeError(f'Gemini {model} HTTP {response.status_code}: {response.text[:250]}')
                continue
            response.raise_for_status()
            body = response.json()
            parts = body.get('candidates', [{}])[0].get('content', {}).get('parts', [])
            text = ''.join(str(p.get('text', '')) for p in parts if isinstance(p, dict))
            result = _parse_json_text(text)
            return _validate_llm_payload(result, package, 'gemini', model), model
        except Exception as exc:
            last = exc
    raise last or RuntimeError('Gemini request failed')


def openrouter_llm(package: dict, question: str) -> tuple[dict, str]:
    api_key = os.getenv('OPENROUTER_API_KEY', '').strip()
    if not api_key:
        raise RuntimeError('OPENROUTER_API_KEY not configured')
    model = (os.getenv('OPENROUTER_MODEL', 'openrouter/free') or 'openrouter/free').strip()
    models = [x.strip() for x in os.getenv('OPENROUTER_FALLBACK_MODELS', '').split(',') if x.strip()]
    prompt = _prompt(package, question)
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': prompt},
        ],
        'temperature': 0.1,
        'max_tokens': int(os.getenv('OPENROUTER_MAX_TOKENS', '700')),
        'response_format': {'type': 'json_object'},
    }
    if models:
        payload['models'] = models[:3]
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': os.getenv('OPENROUTER_HTTP_REFERER', 'http://127.0.0.1:8000'),
        'X-Title': os.getenv('OPENROUTER_APP_NAME', 'CIPHER Investigation Platform'),
    }
    response = requests.post(
        os.getenv('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1').rstrip('/') + '/chat/completions',
        json=payload, headers=headers, timeout=float(os.getenv('OPENROUTER_TIMEOUT', '30')),
    )
    if response.status_code >= 400:
        raise RuntimeError(f'OpenRouter HTTP {response.status_code}: {response.text[:300]}')
    body = response.json()
    choices = body.get('choices') or []
    if not choices:
        raise RuntimeError('OpenRouter returned no choices')
    message = choices[0].get('message') or {}
    text = message.get('content') or ''
    if isinstance(text, list):
        text = ''.join(str(x.get('text', '')) for x in text if isinstance(x, dict))
    result = _parse_json_text(text)
    used_model = str(body.get('model') or model)
    return _validate_llm_payload(result, package, 'openrouter', used_model), used_model


def ollama_llm(package: dict, question: str) -> tuple[dict, str]:
    base = os.getenv('OLLAMA_BASE_URL', 'http://127.0.0.1:11434').rstrip('/')
    model = os.getenv('OLLAMA_MODEL', 'qwen3:8b')
    prompt = _prompt(package, question)
    think = os.getenv('OLLAMA_THINK', 'false').strip().lower() in {'1', 'true', 'yes', 'on'}
    try:
        num_predict = max(128, min(int(os.getenv('OLLAMA_NUM_PREDICT', '600')), 2000))
    except ValueError:
        num_predict = 600
    response = requests.post(
        f'{base}/api/chat',
        json={
            'model': model,
            'messages': [{'role': 'system', 'content': SYSTEM_PROMPT}, {'role': 'user', 'content': prompt}],
            'stream': False, 'format': 'json', 'think': think,
            'options': {'temperature': 0.1, 'num_predict': num_predict},
        },
        timeout=float(os.getenv('OLLAMA_TIMEOUT', '180')),
    )
    response.raise_for_status()
    body = response.json()
    content = body.get('message', {}).get('content', '')
    result = _parse_json_text(content)
    return _validate_llm_payload(result, package, 'ollama', model), model


def _provider_order() -> list[str]:
    raw = os.getenv('LLM_FALLBACK_ORDER', 'gemini,openrouter,ollama')
    allowed = {'gemini', 'openrouter', 'ollama'}
    result = []
    for item in raw.split(','):
        p = item.strip().lower()
        if p in allowed and p not in result:
            result.append(p)
    return result or ['gemini', 'openrouter', 'ollama']


def _enabled(provider: str) -> bool:
    defaults = {'gemini': True, 'openrouter': True, 'ollama': True}
    key = {'gemini': 'GEMINI_ENABLED', 'openrouter': 'OPENROUTER_ENABLED', 'ollama': 'OLLAMA_ENABLED'}[provider]
    return os.getenv(key, 'true' if defaults[provider] else 'false').strip().lower() in {'1', 'true', 'yes', 'on'}


def _provider_call(provider: str, package: dict, question: str):
    if provider == 'gemini':
        return gemini_llm(package, question)
    if provider == 'openrouter':
        return openrouter_llm(package, question)
    return ollama_llm(package, question)


def answer(case_id: int, question: str):
    package = build_package(case_id, question)
    attempts = []
    started = time.perf_counter()
    preferred = os.getenv('LLM_PROVIDER', 'auto').strip().lower()
    order = _provider_order()
    if preferred in {'gemini', 'openrouter', 'ollama'}:
        order = [preferred] + [p for p in order if p != preferred]

    for provider in order:
        if not _enabled(provider):
            attempts.append({'provider': provider, 'status': 'disabled'})
            continue
        if provider == 'gemini' and not os.getenv('GEMINI_API_KEY', '').strip():
            attempts.append({'provider': provider, 'status': 'not_configured'})
            continue
        if provider == 'openrouter' and not os.getenv('OPENROUTER_API_KEY', '').strip():
            attempts.append({'provider': provider, 'status': 'not_configured'})
            continue
        try:
            generated, model = _provider_call(provider, package, question)
            elapsed = round((time.perf_counter() - started) * 1000, 1)
            package['llm_status'] = {
                'provider': provider, 'model': model, 'connected': True,
                'fallback_order': order, 'attempts': attempts + [{'provider': provider, 'status': 'success'}],
                'latency_ms': elapsed,
            }
            generated['llm_status'] = package['llm_status']
            return generated, package
        except Exception as exc:
            attempts.append({'provider': provider, 'status': 'failed', 'error': f'{type(exc).__name__}: {str(exc)[:500]}'})

    elapsed = round((time.perf_counter() - started) * 1000, 1)
    package['llm_status'] = {'provider': 'unavailable', 'connected': False, 'fallback_order': order, 'attempts': attempts, 'latency_ms': elapsed}
    return {
        'answer': 'No configured CIPHER LLM provider is currently available. Configure Gemini or OpenRouter for cloud inference, or start Ollama for local fallback.',
        'provider': 'llm-unavailable', 'sources': package['rag'], 'inferences': [],
        'uncertainties': [a.get('error', a.get('status', 'unavailable')) for a in attempts],
        'answer_type': 'unavailable', 'llm_status': package['llm_status'],
    }, package
