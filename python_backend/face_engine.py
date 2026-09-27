"""Production InsightFace/ArcFace face recognition for CIPHER.

The engine is optional at import time but never silently substitutes a fake
identity model. If InsightFace/ONNX Runtime or the buffalo model pack is not
available, health() reports the exact installation/model state and API calls
return an actionable error. Image evidence itself is still preserved by the
canonical evidence pipeline.
"""
from __future__ import annotations
import json, os, uuid, traceback
from pathlib import Path
import numpy as np
from .db import get_db

_ENGINE = None
_ENGINE_NAME = None
_ENGINE_ERROR = None
_ENGINE_READY = False

def _uid(prefix): return f"{prefix}-{uuid.uuid4().hex}"

def _engine(force_retry: bool=False):
    global _ENGINE, _ENGINE_NAME, _ENGINE_ERROR, _ENGINE_READY
    if _ENGINE is not None and _ENGINE_READY:
        return _ENGINE, _ENGINE_NAME
    if force_retry:
        _ENGINE = None; _ENGINE_NAME = None; _ENGINE_ERROR = None; _ENGINE_READY = False
    try:
        from insightface.app import FaceAnalysis
    except Exception as exc:
        _ENGINE_ERROR = f"InsightFace import failed: {type(exc).__name__}: {exc}"
        _ENGINE_NAME = "unavailable:insightface"
        return None, _ENGINE_NAME
    model_name = os.getenv("CIPHER_FACE_MODEL", "buffalo_l").strip() or "buffalo_l"
    model_root = os.getenv("CIPHER_FACE_MODEL_ROOT", "").strip() or None
    providers = [p.strip() for p in os.getenv("CIPHER_FACE_PROVIDERS", "CPUExecutionProvider").split(",") if p.strip()]
    try:
        kwargs = {"name": model_name, "providers": providers}
        if model_root:
            kwargs["root"] = model_root
        app = FaceAnalysis(**kwargs)
        app.prepare(ctx_id=0, det_size=(640, 640))
        _ENGINE = app
        _ENGINE_NAME = f"insightface-arcface:{model_name}"
        _ENGINE_ERROR = None
        _ENGINE_READY = True
        return _ENGINE, _ENGINE_NAME
    except Exception as exc:
        _ENGINE = None
        _ENGINE_READY = False
        _ENGINE_ERROR = f"Face model initialization failed: {type(exc).__name__}: {exc}"
        _ENGINE_NAME = f"unavailable:{model_name}"
        return None, _ENGINE_NAME

def health():
    app, name = _engine()
    if app is not None:
        return {"available": True, "ready": True, "model": name, "provider": "InsightFace + ArcFace", "message": "Face engine ready. Matches remain pending until investigator review."}
    err = _ENGINE_ERROR or "Unknown face engine initialization error"
    return {
        "available": False, "ready": False, "model": name,
        "provider": "InsightFace + ArcFace",
        "error": err,
        "install": "python -m pip install -r python_backend/requirements-ai.txt",
        "bootstrap": "python -m python_backend.face_preflight",
        "message": "Face recognition is unavailable until InsightFace, ONNX Runtime, OpenCV and the configured model pack are installed and load successfully."
    }

def preflight():
    _engine(force_retry=True)
    h = health()
    if not h["available"]:
        return {"status":"FAILED", **h}
    return {"status":"READY", **h}

def _embeddings(image_bytes: bytes):
    import cv2
    app, name = _engine()
    if app is None:
        raise RuntimeError((_ENGINE_ERROR or "Face engine unavailable") + ". Run: python -m python_backend.face_preflight")
    arr = np.frombuffer(image_bytes, np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Invalid image file. Use PNG, JPG or WEBP.")
    faces = app.get(image)
    if not faces:
        raise ValueError("No face detected in the supplied image.")
    output=[]
    for face in faces:
        emb=np.asarray(face.embedding,dtype=np.float32)
        norm=float(np.linalg.norm(emb))
        if norm <= 1e-8: continue
        emb=emb/norm
        output.append((emb,float(getattr(face,"det_score",0.0))))
    if not output:
        raise ValueError("Face detected but no valid ArcFace embedding was produced.")
    output.sort(key=lambda x:x[1], reverse=True)
    return output,name

def _embedding(image_bytes: bytes):
    embeddings,name=_embeddings(image_bytes)
    if len(embeddings) != 1:
        raise ValueError(f"Enrollment requires exactly one visible face; detected {len(embeddings)}. Use a single-person reference photo.")
    emb,q=embeddings[0]
    return emb,q,name,len(embeddings)

def enroll(case_id:int,label:str,image_bytes:bytes,source_evidence_id=None,entity_id=None):
    label=str(label or "").strip()
    if not label: raise ValueError("Reference person label is required.")
    emb,q,model,count=_embedding(image_bytes)
    pid=_uid("FACE")
    conn=get_db()
    try:
        conn.execute("INSERT INTO face_profiles(id,case_id,entity_id,label,source_evidence_id,status,model_name) VALUES (?,?,?,?,?,?,?)",(pid,case_id,entity_id,label,source_evidence_id,"ACTIVE",model))
        conn.execute("INSERT INTO face_embeddings(id,face_profile_id,case_id,source_evidence_id,model_name,vector_json,quality_score) VALUES (?,?,?,?,?,?,?)",(_uid("EMB"),pid,case_id,source_evidence_id,model,json.dumps(emb.tolist()),q))
        conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)",(case_id,"FACE_PROFILE_ENROLLED","face_profile",pid,"investigator",f"Reference enrolled with {model}; quality={q:.4f}","SUCCESS"))
        conn.commit()
    finally: conn.close()
    return {"profile_id":pid,"label":label,"quality":q,"faces_detected":count,"model":model,"status":"ACTIVE"}

def search(case_id:int,image_bytes:bytes,source_evidence_id=None,limit=5):
    query_faces,model=_embeddings(image_bytes)
    conn=get_db(); rows=conn.execute("SELECT p.*,e.vector_json FROM face_profiles p JOIN face_embeddings e ON e.face_profile_id=p.id WHERE p.case_id=? AND p.status='ACTIVE'",(case_id,)).fetchall(); conn.close()
    threshold=float(os.getenv("CIPHER_FACE_MATCH_THRESHOLD","0.45"))
    scored=[]
    for r in rows:
        v=np.asarray(json.loads(r["vector_json"]),dtype=np.float32); norm=float(np.linalg.norm(v));
        if norm <= 1e-8: continue
        v/=norm
        best=max(float(np.dot(qemb,v)) for qemb,_ in query_faces)
        scored.append((best,dict(r)))
    scored.sort(reverse=True,key=lambda x:x[0]); results=[]; conn=get_db()
    try:
        for sim,r in scored[:max(1,int(limit))]:
            if sim < threshold: continue
            mid=_uid("MATCH")
            conn.execute("INSERT INTO face_matches(id,case_id,evidence_id,face_profile_id,candidate_entity_id,similarity,model_name,status,source_reference) VALUES (?,?,?,?,?,?,?,?,?)",(mid,case_id,source_evidence_id,r["id"],r.get("entity_id"),sim,model,"PENDING","face-search"))
            conn.execute("""INSERT INTO review_items (case_id,type,suggestion_type,title,description,entity_id,evidence_id,source_document,source_reference,extracted_context,ai_output,confidence_score,confidence,status,priority,source_type)
                           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",(case_id,"face","FACE_MATCH",f"Face candidate: {r['label']}","ArcFace similarity candidate; identity is not verified automatically.",r.get("entity_id"),source_evidence_id,str(r.get("label") or "face-profile"),"face-search",f"similarity={sim:.6f}; threshold={threshold:.2f}",json.dumps({"face_match_id":mid,"profile_id":r["id"],"label":r["label"],"entity_id":r.get("entity_id"),"similarity":sim,"model":model,"threshold":threshold}),min(max(sim,0.0),1.0),min(max(sim,0.0),1.0),"PENDING","HIGH" if sim>=0.80 else "MEDIUM","FACE_AI"))
            results.append({"match_id":mid,"profile_id":r["id"],"label":r["label"],"entity_id":r.get("entity_id"),"similarity":round(sim,6),"status":"PENDING"})
        conn.commit()
    finally: conn.close()
    return {"model":model,"query_quality":query_faces[0][1] if query_faces else 0.0,"faces_detected":len(query_faces),"threshold":threshold,"matches":results}
