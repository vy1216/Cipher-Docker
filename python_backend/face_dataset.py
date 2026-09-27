"""Case-scoped face reference dataset ingestion for CIPHER Vision.

Reference images are evidence-owned, but their embeddings are stored in the
case face gallery. Identity is never asserted by enrollment; each reference
must resolve to a canonical case Person or be left pending for review.
"""
from __future__ import annotations
import csv, io, json, os, re, shutil, tempfile, uuid, zipfile
from pathlib import Path
from .db import get_db
from .face_intelligence import detect_face, encode, FACE_ENGINE, FACE_MODEL_VERSION

IMAGE_EXTS={".jpg",".jpeg",".png",".webp"}
MAX_FILES=int(os.getenv("CIPHER_FACE_DATASET_MAX_FILES","500"))

def _safe_name(v:str)->str:
    return re.sub(r"[^A-Za-z0-9._-]+","_",str(v or "").strip())[:120] or "reference"

def _find_entity(conn, case_id:int, key:str):
    key=str(key or "").strip()
    if not key: return None
    if key.isdigit():
        row=conn.execute("SELECT * FROM entities WHERE id=? AND case_id=?",(int(key),case_id)).fetchone()
        if row: return row
    return conn.execute("SELECT * FROM entities WHERE case_id=? AND (LOWER(label)=LOWER(?) OR LOWER(COALESCE(external_id,''))=LOWER(?)) ORDER BY id LIMIT 1",(case_id,key,key)).fetchone()

def _ensure_entity(conn, case_id:int, label:str, evidence_id:int):
    row=_find_entity(conn,case_id,label)
    if row: return row, False
    cur=conn.execute("INSERT INTO entities (case_id,entity_type,label,source_document_id,extraction_method,confidence_score,verification_status,source_type) VALUES (?,?,?,?,?,?,?,?)",
                     (case_id,"PERSON",label,evidence_id,"FACE_REFERENCE_DATASET",1.0,"pending","FACE_REFERENCE_DATASET"))
    eid=cur.lastrowid
    row=conn.execute("SELECT * FROM entities WHERE id=?",(eid,)).fetchone()
    return row, True

def _manifest_map(raw:bytes):
    # Optional manifest.csv inside the ZIP. Accepted columns: entity_id,
    # display_name/name/label, image/path/filename.
    out={}
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            names={n.lower():n for n in z.namelist()}
            mn=next((n for k,n in names.items() if k.endswith("manifest.csv")),None)
            if not mn: return out
            text=z.read(mn).decode("utf-8-sig",errors="replace")
            for row in csv.DictReader(io.StringIO(text)):
                image=(row.get("image") or row.get("path") or row.get("filename") or "").strip()
                if not image: continue
                key=(row.get("entity_id") or row.get("display_name") or row.get("name") or row.get("label") or "").strip()
                if key: out[image.replace("\\","/").lstrip("./")]=key
    except Exception:
        return {}
    return out


def derive_reference_key(filename: str) -> str:
    """Derive a stable person/reference key from a multi-image filename.

    Supported examples: P101__01.jpg, P101_01.jpg, Arjun_Mehta_02.jpg,
    Arjun-Mehta-03.jpg. The key is only used for case-entity resolution; it
    never by itself verifies identity.
    """
    stem=Path(str(filename or "")).stem.strip()
    stem=re.sub(r"(?:__|[-_ .])(?:0*\d{1,3})$", "", stem)
    stem=re.sub(r"\((?:0*\d{1,3})\)$", "", stem)
    return stem.strip(" _.-")

def ingest_reference_images(case_id:int, images:list[tuple[str,bytes,str|None]], user:dict|None=None):
    """Enroll multiple individually uploaded reference photos into the case gallery.

    Each photo is simultaneously retained as case evidence and enrolled into the
    ArcFace gallery. A supplied label or filename convention is resolved to a
    case entity; unresolved labels create a pending entity-review item.
    """
    from .face_intelligence import detect_face, encode, FACE_ENGINE, FACE_MODEL_VERSION
    import hashlib, datetime, mimetypes
    user=user or {"id":0,"full_name":"CIPHER Worker"}
    conn=get_db()
    gallery_root=Path(os.getenv("CIPHER_UPLOADS_DIR", "uploads").strip() or "uploads")
    if not gallery_root.is_absolute(): gallery_root=Path(__file__).resolve().parent.parent / gallery_root
    gallery_dir=gallery_root/"face_profiles"; gallery_dir.mkdir(parents=True,exist_ok=True)
    profiles=[]; errors=[]; pending=[]
    try:
        for filename,raw,label in images:
            original=_safe_name(Path(filename).name)
            ext=Path(original).suffix.lower()
            if ext not in IMAGE_EXTS:
                errors.append({"filename":filename,"error":"Unsupported image type"}); continue
            if not raw:
                errors.append({"filename":filename,"error":"Empty image"}); continue
            try:
                # First preserve the original photo as case evidence. This gives
                # the gallery profile a durable provenance/custody anchor.
                sha=hashlib.sha256(raw).hexdigest()
                ts=datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                path=gallery_dir/f"case_{case_id}_reference_{ts}_{_safe_name(Path(original).stem)}_{uuid.uuid4().hex[:8]}{ext}"
                path.write_bytes(raw)
                mime=mimetypes.guess_type(original)[0] or "application/octet-stream"
                cur=conn.execute("INSERT INTO documents (case_id,filename,file_type,file_path,processing_status,uploaded_by,sha256,source_type,processed_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'))",(case_id,original,mime,str(path),"PROCESSED",int(user.get("id") or 0),sha,"FACE_REFERENCE_IMAGE"))
                evidence_id=cur.lastrowid
                conn.execute("INSERT INTO chain_of_custody_logs (case_id,document_id,action,sha256_hash,actor_name) VALUES (?,?,?,?,?)",(case_id,evidence_id,"FACE_REFERENCE_IMAGE_ENROLLED",sha,user.get("full_name","Investigator")))

                # Only after the evidence ID exists do we resolve/create the
                # canonical case entity. This keeps provenance intact.
                key=str(label or derive_reference_key(original)).strip()
                entity=_find_entity(conn,case_id,key) if key else None
                if not entity:
                    entity,new=_ensure_entity(conn,case_id,key or "Unassigned Face Reference",evidence_id)
                    if new: pending.append(int(entity["id"]))

                vec,bbox=detect_face(raw)
                cur=conn.execute("INSERT INTO face_profiles (case_id,entity_id,display_name,username,source_label,source_evidence_id,image_path,embedding_json,embedding_engine,model_version,active) VALUES (?,?,?,?,?,?,?,?,?,?,1)",(case_id,int(entity["id"]),entity["label"],"","FACE_REFERENCE_DATASET",evidence_id,str(path),encode(vec),FACE_ENGINE,FACE_MODEL_VERSION))
                profile_id=cur.lastrowid
                profiles.append({"profile_id":profile_id,"entity_id":int(entity["id"]),"display_name":entity["label"],"filename":original,"evidence_id":evidence_id,"sha256":sha,"image_url":f"/api/cases/{case_id}/face-gallery/{profile_id}/image","quality":round(float(bbox[2]*bbox[3]),2)})

                verification=str(entity["verification_status"] or "").lower()
                if verification not in {"verified","accepted"}:
                    exists=conn.execute("SELECT id FROM review_items WHERE case_id=? AND entity_id=? AND suggestion_type='FACE_REFERENCE_ENTITY' AND status='PENDING'",(case_id,int(entity["id"]))).fetchone()
                    if not exists:
                        conn.execute("INSERT INTO review_items (case_id,type,suggestion_type,title,description,entity_id,evidence_id,source_document,source_reference,confidence_score,confidence,status,priority,source_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(case_id,"entity","FACE_REFERENCE_ENTITY","Face dataset person requires verification",f"Reference image {original} was enrolled for {entity['label']}. Verify the person/entity association before treating it as trusted.",int(entity["id"]),evidence_id,"Face Reference Dataset","face-dataset",0.95,0.95,"PENDING","HIGH","FACE_REFERENCE_DATASET"))
            except Exception as exc:
                errors.append({"filename":filename,"error":str(exc)[:800]})
        conn.commit()
    finally:
        conn.close()
    return {"status":"success","files_received":len(images),"profiles_created":len(profiles),"errors":errors,"profiles":profiles,"pending_entity_reviews":len(pending)}

def inspect_dataset(raw:bytes):
    if not zipfile.is_zipfile(io.BytesIO(raw)):
        raise ValueError("Face Reference Dataset must be a valid ZIP archive.")
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        files=[]
        for info in z.infolist():
            n=info.filename.replace("\\","/")
            if info.is_dir(): continue
            if n.startswith("/") or ".." in Path(n).parts: raise ValueError("Unsafe path detected in face dataset ZIP.")
            if Path(n).suffix.lower() in IMAGE_EXTS:
                files.append(n)
        if not files: raise ValueError("The face dataset ZIP contains no JPG, PNG or WEBP reference images.")
        if len(files)>MAX_FILES: raise ValueError(f"Face dataset contains {len(files)} images; maximum is {MAX_FILES}.")
        total=sum(i.file_size for i in z.infolist() if not i.is_dir())
        if total>250*1024*1024: raise ValueError("Face dataset ZIP is larger than the 250 MB safety limit.")
    return files

def ingest_dataset(case_id:int,evidence_id:int,raw:bytes,user:dict|None=None):
    files=inspect_dataset(raw); manifest=_manifest_map(raw)
    conn=get_db(); created=[]; pending_entities=[]; errors=[]
    gallery_root=Path(os.getenv("CIPHER_UPLOADS_DIR", "uploads").strip() or "uploads")
    if not gallery_root.is_absolute(): gallery_root=Path(__file__).resolve().parent.parent / gallery_root
    gallery_dir=gallery_root / "face_profiles"
    gallery_dir.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        for name in files:
            try:
                normalized=name.replace("\\","/").lstrip("./")
                parts=Path(normalized).parts
                manifest_key=manifest.get(normalized)
                key=manifest_key or (parts[-2] if len(parts)>1 else "")
                if not key:
                    # flat dataset can use a filename prefix such as P101__01.jpg
                    key=Path(parts[-1]).stem.split("__",1)[0]
                entity=_find_entity(conn,case_id,key)
                if not entity:
                    entity,new=_ensure_entity(conn,case_id,key,evidence_id)
                    if new: pending_entities.append(int(entity["id"]))
                image_bytes=z.read(name)
                vec,bbox=detect_face(image_bytes)
                ext=Path(name).suffix.lower(); out=gallery_dir/f"case_{case_id}_ev_{evidence_id}_{uuid.uuid4().hex}{ext}"
                out.write_bytes(image_bytes)
                cur=conn.execute("INSERT INTO face_profiles (case_id,entity_id,display_name,username,source_label,source_evidence_id,image_path,embedding_json,embedding_engine,model_version,active) VALUES (?,?,?,?,?,?,?,?,?,?,1)",
                    (case_id, int(entity["id"]), entity["label"], "", "FACE_REFERENCE_DATASET", evidence_id, str(out), encode(vec), FACE_ENGINE, FACE_MODEL_VERSION))
                created.append({"profile_id":cur.lastrowid,"entity_id":int(entity["id"]),"display_name":entity["label"],"filename":normalized,"evidence_id":evidence_id,"quality":round(float(bbox[2]*bbox[3]),2)})
            except Exception as exc:
                errors.append({"filename":name,"error":str(exc)[:500]})
    if pending_entities:
        for eid in pending_entities:
            conn.execute("INSERT INTO review_items (case_id,type,suggestion_type,title,description,entity_id,evidence_id,source_document,source_reference,confidence_score,confidence,status,priority,source_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (case_id,"entity","FACE_REFERENCE_ENTITY",f"Face dataset entity requires verification", "A person label was created from a face reference dataset folder/manifest and requires investigator verification before it becomes trusted.",eid,evidence_id,"Face Reference Dataset","face-dataset",0.95,0.95,"PENDING","HIGH","FACE_REFERENCE_DATASET"))
    conn.commit(); conn.close()
    return {"status":"success","files_seen":len(files),"profiles_created":len(created),"pending_entities":len(pending_entities),"errors":errors,"profiles":created}
