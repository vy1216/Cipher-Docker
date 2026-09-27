"""Canonical evidence processing pipeline shared by API background tasks and worker."""
from __future__ import annotations
import os
import tempfile
from pathlib import Path
from .db import get_db
from .evidence_service import process_evidence_file
from .entity_resolution import resolve_case as resolve_case_entities
from .rag_engine import index_document
from .face_intelligence import search_case_gallery
from .face_dataset import ingest_dataset as ingest_face_dataset
from .storage import download_uri

IMAGE_EXTS={".png",".jpg",".jpeg",".webp"}
TEXT_EXTS={".txt",".csv",".pdf",".docx"}
DATASET_EXTS={".zip"}
AUDIO_EXTS={".wav",".mp3",".m4a",".ogg",".webm"}

def _raw_bytes(file_path:str)->bytes:
    return download_uri(str(file_path))

def process_document(case_id:int, evidence_id:int, user:dict|None=None):
    user=user or {"id":0,"full_name":"CIPHER Worker"}
    conn=get_db()
    doc=conn.execute("SELECT * FROM documents WHERE id=? AND case_id=?",(evidence_id,case_id)).fetchone()
    conn.close()
    if not doc:
        raise ValueError("Evidence document not found")
    doc=dict(doc)
    ext=Path(str(doc["filename"])).suffix.lower()
    if ext in TEXT_EXTS:
        local_path=None
        try:
            # process_evidence_file historically reads file_path directly. For
            # object storage URIs, materialize only for the duration of this job.
            raw=_raw_bytes(doc["file_path"])
            fd,local_path=tempfile.mkstemp(prefix="cipher-evidence-",suffix=ext)
            os.close(fd); Path(local_path).write_bytes(raw)
            working=dict(doc); working["file_path"]=local_path
            result=process_evidence_file(case_id,working,user)
        finally:
            if local_path:
                try: os.unlink(local_path)
                except OSError: pass
        try: resolve_case_entities(case_id)
        except Exception as exc:
            print(f"[pipeline] entity resolution skipped for case {case_id}: {exc}",flush=True)
        try:
            index_document(case_id,evidence_id,doc["file_path"],doc["filename"],doc.get("sha256"))
        except Exception as exc:
            conn=get_db()
            conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)",
                         (case_id,"RAG_INDEX_FAILED","document",str(evidence_id),str(user.get("id")),str(exc)[:1000],"FAILED"))
            conn.commit(); conn.close()
            result["rag_status"]="FAILED"
        return result
    if ext in DATASET_EXTS:
        raw=_raw_bytes(doc["file_path"])
        if str(doc.get("source_type") or "").upper() != "FACE_REFERENCE_DATASET":
            raise ValueError("ZIP evidence is reserved for Face Reference Dataset ingestion.")
        try:
            result=ingest_face_dataset(case_id,evidence_id,raw,user)
            action="FACE_DATASET_INGESTED"; status="SUCCESS"
        except Exception as exc:
            result={"status":"FAILED","error":str(exc)[:1200]}; action="FACE_DATASET_INGEST_FAILED"; status="FAILED"
            raise
        finally:
            conn=get_db()
            conn.execute("UPDATE documents SET processing_status=?,processed_at=datetime('now') WHERE id=? AND case_id=?",("PROCESSED" if status=="SUCCESS" else "FAILED",evidence_id,case_id))
            conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)",(case_id,action,"document",str(evidence_id),str(user.get("id")),str(result)[:4000],status))
            conn.commit(); conn.close()
        return result

    if ext in AUDIO_EXTS:
        # Audio is preserved as communication evidence. Structured CDR rows are
        # extracted from CDR CSVs; audio transcription remains optional and never
        # fabricates metadata when no speech-to-text runtime is installed.
        conn=get_db()
        conn.execute("UPDATE documents SET processing_status='PROCESSED',processed_at=datetime('now') WHERE id=? AND case_id=?",(evidence_id,case_id))
        conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)",(case_id,"AUDIO_EVIDENCE_STORED","document",str(evidence_id),str(user.get("id")),"Audio preserved as communication evidence; no synthetic CDR metadata generated.","SUCCESS"))
        conn.commit(); conn.close()
        return {"status":"PROCESSED","evidence_id":evidence_id,"audio":True,"cdr_extraction":"PENDING_OPTIONAL_TRANSCRIPTION","message":"Audio evidence stored. CDR metadata is extracted only from structured CDR evidence or an available transcript."}

    if ext in IMAGE_EXTS:
        raw=_raw_bytes(doc["file_path"])
        try:
            result=search_case_gallery(case_id,raw,evidence_id,5)
            action="FACE_SEARCH_COMPLETED"; status="SUCCESS"
        except Exception as exc:
            # Evidence integrity must not depend on an optional local face runtime.
            # Preserve the image as processed and record the exact face-runtime state.
            result={"model":"unavailable","matches":[],"faces_detected":0,"skipped":True,"reason":str(exc)[:1200]}
            action="FACE_SEARCH_SKIPPED"; status="SKIPPED"
        # Image evidence remains owned by the Vision pipeline. RAG OCR is an
        # additive text-extraction path and never blocks or changes face matching.
        try:
            rag_result = index_document(case_id, evidence_id, doc["file_path"], doc["filename"], doc.get("sha256"))
            result["rag_status"] = rag_result.get("status", "READY")
            result["rag_chunks"] = rag_result.get("chunks", 0)
        except Exception as exc:
            result["rag_status"] = "SKIPPED"
            result["rag_error"] = str(exc)[:500]
        conn=get_db()
        conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)",
                     (case_id,action,"document",str(evidence_id),str(user.get("id")),str(result)[:2000],status))
        conn.execute("UPDATE documents SET processing_status='PROCESSED',processed_at=datetime('now') WHERE id=? AND case_id=?",(evidence_id,case_id))
        conn.commit(); conn.close()
        return result
    raise ValueError(f"Unsupported evidence type: {ext}")
