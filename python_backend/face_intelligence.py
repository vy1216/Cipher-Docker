"""Cipher Vision face intelligence using InsightFace/ArcFace embeddings.

The application searches only the authorized Cipher case gallery. InsightFace is
loaded lazily so the rest of Cipher can boot without GPU dependencies. The model
pack must be installed/licensed separately; Cipher never falls back to a fake
ArcFace implementation.
"""
from __future__ import annotations
import json
import os
from functools import lru_cache
from typing import Any
import numpy as np
from .db import get_db


FACE_ENGINE = os.getenv("CIPHER_FACE_ENGINE", "insightface-arcface")
FACE_MODEL = os.getenv("CIPHER_FACE_MODEL", "buffalo_l")
FACE_MODEL_VERSION = os.getenv("CIPHER_FACE_MODEL_VERSION", FACE_MODEL)
FACE_MODEL_ROOT = os.getenv("CIPHER_FACE_MODEL_ROOT", "").strip() or os.path.expanduser("~/.insightface")
FACE_CTX_ID = int(os.getenv("CIPHER_FACE_CTX_ID", "-1"))
# Backward-compatible names used by the existing API/UI.
ENGINE = FACE_ENGINE
MODEL_VERSION = FACE_MODEL_VERSION


@lru_cache(maxsize=1)
def _face_app():
    # Reuse the canonical engine from face_engine.py. This prevents the polished
    # Face Intelligence routes from downloading/initializing a second, separate
    # model pack and keeps provider/model configuration consistent.
    try:
        from .face_engine import _engine
        app, _name = _engine()
    except Exception as exc:
        raise RuntimeError(f"Unable to initialize InsightFace/ArcFace: {exc}") from exc
    if app is None:
        raise RuntimeError(
            "InsightFace/ArcFace is not ready. Install the CIPHER AI dependencies "
            "and allow the configured model pack to be downloaded. "
            f"Expected model root: {FACE_MODEL_ROOT}"
        )
    return app


def engine_status() -> dict:
    status = {"engine": FACE_ENGINE, "model": FACE_MODEL, "model_version": FACE_MODEL_VERSION, "ready": False}
    try:
        _face_app()
        status["ready"] = True
    except Exception as exc:
        status["error"] = str(exc)
    return status


def _decode(image_bytes: bytes):
    try:
        import cv2
        import numpy as np
    except ImportError as exc:
        raise RuntimeError("OpenCV/NumPy are required for ArcFace image processing. Run INSTALL_ARCFACE.bat.") from exc
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("The uploaded file is not a readable image")
    return image


def detect_face(image_bytes: bytes):
    import numpy as np
    image = _decode(image_bytes)
    try:
        faces = _face_app().get(image)
    except RuntimeError:
        raise
    except Exception as exc:
        raise ValueError(f"Face analysis failed: {exc}") from exc
    if not faces:
        raise ValueError("No face was detected. Use a clearer photograph with one visible face.")
    # For investigative matching, require a single dominant face. If several are
    # present, choose the largest but surface that choice through the bbox only.
    face = max(faces, key=lambda f: float((f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1])))
    embedding = np.asarray(face.embedding, dtype=np.float32).reshape(-1)
    embedding = _normalise(embedding)
    if embedding.size < 128 or not np.isfinite(embedding).all():
        raise ValueError("ArcFace returned an invalid face embedding")
    x1, y1, x2, y2 = [int(v) for v in face.bbox]
    return embedding, (x1, y1, max(1, x2-x1), max(1, y2-y1))


def _normalise(vec):
    import numpy as np
    vec = np.asarray(vec, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(vec))
    return vec / norm if norm > 1e-8 else vec


def encode(vec) -> str:
    return json.dumps([round(float(x), 8) for x in _normalise(vec)])


def decode(raw: str):
    import numpy as np
    return _normalise(np.asarray(json.loads(raw), dtype=np.float32))


def similarity(a, b) -> float:
    a, b = _normalise(a), _normalise(b)
    if a.size != b.size:
        return 0.0
    # ArcFace embeddings are compared with cosine similarity. Keep the raw
    # cosine-derived percentage visible; do not fabricate calibration.
    cos = float(np.dot(a, b))
    return max(0.0, min(1.0, cos))


def match_profiles(query_vec: np.ndarray, rows: list[Any], limit: int = 5) -> list[dict]:
    out = []
    for row in rows:
        try:
            if str(row["embedding_engine"]) != FACE_ENGINE:
                continue
            score = similarity(query_vec, decode(row["embedding_json"]))
        except Exception:
            continue
        out.append({"profile": dict(row), "similarity": round(score*100, 1)})
    out.sort(key=lambda x: x["similarity"], reverse=True)
    return out[:max(1, limit)]


def search_case_gallery(case_id:int, image_bytes:bytes, evidence_id:int|None=None, limit:int=5):
    """Search the canonical integer face_profiles gallery and create pending review records."""
    import uuid, json
    query_vec,bbox=detect_face(image_bytes)
    conn=get_db()
    try:
        rows=conn.execute("SELECT * FROM face_profiles WHERE case_id=? AND active=1 ORDER BY id",(case_id,)).fetchall()
        scored=[]
        for row in rows:
            try:
                if str(row['embedding_engine']) != FACE_ENGINE: continue
                score=similarity(query_vec,decode(row['embedding_json']))
                scored.append((score,dict(row)))
            except Exception:
                continue
        scored.sort(key=lambda x:x[0],reverse=True)
        threshold=float(os.getenv('CIPHER_FACE_MATCH_THRESHOLD','0.45'))
        matches=[]
        for score,p in scored[:max(1,min(int(limit or 5),10))]:
            if score < threshold: continue
            match_id=f"MATCH-{uuid.uuid4().hex}"
            review_payload={"face_match_id":match_id,"profile_id":p['id'],"label":p.get('display_name'),"entity_id":p.get('entity_id'),"similarity":score,"model":FACE_MODEL_VERSION,"threshold":threshold}
            conn.execute("INSERT INTO face_matches (id,case_id,evidence_id,face_profile_id,candidate_entity_id,similarity,model_name,status,source_reference) VALUES (?,?,?,?,?,?,?,?,?)",
                         (match_id,case_id,evidence_id,p['id'],p.get('entity_id'),score,FACE_MODEL_VERSION,'PENDING','vision-face-search'))
            review_cur=conn.execute("INSERT INTO review_items (case_id,type,suggestion_type,title,description,entity_id,evidence_id,source_document,source_reference,extracted_context,ai_output,confidence_score,confidence,status,priority,source_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                         (case_id,'face','FACE_MATCH',f"Face candidate: {p.get('display_name') or 'Potential match'}",
                          'ArcFace similarity candidate. Identity is not verified automatically; investigator review is required.',p.get('entity_id'),evidence_id,str(p.get('display_name') or 'Face Reference Dataset'),'vision-face-search',f"similarity={score:.6f}; threshold={threshold:.2f}",json.dumps(review_payload),score,score,'PENDING','HIGH' if score>=0.80 else 'MEDIUM','VISION'))
            matches.append({"match_id":match_id,"profile_id":p['id'],"label":p.get('display_name'),"entity_id":p.get('entity_id'),"similarity":round(score*100,1),"status":"PENDING","review_id":review_cur.lastrowid})
        conn.commit()
        return {"model":FACE_MODEL_VERSION,"query_quality":1.0,"face_box":bbox,"gallery_size":len(rows),"threshold":threshold,"matches":matches}
    finally:
        conn.close()
