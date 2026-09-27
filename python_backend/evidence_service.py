import csv, io, json, os, math, datetime
from pathlib import Path
from typing import Any
import requests

from .db import get_db
from .storage import temporary_local_copy

ALLOWED_RELATIONSHIPS = {
    "CALLS","USES_PHONE","OWNS","DRIVES","VISITED","WORKS_FOR",
    "TRANSFERS_TO","ASSOCIATED_WITH","OBSERVED_AT","LOCATED_AT",
    "CALLED","PAID","OWNED","TRAVELLED_TO","REFERENCED_BY"
}


def canonical_entity_type(value: str) -> str:
    v = (value or "person").strip().lower().replace(" ", "_")
    aliases = {
        "human":"person", "individual":"person", "person_name":"person",
        "phone_number":"phone", "telephone":"phone", "mobile":"phone", "msisdn":"phone",
        "company":"organization", "org":"organization", "organisation":"organization",
        "bank_account":"account", "account_number":"account", "car":"vehicle",
        "location":"place", "address":"place", "site":"place", "landmark":"place"
    }
    return aliases.get(v, v)


def relationship_type(value: str) -> str:
    v = (value or "ASSOCIATED_WITH").strip().upper().replace(" ", "_").replace("-", "_")
    return v if v in ALLOWED_RELATIONSHIPS else "ASSOCIATED_WITH"


def csv_findings(text: str) -> dict:
    reader = csv.DictReader(io.StringIO(text))
    fields = [str(f).strip() for f in (reader.fieldnames or []) if f is not None]
    rows = list(reader)[:2000]
    normalized = {f.lower().strip().replace(" ", "_").replace("-", "_"): f for f in fields}

    def find_exact_or_contains(*names):
        for n in names:
            if n in normalized:
                return normalized[n]
        for f in fields:
            nf=f.lower().strip().replace(" ", "_").replace("-", "_")
            if any(n in nf for n in names):
                return f
        return None

    source = find_exact_or_contains("source_entity_id","source_entity","source_id","source_name","source","from_entity","from_name","from","caller","caller_name","caller_number","person_a","src","origin","node_a","entity_a","person_a_name","connected_to","connects_to","linked_to","related_to")
    target = find_exact_or_contains("target_entity_id","target_entity","target_id","target_name","target","to_entity","to_name","to","receiver","receiver_name","receiver_number","callee","callee_name","person_b","dst","destination","node_b","entity_b","person_b_name","connected_from","linked_from","related_from")
    rel = find_exact_or_contains("relationship_type","relationship","relation","link_type","relation_type","edge_type","connection_type")
    name = find_exact_or_contains("entity_id","name","label","person_name","person","entity","subject","entity_name","node","node_name","actor","individual","person_a","person_b")
    etype = find_exact_or_contains("entity_type","type","category","node_type","entity_category")
    phone = find_exact_or_contains("phone","phone_number","mobile","msisdn","caller_number","callee_number")
    vehicle = find_exact_or_contains("vehicle","vehicle_id","registration","registration_number","plate","plate_number","vehicle_number")
    account = find_exact_or_contains("account","account_number","bank_account","upi","iban")
    org = find_exact_or_contains("organization","organisation","company","employer","org_name")
    lat = find_exact_or_contains("latitude","lat","lat_dd")
    lng = find_exact_or_contains("longitude","lng","lon","long","lon_dd")
    location = find_exact_or_contains("location","address","place","landmark","site","venue","location_name")
    event_time = find_exact_or_contains("event_time","event_datetime","timestamp","datetime","date_time","observed_at","occurred_at","event_date","date","time")
    event_type = find_exact_or_contains("event_type","event","activity","action","event_label")
    evidence_ref = find_exact_or_contains("evidence","evidence_id","source_reference","reference","document")

    def infer_type(field, fallback="person"):
        if not field: return fallback
        n=field.lower().replace(" ","_")
        if "phone" in n or "mobile" in n or "msisdn" in n or "caller" in n or "callee" in n: return "phone"
        if "vehicle" in n or "plate" in n or "registration" in n: return "vehicle"
        if "account" in n or "upi" in n or "iban" in n: return "account"
        if "org" in n or "company" in n or "employer" in n: return "organization"
        if "location" in n or "address" in n or "place" in n: return "place"
        return fallback

    entities=[]; relationships=[]; events=[]; seen=set(); entity_index={}

    def add_entity(value, t="person", row=None):
        value=str(value or "").strip()
        if not value: return
        et=canonical_entity_type(t)
        key=(value.lower(),et)
        if key in seen:
            return
        item={"name":value,"type":et,"confidence":0.78}
        if row and lat and lng:
            try:
                la=float(row.get(lat)); lo=float(row.get(lng))
                if math.isfinite(la) and math.isfinite(lo):
                    item["latitude"]=la; item["longitude"]=lo
            except Exception: pass
        if row and location:
            item["address"]=str(row.get(location) or "")
        entities.append(item); seen.add(key); entity_index[value.lower()]=et

    for row in rows:
        # Add explicit typed node fields.
        if name and row.get(name): add_entity(row.get(name), row.get(etype) if etype and row.get(etype) else infer_type(name), row)
        if phone and row.get(phone): add_entity(row.get(phone), "phone", row)
        if vehicle and row.get(vehicle): add_entity(row.get(vehicle), "vehicle", row)
        if account and row.get(account): add_entity(row.get(account), "account", row)
        if org and row.get(org): add_entity(row.get(org), "organization", row)

        # Explicit edge rows.
        if source and target and row.get(source) and row.get(target):
            sv=str(row.get(source)).strip(); tv=str(row.get(target)).strip()
            add_entity(sv, entity_index.get(sv.lower(), infer_type(source)), row)
            add_entity(tv, entity_index.get(tv.lower(), infer_type(target)), row)
            relationships.append({
                "source":sv,"target":tv,
                "relationship_type":relationship_type(row.get(rel) if rel else "ASSOCIATED_WITH"),
                "evidence": str(row.get(evidence_ref) if evidence_ref else json.dumps(row, ensure_ascii=False))[:1800],
                "confidence":0.80,
                "event_time": str(row.get(event_time) or "") if event_time else "",
                "event_type": str(row.get(event_type) or "RELATIONSHIP") if event_type else "RELATIONSHIP",
            })

        # Produce a timeline candidate whenever a recognizable time column exists and the row contains an investigative signal.
        if event_time and row.get(event_time):
            ts=str(row.get(event_time)).strip()
            if ts:
                anchor=(str(row.get(name) or row.get(source) or row.get(target) or "Evidence event").strip())
                desc=(str(row.get(event_type) or "Evidence event").strip() + (f": {anchor}" if anchor else ""))[:500]
                events.append({
                    "event_type": str(row.get(event_type) or "EVIDENCE_EVENT").strip() or "EVIDENCE_EVENT",
                    "event_time": ts,
                    "description": desc,
                    "source_reference": str(row.get(evidence_ref) or "CSV row")[:500],
                    "confidence":0.78,
                })

    return {"entities":entities[:1000],"relationships":relationships[:2000],"events":events[:2000]}


def text_findings(text: str) -> dict:
    """Best-effort, source-bound extraction for TXT/PDF when no LLM is configured.

    This is intentionally conservative: it only extracts explicitly labelled
    values, obvious identifiers, explicit relationship verbs, and explicit dates
    or coordinate pairs. All findings remain PENDING until investigator review.
    """
    import re

    entities = []
    relationships = []
    locations = []
    events = []
    seen_entities = set()

    def add_entity(name, kind="person"):
        name = re.sub(r"\s+", " ", str(name or "")).strip(" \t:-,.;")
        kind = canonical_entity_type(kind)
        if not name:
            return
        # Canonicalize phone identifiers so formatting variants do not create duplicate nodes.
        display_name = name
        key_name = name.lower()
        if kind == "phone":
            digits = re.sub(r"\D", "", name)
            if len(digits) >= 9:
                display_name = "+" + digits if name.strip().startswith("+") else digits
                key_name = digits
        key = (key_name, kind)
        if key in seen_entities:
            return
        seen_entities.add(key)
        entities.append({"name": display_name, "type": kind, "confidence": 0.72})

    labels = {
        "person": "person", "persons": "person", "subject": "person", "individual": "person",
        "phone": "phone", "phone number": "phone", "mobile": "phone", "msisdn": "phone",
        "vehicle": "vehicle", "vehicle id": "vehicle", "registration": "vehicle", "plate": "vehicle",
        "account": "account", "bank account": "account", "upi": "account",
        "organization": "organization", "organisation": "organization", "company": "organization", "org": "organization",
        "place": "place", "location": "place", "site": "place", "address": "place",
    }
    for line in text.splitlines():
        raw = line.strip()
        if not raw:
            continue
        m = re.match(r"^\s*([A-Za-z][A-Za-z _-]{1,30})\s*[:=-]\s*(.+?)\s*$", raw)
        if m:
            key = re.sub(r"\s+", " ", m.group(1).lower()).strip()
            value = m.group(2).strip()
            if key in labels and not re.search(r"(?:\d{1,3}\.\d+)[, ]+\s*(?:\d{1,3}\.\d+)", value):
                add_entity(value, labels[key])
                if labels[key] == "place":
                    coords = re.search(r"(-?\d{1,3}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)", value)
                    if coords:
                        continue

    # Numbered incident-location lists in text/PDF reports are explicit place names.
    # Restrict parsing to the INCIDENT LOCATIONS section so unrelated numbered
    # report metrics are not misclassified as places.
    location_section = re.search(r"(?is)INCIDENT\s+LOCATIONS(.*?)(?=\nINVESTIGATION\s+CHRONOLOGY\b|\Z)", text)
    if location_section:
        section = location_section.group(1)
        numbered_location_pattern = re.compile(r"(?m)^\s*\d{1,2}\s*\n([^\n]+)\n([^\n]+)")
        for m in numbered_location_pattern.finditer(section):
            label = m.group(1).strip()
            area = m.group(2).strip()
            if label and area and len(label) < 160 and len(area) < 180:
                add_entity(label, "place")

    # Explicit phone identifiers.
    for m in re.finditer(r"(?<!\d)(?:\+?\d{1,3}[ -]?)?(?:\d[ -]?){8,14}\d(?!\d)", text):
        raw = re.sub(r"[ -]", "", m.group(0))
        if len(re.sub(r"\D", "", raw)) >= 9:
            add_entity(raw, "phone")

    # Common vehicle registration shapes: alphanumeric registrations with at least one dash/space.
    for m in re.finditer(r"\b[A-Z]{2}[- ]?[0-9]{1,3}[- ]?[A-Z]{1,3}[- ]?[0-9]{2,4}\b", text, flags=re.I):
        add_entity(m.group(0), "vehicle")

    # Coordinate pairs anywhere in the evidence.
    loc_index = 0
    for m in re.finditer(r"(-?\d{1,3}\.\d{3,})\s*[, ]\s*(-?\d{1,3}\.\d{3,})", text):
        try:
            lat, lng = float(m.group(1)), float(m.group(2))
        except ValueError:
            continue
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            continue
        loc_index += 1
        label = f"Evidence location {loc_index}"
        locations.append({"name": label, "latitude": lat, "longitude": lng, "location_type": "evidence_location", "address": None, "confidence": 0.75})

    # Relationship statements. Use only names explicitly extracted above.
    names = [e["name"] for e in entities if e["type"] in {"person", "organization", "vehicle", "account", "phone"}]
    names = sorted(set(names), key=len, reverse=True)
    escaped = [re.escape(n) for n in names if len(n) >= 2]
    if escaped:
        name_alt = "|".join(escaped)
        patterns = [
            (r"(?P<a>" + name_alt + r")\s+(?:called|calls|telephoned)\s+(?P<b>" + name_alt + r")", "CALLS"),
            (r"(?P<a>" + name_alt + r")\s+(?:drives|drove)\s+(?P<b>" + name_alt + r")", "DRIVES"),
            (r"(?P<a>" + name_alt + r")\s+(?:owns|owned)\s+(?P<b>" + name_alt + r")", "OWNS"),
            (r"(?P<a>" + name_alt + r")\s+(?:visited|visits|met)\s+(?P<b>" + name_alt + r")", "VISITED"),
            (r"(?P<a>" + name_alt + r")\s+(?:works for|worked for)\s+(?P<b>" + name_alt + r")", "WORKS_FOR"),
            (r"(?P<a>" + name_alt + r")\s+(?:transferred to|transfers to|paid)\s+(?P<b>" + name_alt + r")", "TRANSFERS_TO"),
            (r"(?P<a>" + name_alt + r")\s+(?:associated with|is associated with)\s+(?P<b>" + name_alt + r")", "ASSOCIATED_WITH"),
        ]
        for pattern, rtype in patterns:
            for m in re.finditer(pattern, text, flags=re.I):
                a, b = m.group("a"), m.group("b")
                if a.lower() == b.lower():
                    continue
                relationships.append({"source": a, "target": b, "relationship_type": rtype, "evidence": m.group(0)[:1800], "confidence": 0.78})

    # Explicit event/date candidates. Keep the sentence as evidence context.
    for sentence in re.split(r"(?<=[.!?])\s+|\n+", text):
        sentence = sentence.strip()
        if not sentence:
            continue
        dm = re.search(r"\b(20\d{2}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+20\d{2})\b", sentence, flags=re.I)
        if dm:
            event_type = "EVIDENCE_EVENT"
            low = sentence.lower()
            if any(k in low for k in ("call", "called", "calls", "phone")): event_type = "CALL"
            elif any(k in low for k in ("drive", "drove", "vehicle", "car")): event_type = "VEHICLE_MOVEMENT"
            elif any(k in low for k in ("meet", "met", "meeting")): event_type = "MEETING"
            events.append({"event_type": event_type, "event_time": dm.group(1), "description": sentence[:1000], "source_reference": "TXT/PDF evidence", "confidence": 0.74})

    return {"entities": entities[:1000], "relationships": relationships[:2000], "locations": locations[:1000], "events": events[:2000]}


def extract_with_gemini(text: str, filename: str) -> dict:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY not configured")
    prompt = f"""Extract investigative entities and relationships from this evidence. Return JSON only.
Schema:
{{"entities":[{{"name":"...","type":"person|phone|vehicle|organization|account|place|other","confidence":0.0,"latitude":null,"longitude":null,"address":null}}],"relationships":[{{"source":"...","target":"...","relationship_type":"CALLS|USES_PHONE|OWNS|DRIVES|VISITED|WORKS_FOR|TRANSFERS_TO|ASSOCIATED_WITH|OBSERVED_AT|LOCATED_AT","evidence":"...","confidence":0.0}}],"locations":[{{"name":"...","latitude":null,"longitude":null,"location_type":"...","address":null,"confidence":0.0}}],"events":[{{"event_type":"...","event_time":"...","description":"...","source_reference":"...","confidence":0.0}}]}}
Only use facts explicitly present in the evidence. Never invent names, links, dates or coordinates.
File: {filename}
Evidence:\n{text[:70000]}"""
    models = [os.getenv("GEMINI_MODEL", "gemini-3.6-flash")]
    last = None
    for model in models:
        try:
            url=f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            payload={"system_instruction":{"parts":[{"text":"You are CIPHER's extraction engine. Facts only. JSON only."}]},"contents":[{"parts":[{"text":prompt}]}],"generationConfig":{"temperature":0.1,"responseMimeType":"application/json"}}
            r=requests.post(url,json=payload,timeout=30)
            if r.status_code == 404:
                continue
            r.raise_for_status()
            txt=r.json()["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(txt)
        except Exception as e:
            last=e
    raise last or RuntimeError("Gemini extraction failed")


def _document_text(doc: dict) -> str:
    source = str(doc["file_path"] or "")
    temp_path = None
    if source.startswith("supabase://"):
        temp_path = temporary_local_copy(source, suffix=Path(doc["filename"]).suffix.lower())
        source = temp_path
    raw = Path(source).read_bytes()
    ext = Path(doc["filename"]).suffix.lower()
    if ext == ".txt":
        return raw.decode("utf-8", errors="replace")
    if ext == ".csv":
        return raw.decode("utf-8-sig", errors="replace")
    if ext == ".pdf":
        import fitz
        pdf=fitz.open(stream=raw, filetype="pdf")
        text="\n\n".join(page.get_text("text") for page in pdf)
        pdf.close()
        return text
    if ext == ".docx":
        from docx import Document
        document=Document(io.BytesIO(raw))
        parts=[p.text for p in document.paragraphs if p.text.strip()]
        for table in document.tables:
            for row in table.rows:
                values=[cell.text.strip() for cell in row.cells]
                if any(values): parts.append(" | ".join(values))
        return "\n".join(parts)
    raise ValueError("Only TXT, CSV, PDF and DOCX evidence is supported")


def process_evidence_file(case_id: int, doc: dict, user: dict) -> dict:
    text=_document_text(doc)[:120000]
    ext=Path(doc["filename"]).suffix.lower()

    findings=csv_findings(text) if ext == ".csv" else text_findings(text)
    provider="csv_heuristic" if ext == ".csv" else "deterministic"
    if os.getenv("GEMINI_API_KEY"):
        try:
            llm=extract_with_gemini(text,doc["filename"])
            if isinstance(llm,dict):
                # merge deterministic CSV findings with LLM findings, preferring LLM but preserving explicit CSV rows.
                merged={k:list(findings.get(k,[])) for k in ("entities","relationships","locations","events")}
                for k in merged:
                    if llm.get(k): merged[k].extend(llm.get(k) or [])
                findings=merged
                if any(findings.get(k) for k in merged): provider="gemini"
        except Exception:
            pass

    conn=get_db(); entity_map={}; new_entities=[]; new_relationships=[]; new_locations=[]; new_events=[]; review_ids=[]

    def find_entity(label, etype=None):
        row=conn.execute("SELECT * FROM entities WHERE case_id=? AND lower(label)=lower(?)",(case_id,label)).fetchone()
        return row

    def add_review(item_type,title,description,**kw):
        payload=kw.pop("payload",{})
        conf=float(kw.pop("confidence",0.75) or 0.75); conf=conf/100 if conf>1 else conf
        cur=conn.execute("""INSERT INTO review_items (case_id,type,suggestion_type,title,description,entity_id,relationship_id,location_id,event_id,evidence_id,source_document,source_reference,extracted_context,ai_output,confidence_score,confidence,status,priority,external_id,source_type)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                         (case_id,item_type,item_type.upper()+"_EXTRACTION",title,description,kw.get("entity_id"),kw.get("relationship_id"),kw.get("location_id"),kw.get("event_id"),doc["id"],doc["filename"],kw.get("source_reference") or doc["filename"],kw.get("extracted_context") or text[:1500],json.dumps(payload,ensure_ascii=False),conf,conf,"PENDING","MEDIUM",kw.get("external_id"),provider.upper()))
        review_ids.append(cur.lastrowid)

    # Entities
    for ent in findings.get("entities",[])[:1000]:
        label=str(ent.get("name") or ent.get("label") or "").strip()
        if not label: continue
        existing=find_entity(label)
        if existing:
            entity_map[label.lower()]=existing["id"]
            continue
        conf=float(ent.get("confidence") or 0.75); conf=conf/100 if conf>1 else conf
        cur=conn.execute("""INSERT INTO entities (case_id,entity_type,label,aliases,extraction_method,confidence_score,verification_status,latitude,longitude,source_document_id,source_type,source_reference)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                         (case_id,canonical_entity_type(ent.get("type")),label,ent.get("aliases") or "",provider.upper(),conf,"pending",ent.get("latitude"),ent.get("longitude"),doc["id"],"EVIDENCE",ent.get("source_reference") or doc["filename"]))
        eid=cur.lastrowid; entity_map[label.lower()]=eid
        new_entities.append({"id":eid,"label":label,"entity_type":canonical_entity_type(ent.get("type"))})
        add_review("entity",f"Entity: {label}","Extracted from uploaded evidence and awaiting investigator verification",entity_id=eid,payload=ent,confidence=conf,external_id=f"DOC-{doc['id']}-ENT-{eid}")

    # Explicit Gemini/CSV locations
    for loc in findings.get("locations",[])[:1000]:
        label=str(loc.get("name") or loc.get("label") or "").strip()
        try: lat=float(loc.get("latitude")); lng=float(loc.get("longitude"))
        except Exception: continue
        if not label: continue
        existing=conn.execute("SELECT * FROM locations WHERE case_id=? AND lower(label)=lower(?) AND latitude=? AND longitude=?",(case_id,label,lat,lng)).fetchone()
        if existing: continue
        cur=conn.execute("""INSERT INTO locations (case_id,entity_id,label,latitude,longitude,location_type,address_text,source_document_id,verification_status,primary_evidence_id,source_id,source_reference)
                          VALUES (?,?,?,?,?,?,?,?,'pending',?,?,?)""",
                         (case_id,None,label,lat,lng,loc.get("location_type") or "evidence_location",loc.get("address") or "",doc["id"],doc["id"],doc["filename"],loc.get("source_reference") or doc["filename"]))
        lid=cur.lastrowid; new_locations.append(lid)
        add_review("location",f"Location: {label}","Location extracted from uploaded evidence and awaiting investigator verification",location_id=lid,payload=loc,confidence=loc.get("confidence") or 0.75,external_id=f"DOC-{doc['id']}-LOC-{lid}")

    # Relationships, deduplicated against existing case edges.
    for rel in findings.get("relationships",[])[:2000]:
        source=str(rel.get("source") or "").strip(); target=str(rel.get("target") or "").strip()
        if not source or not target: continue
        sid=entity_map.get(source.lower()) or (find_entity(source) or {}).get("id")
        tid=entity_map.get(target.lower()) or (find_entity(target) or {}).get("id")
        if sid is None:
            cur=conn.execute("INSERT INTO entities (case_id,entity_type,label,extraction_method,confidence_score,verification_status,source_document_id,source_type,source_reference) VALUES (?,?,?,?,?,?,?,?,?)",(case_id,"person",source,provider.upper(),0.70,"pending",doc["id"],"EVIDENCE",doc["filename"]))
            sid=cur.lastrowid; entity_map[source.lower()]=sid
            add_review("entity",f"Entity: {source}","Entity created because it was referenced by an extracted relationship",entity_id=sid,payload={"name":source,"type":"person"},confidence=0.70,external_id=f"DOC-{doc['id']}-AUTOENT-{sid}")
        if tid is None:
            cur=conn.execute("INSERT INTO entities (case_id,entity_type,label,extraction_method,confidence_score,verification_status,source_document_id,source_type,source_reference) VALUES (?,?,?,?,?,?,?,?,?)",(case_id,"person",target,provider.upper(),0.70,"pending",doc["id"],"EVIDENCE",doc["filename"]))
            tid=cur.lastrowid; entity_map[target.lower()]=tid
            add_review("entity",f"Entity: {target}","Entity created because it was referenced by an extracted relationship",entity_id=tid,payload={"name":target,"type":"person"},confidence=0.70,external_id=f"DOC-{doc['id']}-AUTOENT-{tid}")
        rtype=relationship_type(rel.get("relationship_type")); conf=float(rel.get("confidence") or 0.75); conf=conf/100 if conf>1 else conf
        exists=conn.execute("SELECT id FROM relationships WHERE case_id=? AND source_entity_id=? AND target_entity_id=? AND relationship_type=? AND source_document_id=?",(case_id,sid,tid,rtype,doc["id"])).fetchone()
        if exists: continue
        cur=conn.execute("""INSERT INTO relationships (case_id,source_entity_id,target_entity_id,relationship_type,evidence_sentence,source_document_id,confidence_score,verification_status,source_reference,source_type)
                           VALUES (?,?,?,?,?,?,?,?,?,?)""",(case_id,sid,tid,rtype,rel.get("evidence") or "",doc["id"],conf,"pending",rel.get("source_reference") or doc["filename"],provider.upper()))
        rid=cur.lastrowid; new_relationships.append({"id":rid,"source_entity_id":sid,"target_entity_id":tid,"relationship_type":rtype})
        add_review("relationship",f"Relationship: {source} → {target}","Extracted relationship awaiting investigator verification",relationship_id=rid,payload=rel,confidence=conf,external_id=f"DOC-{doc['id']}-REL-{rid}",extracted_context=rel.get("evidence") or text[:1000])

    # Timeline events remain pending until review; accepted events populate the verified timeline.
    for ev in findings.get("events",[])[:2000]:
        when=str(ev.get("event_time") or "").strip()
        if not when: continue
        # Best-effort normalize common ISO values; keep original when parsing fails.
        etype=str(ev.get("event_type") or "EVIDENCE_EVENT").strip()[:100]
        desc=str(ev.get("description") or etype).strip()[:1000]
        conf=float(ev.get("confidence") or 0.75); conf=conf/100 if conf>1 else conf
        cur=conn.execute("""INSERT INTO timeline_events (external_id,case_id,event_type,event_time,description,evidence_id,confidence_score,verification_status,source_reference)
                          VALUES (?,?,?,?,?,?,?,'pending',?)""",(f"DOC-{doc['id']}-EVENT-{len(new_events)+1}",case_id,etype,when,desc,doc["id"],conf,ev.get("source_reference") or doc["filename"]))
        eid=cur.lastrowid; new_events.append(eid)
        add_review("event",f"Timeline event: {desc[:80]}","Evidence-derived event awaiting investigator verification",event_id=eid,payload=ev,confidence=conf,external_id=f"DOC-{doc['id']}-EVENT-REVIEW-{eid}",source_reference=ev.get("source_reference") or doc["filename"])

    conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)",
                 (case_id,"EVIDENCE_PROCESSED","document",str(doc["id"]),str(user.get("id")),f"{doc['filename']} processed via {provider}: {len(new_entities)} entities, {len(new_relationships)} relationships, {len(new_locations)} locations, {len(new_events)} events","SUCCESS"))
    conn.execute("UPDATE documents SET processing_status='PROCESSED',processed_at=datetime('now') WHERE id=? AND case_id=?",(doc["id"],case_id))
    conn.commit(); conn.close()
    return {"provider":provider,"evidence_id":doc["id"],"entities_created":len(new_entities),"relationships_created":len(new_relationships),"locations_created":len(new_locations),"events_created":len(new_events),"review_items_created":len(review_ids),"entity_ids":[x["id"] for x in new_entities],"relationship_ids":[x["id"] for x in new_relationships],"location_ids":new_locations,"event_ids":new_events,"review_ids":review_ids,"text_length":len(text)}

