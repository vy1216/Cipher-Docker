"""CIPHER case-isolated evidence RAG engine.

Design goals:
- keep the existing public functions compatible with the rest of CIPHER;
- index PDF/TXT/CSV/DOCX text and optionally OCR image evidence;
- keep every vector/chunk strictly case-scoped;
- use SentenceTransformers + FAISS when available;
- gracefully fall back to deterministic TF-IDF + lexical retrieval;
- combine semantic, lexical and identifier/entity signals;
- return provenance-rich sources suitable for the existing CIPHER UI;
- never make RAG the source of truth for verified graph/face facts.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
import re
import uuid
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

from .db import get_db

BASE_DIR = Path(__file__).resolve().parent.parent
RAG_DIR = Path(os.getenv("CIPHER_RAG_DIR", str(BASE_DIR / "data" / "rag")))
RAG_DIR.mkdir(parents=True, exist_ok=True)

SUPPORTED_TEXT_EXTS = {".txt", ".csv", ".pdf", ".docx"}
SUPPORTED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}


def _uid(prefix: str = "RAG") -> str:
    return f"{prefix}-{uuid.uuid4().hex}"


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        v = float(value)
        return v if math.isfinite(v) else default
    except Exception:
        return default


def _resolve_source_path(path: str, filename: str) -> Path:
    candidate = Path(path) if path else Path("")
    if candidate.exists() and candidate.is_file():
        return candidate

    candidates = [
        BASE_DIR / "uploads" / Path(filename).name,
        BASE_DIR / "uploads" / Path(path).name,
        BASE_DIR / Path(filename).name,
        BASE_DIR / Path(path).name,
    ]
    for c in candidates:
        if c.exists() and c.is_file():
            return c

    wanted = Path(filename).name.lower()
    for root in (BASE_DIR / "uploads", BASE_DIR):
        if not root.exists():
            continue
        try:
            for c in root.rglob("*"):
                if c.is_file() and (c.name.lower() == wanted or c.name.lower().endswith(wanted)):
                    return c
        except OSError:
            pass
    raise FileNotFoundError(f"Evidence file not found: {path} (filename={filename})")


def _download_bytes(path: str, filename: str) -> bytes:
    if str(path).startswith("supabase://"):
        from .storage import download_uri
        return download_uri(str(path))
    return _resolve_source_path(path, filename).read_bytes()


def _csv_to_text(raw: bytes, filename: str) -> str:
    text = raw.decode("utf-8-sig", errors="replace")
    try:
        rows = list(csv.DictReader(io.StringIO(text)))
    except Exception:
        rows = []
    if not rows:
        return text

    lines = [f"Source file: {filename}"]
    for n, row in enumerate(rows, 1):
        parts = []
        for key, value in row.items():
            if value is not None and str(value).strip():
                parts.append(f"{str(key).strip()}: {str(value).strip()}")
        if parts:
            lines.append(f"Row {n}: " + "; ".join(parts))
    return "\n".join(lines)


def _read_pages(path: str, filename: str) -> list[tuple[int, str]]:
    raw = _download_bytes(path, filename)
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        import fitz
        pdf = fitz.open(stream=raw, filetype="pdf")
        try:
            pages = [(i + 1, page.get_text("text")) for i, page in enumerate(pdf)]
        finally:
            pdf.close()
        return pages

    if ext == ".docx":
        from docx import Document
        doc = Document(io.BytesIO(raw))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        # Tables are converted into readable evidence records instead of being lost.
        for table in doc.tables:
            for row in table.rows:
                values = [cell.text.strip() for cell in row.cells]
                if any(values):
                    paragraphs.append(" | ".join(values))
        return [(1, "\n".join(paragraphs))]

    if ext == ".csv":
        return [(1, _csv_to_text(raw, filename))]

    return [(1, raw.decode("utf-8-sig", errors="replace"))]


def _ocr_image(path: str, filename: str) -> tuple[str, str]:
    """Best-effort OCR. Never raises for missing OCR runtime.

    OCR is deliberately separate from face recognition. A face image remains
    usable by InsightFace even when Tesseract is unavailable.
    """
    if os.getenv("CIPHER_RAG_IMAGE_OCR", "true").strip().lower() not in {"1", "true", "yes", "on"}:
        return "", "OCR_DISABLED"
    try:
        import pytesseract
        from PIL import Image
        raw = _download_bytes(path, filename)
        image = Image.open(io.BytesIO(raw))
        text = pytesseract.image_to_string(image).strip()
        if not text:
            return "", "OCR_EMPTY"
        return text, "TESSERACT_OCR"
    except Exception as exc:
        return "", f"OCR_UNAVAILABLE:{type(exc).__name__}"


def _normalize_text(text: str) -> str:
    text = (text or "").replace("\x00", " ")
    text = re.sub(r"\r\n?", "\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _chunks(text: str, size: int | None = None, overlap: int | None = None) -> list[str]:
    """Paragraph-aware, bounded word chunks with overlap."""
    text = _normalize_text(text)
    if not text:
        return []
    size = int(size or os.getenv("CIPHER_RAG_CHUNK_WORDS", "260"))
    overlap = int(overlap or os.getenv("CIPHER_RAG_CHUNK_OVERLAP_WORDS", "45"))
    size = max(80, min(size, 1200))
    overlap = max(0, min(overlap, size // 2))

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    units: list[str] = []
    for paragraph in paragraphs:
        words = paragraph.split()
        if len(words) <= size:
            units.append(paragraph)
            continue
        start = 0
        while start < len(words):
            end = min(len(words), start + size)
            units.append(" ".join(words[start:end]))
            if end >= len(words):
                break
            start = max(start + 1, end - overlap)

    # Merge tiny adjacent paragraphs without exceeding the chunk budget.
    merged: list[str] = []
    for unit in units:
        if merged and len(merged[-1].split()) < max(40, size // 4) and len((merged[-1] + " " + unit).split()) <= size:
            merged[-1] = merged[-1] + " " + unit
        else:
            merged.append(unit)
    return merged


@lru_cache(maxsize=2)
def _embedder():
    """
    Select the RAG embedding provider.

    CIPHER_RAG_EMBEDDING_PROVIDER:
      - auto: try SentenceTransformer, then fall back to TF-IDF
      - sentence-transformers: use SentenceTransformer only
      - tfidf: use lightweight local TF-IDF

    Render Free should use TF-IDF because the instance has a 512 MB
    memory limit. Local/high-memory environments can continue using
    SentenceTransformer.
    """
    provider_mode = (
        os.getenv("CIPHER_RAG_EMBEDDING_PROVIDER", "auto")
        .strip()
        .lower()
    )

    model_name = (
        os.getenv("CIPHER_EMBEDDING_MODEL", "all-MiniLM-L6-v2").strip()
        or "all-MiniLM-L6-v2"
    )

    if provider_mode in {"tfidf", "tf-idf", "local-tfidf"}:
        from sklearn.feature_extraction.text import TfidfVectorizer

        return (
            "tfidf",
            "tfidf-local",
            TfidfVectorizer(
                lowercase=True,
                ngram_range=(1, 2),
                max_features=8192,
                norm="l2",
            ),
        )

    try:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer(model_name)

        return "sentence-transformers", model_name, model

    except Exception:
        from sklearn.feature_extraction.text import TfidfVectorizer

        return (
            "tfidf",
            "tfidf-local",
            TfidfVectorizer(
                lowercase=True,
                ngram_range=(1, 2),
                max_features=8192,
                norm="l2",
            ),
        )


def _embed_texts(texts: list[str]) -> tuple[str, str, np.ndarray]:
    provider, model_name, model = _embedder()
    if not texts:
        return provider, model_name, np.empty((0, 0), dtype=np.float32)
    if provider == "sentence-transformers":
        vectors = np.asarray(model.encode(texts, normalize_embeddings=True, show_progress_bar=False), dtype=np.float32)
        if vectors.ndim == 1:
            vectors = vectors.reshape(1, -1)
        return provider, model_name, vectors
    vectors = model.fit_transform(texts).toarray().astype(np.float32)
    return provider, model_name, vectors


def _embed_query(query: str, provider: str) -> np.ndarray | None:
    if provider == "sentence-transformers":
        p, _, model = _embedder()
        if p != "sentence-transformers":
            return None
        return np.asarray(model.encode([query], normalize_embeddings=True, show_progress_bar=False)[0], dtype=np.float32)
    return None


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9_+./:-]{2,}", str(text or "").lower())


def _bm25_scores(query: str, texts: list[str]) -> list[float]:
    """Small dependency-free BM25 implementation for case-local reranking."""
    q = _tokens(query)
    if not q or not texts:
        return [0.0] * len(texts)
    docs = [_tokens(t) for t in texts]
    avgdl = sum(len(d) for d in docs) / max(1, len(docs))
    df: dict[str, int] = {}
    for d in docs:
        for term in set(d):
            df[term] = df.get(term, 0) + 1
    n = len(docs)
    k1, b = 1.5, 0.75
    scores = []
    for d in docs:
        counts: dict[str, int] = {}
        for term in d:
            counts[term] = counts.get(term, 0) + 1
        score = 0.0
        for term in q:
            freq = counts.get(term, 0)
            if not freq:
                continue
            idf = math.log(1.0 + (n - df.get(term, 0) + 0.5) / (df.get(term, 0) + 0.5))
            score += idf * ((freq * (k1 + 1)) / (freq + k1 * (1 - b + b * len(d) / max(avgdl, 1.0))))
        scores.append(score)
    return scores


def _minmax(values: list[float]) -> list[float]:
    if not values:
        return []
    lo, hi = min(values), max(values)
    if hi - lo < 1e-9:
        return [1.0 if hi > 0 else 0.0 for _ in values]
    return [(v - lo) / (hi - lo) for v in values]


def _case_terms(case_id: int) -> set[str]:
    conn = get_db()
    try:
        rows = conn.execute("SELECT label, aliases FROM entities WHERE case_id=? AND LOWER(verification_status)='verified' LIMIT 1000", (case_id,)).fetchall()
        terms = set()
        for r in rows:
            terms.update(_tokens(r["label"]))
            terms.update(_tokens(r["aliases"]))
        rows = conn.execute("SELECT label, address_text FROM locations WHERE case_id=? AND LOWER(verification_status)='verified' LIMIT 500", (case_id,)).fetchall()
        for r in rows:
            terms.update(_tokens(r["label"]))
            terms.update(_tokens(r["address_text"]))
        return terms
    finally:
        conn.close()


def _rebuild_faiss(case_id: int) -> None:
    """Build a case-local FAISS index when the optional dependency is present."""
    if os.getenv("CIPHER_RAG_FAISS", "true").strip().lower() not in {"1", "true", "yes", "on"}:
        return
    conn = get_db()
    try:
        rows = conn.execute("SELECT id, embedding_json, embedding_provider FROM rag_chunks WHERE case_id=? ORDER BY id", (case_id,)).fetchall()
    finally:
        conn.close()
    if not rows or str(rows[0]["embedding_provider"] or "") != "sentence-transformers":
        return
    try:
        import faiss
        vectors = []
        ids = []
        for r in rows:
            vec = np.asarray(json.loads(r["embedding_json"] or "[]"), dtype=np.float32)
            if vec.size:
                vectors.append(vec)
                ids.append(str(r["id"]))
        if not vectors:
            return
        matrix = np.vstack(vectors).astype(np.float32)
        faiss.normalize_L2(matrix)
        index = faiss.IndexFlatIP(matrix.shape[1])
        index.add(matrix)
        case_dir = RAG_DIR / str(case_id)
        case_dir.mkdir(parents=True, exist_ok=True)
        faiss.write_index(index, str(case_dir / "index.faiss"))
        (case_dir / "index_manifest.json").write_text(json.dumps({"case_id": case_id, "chunk_ids": ids, "dimension": int(matrix.shape[1])}), encoding="utf-8")
    except Exception:
        # DB vectors remain authoritative fallback.
        return


def _source_dict(row: dict, score: float, semantic: float = 0.0, lexical: float = 0.0, entity_boost: float = 0.0) -> dict:
    return {
        "id": row.get("id"),
        "evidence_id": row.get("evidence_id"),
        "document_id": row.get("document_id"),
        "filename": row.get("filename") or "Evidence",
        "page_number": row.get("page_number") or 1,
        "chunk_index": row.get("chunk_index") or 0,
        "text": row.get("text") or "",
        "source_reference": row.get("source_reference") or f"{row.get('filename') or 'Evidence'}#page={row.get('page_number') or 1}#chunk={row.get('chunk_index') or 0}",
        "reference": row.get("source_reference") or f"{row.get('filename') or 'Evidence'}#page={row.get('page_number') or 1}#chunk={row.get('chunk_index') or 0}",
        "score": round(float(score), 6),
        "semantic_score": round(float(semantic), 6),
        "lexical_score": round(float(lexical), 6),
        "entity_boost": round(float(entity_boost), 6),
        "source_type": "case_evidence",
    }


def index_document(case_id: int, evidence_id: int, path: str, filename: str, sha256: str | None = None, raw_text: str | None = None):
    ext = Path(filename).suffix.lower()
    extraction_method = "TEXT"
    if raw_text is not None:
        pages = [(1, raw_text)]
        extraction_method = "STRUCTURED_TEXT"
    elif ext in SUPPORTED_IMAGE_EXTS:
        text, extraction_method = _ocr_image(path, filename)
        pages = [(1, text)] if text else []
    else:
        pages = _read_pages(path, filename)
        extraction_method = {".pdf": "PDF_TEXT", ".csv": "CSV_NORMALIZED", ".docx": "DOCX_TEXT"}.get(ext, "TEXT")

    chunks: list[tuple[int, int, str]] = []
    for page_no, text in pages:
        for idx, chunk in enumerate(_chunks(text)):
            chunks.append((page_no, idx, chunk))

    texts = [x[2] for x in chunks]
    provider, model_name, vectors = _embed_texts(texts)
    content_hash = sha256 or hashlib.sha256("\n".join(t for _, _, t in chunks).encode("utf-8")).hexdigest()

    conn = get_db()
    try:
        conn.execute("DELETE FROM rag_chunks WHERE case_id=? AND evidence_id=?", (case_id, evidence_id))
        conn.execute("DELETE FROM rag_documents WHERE case_id=? AND evidence_id=?", (case_id, evidence_id))
        rid = _uid("DOC")
        status = "READY" if chunks else (extraction_method if extraction_method.startswith("OCR_") else "EMPTY")
        conn.execute(
            "INSERT INTO rag_documents(id,case_id,evidence_id,filename,sha256,page_count,chunk_count,embedding_provider,embedding_model,extraction_method,status,error_message) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            (rid, case_id, evidence_id, filename, content_hash, len(pages), len(chunks), provider, model_name, extraction_method, status, None if chunks else "No extractable text found"),
        )
        for i, (page_no, idx, text) in enumerate(chunks):
            cid = _uid("CHUNK")
            vec = vectors[i].tolist() if len(vectors) else []
            conn.execute(
                "INSERT INTO rag_chunks(id,case_id,evidence_id,document_id,page_number,chunk_index,text,source_reference,embedding_json,embedding_provider,embedding_model,active,content_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (cid, case_id, evidence_id, rid, page_no, idx, text, f"{filename}#page={page_no}#chunk={idx}", json.dumps(vec), provider, model_name, 1, hashlib.sha256(text.encode("utf-8")).hexdigest()),
            )
        conn.commit()
    finally:
        conn.close()

    case_dir = RAG_DIR / str(case_id)
    case_dir.mkdir(parents=True, exist_ok=True)
    (case_dir / f"{evidence_id}.json").write_text(
        json.dumps({"evidence_id": evidence_id, "provider": provider, "model": model_name, "chunks": len(chunks), "pages": len(pages), "extraction_method": extraction_method, "sha256": content_hash}),
        encoding="utf-8",
    )
    _rebuild_faiss(case_id)
    return {"evidence_id": evidence_id, "pages": len(pages), "chunks": len(chunks), "provider": provider, "embedding_model": model_name, "extraction_method": extraction_method, "status": status}


def _load_case_rows(case_id: int) -> list[dict]:
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT c.id,c.evidence_id,c.document_id,c.page_number,c.chunk_index,c.text,c.source_reference,c.embedding_json,c.embedding_provider,c.embedding_model,d.filename,d.sha256 "
            "FROM rag_chunks c LEFT JOIN rag_documents d ON d.id=c.document_id "
            "WHERE c.case_id=? AND COALESCE(c.active,1)=1 ORDER BY c.id",
            (case_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def _semantic_scores(case_id: int, query: str, rows: list[dict]) -> list[float]:
    """Return per-row semantic scores while tolerating mixed provider histories."""
    scores = [0.0] * len(rows)
    if not rows:
        return scores

    providers = {str(r.get("embedding_provider") or "tfidf") for r in rows}
    # Use FAISS only when the complete case index has one compatible embedding provider.
    if providers == {"sentence-transformers"}:
        try:
            import faiss
            case_dir = RAG_DIR / str(case_id)
            index_path = case_dir / "index.faiss"
            manifest_path = case_dir / "index_manifest.json"
            qv = _embed_query(query, "sentence-transformers")
            if qv is not None and index_path.exists() and manifest_path.exists():
                index = faiss.read_index(str(index_path))
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                chunk_ids = [str(x) for x in manifest.get("chunk_ids", [])]
                k = min(max(len(rows), 1), index.ntotal)
                if k > 0:
                    q = qv.reshape(1, -1).astype(np.float32)
                    try:
                        faiss.normalize_L2(q)
                    except Exception:
                        pass
                    distances, indices = index.search(q, k)
                    by_id = {str(r["id"]): i for i, r in enumerate(rows)}
                    for dist, idx in zip(distances[0].tolist(), indices[0].tolist()):
                        if 0 <= idx < len(chunk_ids):
                            row_idx = by_id.get(chunk_ids[idx])
                            if row_idx is not None:
                                scores[row_idx] = float(dist)
                    return scores
        except Exception:
            pass

    # Sentence-transformer rows can be compared directly against the query embedding.
    if "sentence-transformers" in providers:
        qv = _embed_query(query, "sentence-transformers")
        if qv is not None:
            for i, row in enumerate(rows):
                if str(row.get("embedding_provider") or "") != "sentence-transformers":
                    continue
                try:
                    vec = np.asarray(json.loads(row.get("embedding_json") or "[]"), dtype=np.float32)
                    if vec.size == qv.size:
                        scores[i] = float(np.dot(qv, vec))
                except Exception:
                    pass

    # TF-IDF fallback rows are scored against a fresh case-local corpus.
    tfidf_indices = [i for i, r in enumerate(rows) if str(r.get("embedding_provider") or "") != "sentence-transformers"]
    if tfidf_indices:
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            texts = [r["text"] for r in rows]
            vec = TfidfVectorizer(lowercase=True, ngram_range=(1, 2), max_features=8192, norm="l2")
            matrix = vec.fit_transform(texts + [query])
            sims = (matrix[:-1] @ matrix[-1].T).toarray().ravel()
            for i in tfidf_indices:
                scores[i] = float(sims[i])
        except Exception:
            pass
    return scores


def search(case_id: int, query: str, limit: int = 8):
    query = (query or "").strip()
    if not query:
        return []
    limit = max(1, min(int(limit), 30))
    rows = _load_case_rows(case_id)
    if not rows:
        return []

    lexical = _bm25_scores(query, [r["text"] for r in rows])
    semantic = _semantic_scores(case_id, query, rows)

    lex_n = _minmax(lexical)
    sem_n = _minmax(semantic)
    qterms = set(_tokens(query))
    entity_terms = _case_terms(case_id)
    entity_boosts = []
    for text in [r["text"] for r in rows]:
        terms = set(_tokens(text))
        exact = len(qterms & terms)
        named = len((qterms & entity_terms) & terms)
        entity_boosts.append(min(0.20, exact * 0.025 + named * 0.035))

    ranked = []
    for i, row in enumerate(rows):
        score = 0.62 * sem_n[i] + 0.30 * lex_n[i] + entity_boosts[i]
        ranked.append((score, sem_n[i], lex_n[i], entity_boosts[i], row))
    ranked.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)

    output = []
    for score, sem, lex, boost, row in ranked[: max(limit * 3, limit)]:
        if score <= 0.0:
            continue
        output.append(_source_dict(row, score, sem, lex, boost))
        if len(output) >= limit:
            break
    return output


def reindex_case(case_id: int):
    conn = get_db()
    docs = conn.execute("SELECT id,filename,file_path,sha256,file_type FROM documents WHERE case_id=? ORDER BY id", (case_id,)).fetchall()
    conn.close()
    results = []
    for d in docs:
        filename = str(d["filename"])
        ext = Path(filename).suffix.lower()
        if ext in SUPPORTED_IMAGE_EXTS:
            if os.getenv("CIPHER_RAG_IMAGE_OCR", "true").strip().lower() in {"1", "true", "yes", "on"}:
                try:
                    results.append(index_document(case_id, int(d["id"]), d["file_path"], filename, d["sha256"]))
                except Exception as exc:
                    results.append({"evidence_id": d["id"], "status": "SKIPPED", "reason": f"image OCR unavailable: {str(exc)[:500]}"})
            else:
                results.append({"evidence_id": d["id"], "status": "SKIPPED", "reason": "image OCR disabled; image remains in Vision pipeline"})
            continue
        if ext not in SUPPORTED_TEXT_EXTS:
            results.append({"evidence_id": d["id"], "status": "SKIPPED", "reason": f"unsupported RAG extension: {ext}"})
            continue
        try:
            results.append(index_document(case_id, int(d["id"]), d["file_path"], filename, d["sha256"]))
        except Exception as exc:
            results.append({"evidence_id": d["id"], "status": "FAILED", "error": str(exc)[:500]})
    _rebuild_faiss(case_id)
    return results


def index_text_document(case_id: int, evidence_id: int, filename: str, text: str, sha256: str | None = None):
    return index_document(case_id, evidence_id, "", filename, sha256, raw_text=text)


def rag_health(case_id: int | None = None):
    conn = get_db()
    try:
        if case_id is None:
            docs = conn.execute("SELECT COUNT(*) c FROM rag_documents").fetchone()["c"]
            chunks = conn.execute("SELECT COUNT(*) c FROM rag_chunks WHERE COALESCE(active,1)=1").fetchone()["c"]
            ready = conn.execute("SELECT COUNT(*) c FROM rag_documents WHERE status='READY'").fetchone()["c"]
        else:
            docs = conn.execute("SELECT COUNT(*) c FROM rag_documents WHERE case_id=?", (case_id,)).fetchone()["c"]
            chunks = conn.execute("SELECT COUNT(*) c FROM rag_chunks WHERE case_id=? AND COALESCE(active,1)=1", (case_id,)).fetchone()["c"]
            ready = conn.execute("SELECT COUNT(*) c FROM rag_documents WHERE case_id=? AND status='READY'", (case_id,)).fetchone()["c"]
        faiss_ready = (RAG_DIR / str(case_id) / "index.faiss").exists() if case_id is not None else False
        return {"ready": int(chunks) > 0, "documents": int(docs), "ready_documents": int(ready), "chunks": int(chunks), "faiss_ready": faiss_ready, "embedding_model": os.getenv("CIPHER_EMBEDDING_MODEL", "all-MiniLM-L6-v2")}
    finally:
        conn.close()
