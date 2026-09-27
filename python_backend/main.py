import os
import sys
import math
import csv
import io
import json
import time
import datetime
import hashlib
import secrets
import hmac
import re
from typing import Optional, List, Dict, Any
from collections import deque
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response, HTTPException, Depends, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse, PlainTextResponse
from pydantic import BaseModel

load_dotenv(os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")), ".env"))

# ============================================================
# CONFIGURATION & INITIALIZATION
# ============================================================
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(BASE_DIR, ".env"))
SECRET_KEY = os.getenv("SECRET_KEY") or "dev-only-change-me"
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
ALGORITHM = "HS256"
ML_MODEL_URL = (os.getenv("AI_MODEL_URL") or os.getenv("ML_MODEL_URL") or "").strip().rstrip("/")


def resolve_config_path(value: str | None, default_name: str) -> str:
    raw = (value or "").strip()
    path = os.path.expanduser(raw) if raw else default_name
    if not os.path.isabs(path):
        path = os.path.join(BASE_DIR, path)
    return os.path.abspath(path)


UPLOADS_DIR = resolve_config_path(os.getenv("CIPHER_UPLOADS_DIR"), "uploads")
FRONTEND_DIR = resolve_config_path(os.getenv("CIPHER_FRONTEND_DIR"), "frontend")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(10 * 1024 * 1024)))
SEED_DEMO_DATA = os.getenv("SEED_DEMO_DATA", "false").lower() == "true"
NEO4J_REQUIRED_FOR_GRAPH = os.getenv("NEO4J_REQUIRED_FOR_GRAPH", "false").lower() == "true" and bool(os.getenv("NEO4J_URI", "").strip() and os.getenv("NEO4J_USERNAME", "").strip() and os.getenv("NEO4J_PASSWORD", "").strip())
os.makedirs(UPLOADS_DIR, exist_ok=True)

from .db import get_db, init_database
from .evidence_service import process_evidence_file
from .evidence_pipeline import process_document as process_evidence_document
from . import neo4j_graph
from .storage import configured as storage_configured, upload_bytes, download_uri, health_check as storage_health_check
from .ml_link_prediction import build_case_graph, predict_pair, rank_candidates
from .schema_extensions import init_extensions
from .rag_engine import index_document, index_text_document, search as rag_search, reindex_case, rag_health
from .face_engine import health as face_health, enroll as face_enroll, search as face_search
from .face_intelligence import detect_face, encode, match_profiles, engine_status as face_engine_status, ENGINE as FACE_ENGINE, MODEL_VERSION as FACE_MODEL_VERSION, search_case_gallery
from .face_dataset import inspect_dataset as inspect_face_dataset, ingest_dataset as ingest_face_dataset, ingest_reference_images as ingest_face_reference_images, derive_reference_key, _find_entity, _ensure_entity
from .investigation_engine import build_package as build_investigation_package, answer as fusion_answer
from .entity_resolution import resolve_case as resolve_case_entities
from .evidence_intelligence import extract_case_records, add_highlight, documents_for_kind

# Ensure the configured database exists and matches the Python API contract.
init_database()
init_extensions()

# ============================================================
# FASTAPI APP
# ============================================================
app = FastAPI(
    title="CIPHER - Criminal Intelligence & Pattern Heuristic Engine",
    description="Unified Python Backend for Criminal Analysis Platform",
    version="2.0.0"
)

_cors_raw = os.getenv("CIPHER_CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080,http://127.0.0.1:8080").strip()
CORS_ORIGINS = [o.strip().rstrip("/") for o in _cors_raw.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper functions
def _b64e(value: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")

def _b64d(value: str) -> bytes:
    import base64
    return base64.urlsafe_b64decode(value + "=" * ((4 - len(value) % 4) % 4))

def hash_password(password: str) -> str:
    salt=secrets.token_bytes(16); rounds=310000
    dk=hashlib.pbkdf2_hmac("sha256", password.encode(), salt, rounds)
    return f"pbkdf2_sha256${rounds}${_b64e(salt)}${_b64e(dk)}"

def verify_password(plain: str, hashed: str) -> bool:
    try:
        scheme, rounds, salt, digest = hashed.split("$",3)
        if scheme != "pbkdf2_sha256": return False
        dk=hashlib.pbkdf2_hmac("sha256", plain.encode(), _b64d(salt), int(rounds))
        return hmac.compare_digest(dk, _b64d(digest))
    except Exception:
        return False

def _jwt_encode(payload: dict) -> str:
    import base64, json
    def enc(obj):
        return base64.urlsafe_b64encode(json.dumps(obj,separators=(",",":"),ensure_ascii=False).encode()).rstrip(b"=").decode()
    h=enc({"alg":"HS256","typ":"JWT"}); p=enc(payload)
    sig=hmac.new(SECRET_KEY.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    return f"{h}.{p}.{_b64e(sig)}"

def _jwt_decode(token: str) -> dict:
    parts=token.split(".")
    if len(parts)!=3: raise ValueError("Invalid token")
    signing=f"{parts[0]}.{parts[1]}".encode()
    expected=hmac.new(SECRET_KEY.encode(), signing, hashlib.sha256).digest()
    if not hmac.compare_digest(expected,_b64d(parts[2])): raise ValueError("Invalid signature")
    payload=json.loads(_b64d(parts[1]).decode())
    if int(payload.get("exp",0)) < int(time.time()): raise ValueError("Expired token")
    return payload

def create_access_token(data: dict, expires_delta: int = 3600) -> str:
    payload=dict(data); payload["exp"]=int(time.time())+int(expires_delta)
    return _jwt_encode(payload)

def get_current_user(request: Request):
    auth=request.headers.get("Authorization","")
    if not auth.startswith("Bearer "): raise HTTPException(status_code=401, detail="Authentication required")
    token=auth.split(" ",1)[1].strip()
    try: payload=_jwt_decode(token)
    except Exception as exc: raise HTTPException(status_code=401, detail="Invalid or expired token") from exc
    user_id=payload.get("sub")
    if not user_id: raise HTTPException(status_code=401, detail="Invalid token subject")
    conn=get_db(); user=conn.execute("SELECT * FROM users WHERE id = ?",(int(user_id),)).fetchone(); conn.close()
    if not user: raise HTTPException(status_code=401, detail="User not found")
    return dict(user)

PUBLIC_PREFIXES = (
    "/api/health", "/health", "/api/health/ai", "/api/ai/health", "/health/ai", "/api/config", "/api/status", "/api/db-test", "/db-test", "/api/capabilities",
    "/api/auth/login", "/auth/login", "/api/auth/register", "/auth/register",
    "/static/",
)

@app.middleware("http")
async def protect_investigation_routes(request: Request, call_next):
    path = request.url.path
    # Public landing/auth/health/config routes remain accessible without a token.
    if path.startswith(PUBLIC_PREFIXES) or not (path.startswith("/api/") or path.startswith("/cases") or path.startswith("/review") or path.startswith("/admin-test") or path.startswith("/investigator-test") or path.startswith("/analysis-test") or path.startswith("/supervisor-test")):
        return await call_next(request)
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return Response(content=json.dumps({"detail":"Authentication required"}), status_code=401, media_type="application/json")
    try:
        payload = _jwt_decode(auth.split(" ",1)[1].strip())
        user_id = int(payload.get("sub"))
    except Exception:
        return Response(content=json.dumps({"detail":"Invalid or expired token"}), status_code=401, media_type="application/json")

    # Defense in depth: every case-scoped URL is authorized against the owner in
    # the database. Route-level Depends(get_current_user) is still kept for the
    # existing handlers, but a forgotten dependency can no longer expose another
    # customer's case data.
    case_match = re.search(r"/(?:api/)?cases/(\d+)(?:/|$)", path)
    if case_match:
        case_id = int(case_match.group(1))
        conn = None
        try:
            conn = get_db()
            row = conn.execute("SELECT created_by FROM cases WHERE id=?", (case_id,)).fetchone()
            if not row:
                return Response(content=json.dumps({"detail":"Case not found"}), status_code=404, media_type="application/json")
            owner_id = row["created_by"]
            # Admins may retain operational access; normal investigators are
            # strictly isolated to cases they created.
            role = str(payload.get("role") or "").upper()
            if role != "ADMIN" and int(owner_id) != user_id:
                return Response(content=json.dumps({"detail":"You do not have access to this case"}), status_code=403, media_type="application/json")
        except Exception as exc:
            return Response(content=json.dumps({"detail":"Unable to authorize case access"}), status_code=500, media_type="application/json")
        finally:
            try:
                if conn: conn.close()
            except Exception: pass

    # Review routes that only contain a review id must also resolve back to the
    # owning case before the handler runs.
    review_match = re.search(r"/(?:api/)?review/(\d+)(?:/|$)", path)
    if review_match:
        review_id = int(review_match.group(1))
        conn = None
        try:
            conn = get_db()
            row = conn.execute("SELECT c.created_by FROM review_items r JOIN cases c ON c.id=r.case_id WHERE r.id=?", (review_id,)).fetchone()
            if not row:
                return Response(content=json.dumps({"detail":"Review item not found"}), status_code=404, media_type="application/json")
            if str(payload.get("role") or "").upper() != "ADMIN" and int(row["created_by"]) != user_id:
                return Response(content=json.dumps({"detail":"You do not have access to this review item"}), status_code=403, media_type="application/json")
        except Exception:
            return Response(content=json.dumps({"detail":"Unable to authorize review access"}), status_code=500, media_type="application/json")
        finally:
            try:
                if conn: conn.close()
            except Exception: pass
    return await call_next(request)


def require_case(conn, case_id: int):
    row = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Case not found")
    return row


def _raise_db_http(action: str, exc: Exception):
    # Keep secrets out of the response while making local debugging actionable.
    detail = str(exc).replace(DATABASE_URL, "<DATABASE_URL>") if DATABASE_URL else str(exc)
    print(f"[CIPHER DB ERROR] {action}: {type(exc).__name__}: {detail}")
    raise HTTPException(status_code=500, detail=f"Database error while {action}: {detail[:900]}") from exc

# ============================================================
# SYSTEM HEALTH & STATUS
@app.get("/api/config")
def public_config():
    return {
        "backend": "python-fastapi",
        "version": "2.1.0",
        "database": "postgresql" if DATABASE_URL else "sqlite",
        "llm_provider": os.getenv("LLM_PROVIDER", "auto"),
        "llm_fallback_order": [x.strip() for x in os.getenv("LLM_FALLBACK_ORDER", "gemini,openrouter,ollama").split(",") if x.strip()],
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "openrouter_configured": bool(os.getenv("OPENROUTER_API_KEY")),
        "groq_configured": bool(os.getenv("GROQ_API_KEY")),
        "neo4j_configured": neo4j_graph.configured(),
        "neo4j_required_for_graph": NEO4J_REQUIRED_FOR_GRAPH,
        "frontend_exists": os.path.exists(os.path.join(FRONTEND_DIR, "index.html")),
        "master_csv_import": True,
        "ollama_enabled": os.getenv("OLLAMA_ENABLED","true").lower()=="true",
        "ollama_model": os.getenv("OLLAMA_MODEL","qwen3:8b"),
        "external_ml_model_url": ML_MODEL_URL or None,
    }

# ============================================================
@app.get("/api/health")
@app.get("/health")
def health():
    db_ok = True
    db_error = None
    try:
        conn = get_db(); conn.execute("SELECT 1").fetchone(); conn.close()
    except Exception as exc:
        db_ok = False; db_error = f"{type(exc).__name__}: {str(exc)[:500]}"
    storage = storage_health_check()
    status = "healthy" if db_ok and storage.get("ok", not storage_configured()) else "degraded"
    return {"status": status, "database": "postgresql" if DATABASE_URL else "sqlite", "database_ok": db_ok, "database_error": db_error, "storage": storage}

@app.get("/api")
@app.get("/api/status")
def status_endpoint():
    return {
        "status": "online",
        "system": "CIPHER Backend (Python FastAPI)",
        "version": "2.0.0",
        "message": "AI-Powered Criminal Network Analysis System is operational"
    }

@app.get("/api/db-test")
@app.get("/db-test")
def db_test():
    conn = get_db()
    conn.execute("SELECT 1").fetchone()
    conn.close()
    return {"status": "success", "message": "Database connection successful"}

@app.get("/api/health/storage")
def health_storage():
    return storage_health_check()

@app.get("/api/health/neo4j")
@app.get("/health/neo4j")
def health_neo4j():
    result = neo4j_graph.verify_connectivity()
    if result.get("configured"):
        try:
            neo4j_graph.ensure_schema()
        except Exception as exc:
            result["status"] = "error"
            result["error"] = f"{type(exc).__name__}: {exc}"
    return result

@app.get("/api/capabilities")
def capabilities():
    return {
        "status": "success",
        "backend": "FastAPI Python",
        "authentication": ["register", "login", "auth/me"],
        "evidence": ["TXT", "CSV", "PDF", "JPG", "JPEG", "PNG", "WEBP", "FACE_REFERENCE_DATASET_ZIP", "SHA-256", "AI/extraction processing"],
        "workflow": ["case", "evidence", "face_reference_dataset", "vision_candidate_match", "human_review", "verified_person", "network_propagation", "gis_propagation", "timeline", "reports", "audit"],
        "graph": ["graph", "neighbors", "shortest_path", "degree_centrality", "communities", "patterns"],
        "review": ["accept", "edit", "reject", "merge", "bulk_accept"],
        "diagnostics": ["health", "health/deep", "case_diagnostics", "neo4j"],
        "graph_store": "neo4j" if neo4j_graph.configured() else "relational_fallback",
        "master_csv_import": True,
    }

@app.get("/api/health/deep")
def deep_health(user: dict = Depends(get_current_user)):
    conn = get_db()
    tables = ["users","cases","documents","entities","relationships","locations","spatial_events","timeline_events","review_items","review_actions","audit_log","ai_conversations","ai_messages"]
    counts = {}; missing=[]
    for table in tables:
        try:
            counts[table]=int(conn.execute(f"SELECT COUNT(*) AS c FROM {table}").fetchone()["c"])
        except Exception:
            missing.append(table)
    conn.close()
    neo = neo4j_graph.verify_connectivity() if neo4j_graph.configured() else {"configured": False, "status": "not_configured"}
    return {"status":"healthy" if not missing else "degraded","database":"postgresql" if DATABASE_URL else "sqlite","database_url_configured":bool(DATABASE_URL),"gemini_configured":bool(os.getenv("GEMINI_API_KEY")),"groq_configured":bool(os.getenv("GROQ_API_KEY")),"neo4j":neo,"frontend_exists":os.path.exists(os.path.join(FRONTEND_DIR,"index.html")),"uploads_writable":os.path.isdir(UPLOADS_DIR) and os.access(UPLOADS_DIR,os.W_OK),"storage_configured":storage_configured(),"table_counts":counts,"missing_tables":missing}

@app.get("/api/health/ai")
@app.get("/api/ai/health")
@app.get("/health/ai")
def health_ai():
    from .investigation_engine import _provider_order
    ollama_base=os.getenv("OLLAMA_BASE_URL","http://127.0.0.1:11434").rstrip("/")
    ollama_model=os.getenv("OLLAMA_MODEL","qwen3:8b")
    results={
        "primary_provider": os.getenv("LLM_PROVIDER","auto"),
        "fallback_order": _provider_order(),
        "ollama_base_url":ollama_base,
        "ollama_model":ollama_model,
        "ollama_configured":os.getenv("OLLAMA_ENABLED","true").lower()=="true",
        "ollama":"not_configured",
        "gemini_configured":bool(os.getenv("GEMINI_API_KEY")),
        "openrouter_configured":bool(os.getenv("OPENROUTER_API_KEY")),
        "groq_configured":bool(os.getenv("GROQ_API_KEY")),
        "gemini":"configured" if os.getenv("GEMINI_API_KEY") else "not_configured",
        "openrouter":"configured" if os.getenv("OPENROUTER_API_KEY") else "not_configured",
        "groq":"not_checked",
    }
    if results["ollama_configured"]:
        try:
            probe=requests.get(f"{ollama_base}/api/tags",timeout=5)
            if probe.ok:
                models={str(m.get("name")) for m in (probe.json().get("models") or []) if isinstance(m,dict)}
                results["ollama"]="reachable" if ollama_model in models or any(str(x).split(":")[0]==ollama_model.split(":")[0] for x in models) else "reachable_model_missing"
                results["ollama_models"] = sorted(models)[:50]
            else:
                results["ollama"]=f"http_{probe.status_code}"
        except Exception as exc:
            results["ollama"]=f"error:{type(exc).__name__}"
    available=[]
    if results["gemini_configured"]: available.append("gemini")
    if results["openrouter_configured"]: available.append("openrouter")
    if results["ollama"]=="reachable": available.append("ollama")
    results["available_configured_providers"]=available
    results["status"]="healthy" if available else "degraded"
    return results
@app.get("/api/cases/{case_id}/data-summary")
def case_data_summary(case_id: int, user: dict = Depends(get_current_user)):
    conn = get_db(); require_case(conn, case_id)
    counts = {}
    for table in ("documents", "entities", "relationships", "locations", "timeline_events", "review_items", "audit_log"):
        row = conn.execute(f"SELECT COUNT(*) AS c FROM {table} WHERE case_id=?", (case_id,)).fetchone()
        counts[table] = int(row["c"]) if row else 0
    verified = {}
    for table in ("entities", "relationships", "locations", "timeline_events"):
        row = conn.execute(f"SELECT COUNT(*) AS c FROM {table} WHERE case_id=? AND verification_status='verified'", (case_id,)).fetchone()
        verified[table] = int(row["c"]) if row else 0
    conn.close()
    return {"status":"success", "case_id":case_id, "counts":counts, "verified":verified}

@app.get("/api/cases/{case_id}/diagnostics")
def case_diagnostics(case_id: int, user: dict = Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id)
    checks={}
    checks["orphan_relationships"]=int(conn.execute("SELECT COUNT(*) AS c FROM relationships r LEFT JOIN entities s ON s.id=r.source_entity_id LEFT JOIN entities t ON t.id=r.target_entity_id WHERE r.case_id=? AND (s.id IS NULL OR t.id IS NULL)",(case_id,)).fetchone()["c"])
    checks["pending_review"]=int(conn.execute("SELECT COUNT(*) AS c FROM review_items WHERE case_id=? AND UPPER(status)='PENDING'",(case_id,)).fetchone()["c"])
    checks["verified_entities"]=int(conn.execute("SELECT COUNT(*) AS c FROM entities WHERE case_id=? AND verification_status='verified'",(case_id,)).fetchone()["c"])
    checks["verified_relationships"]=int(conn.execute("SELECT COUNT(*) AS c FROM relationships WHERE case_id=? AND verification_status='verified'",(case_id,)).fetchone()["c"])
    checks["entities_with_location"]=int(conn.execute("SELECT COUNT(*) AS c FROM entities WHERE case_id=? AND latitude IS NOT NULL AND longitude IS NOT NULL",(case_id,)).fetchone()["c"])
    checks["timeline_events"]=int(conn.execute("SELECT COUNT(*) AS c FROM timeline_events WHERE case_id=?",(case_id,)).fetchone()["c"])
    checks["evidence_documents"]=int(conn.execute("SELECT COUNT(*) AS c FROM documents WHERE case_id=?",(case_id,)).fetchone()["c"])
    conn.close(); return {"status":"success","case_id":case_id,"checks":checks}

# ============================================================
# AUTHENTICATION
# ============================================================
@app.post("/auth/register")
@app.post("/api/auth/register")
async def register(request: Request):
    data = await request.json()
    full_name = data.get("full_name") or data.get("username")
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    role = "INVESTIGATOR"  # Public registration cannot self-assign privileged roles

    if not full_name or not email or not password:
        raise HTTPException(status_code=400, detail="Missing required fields")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE LOWER(email) = LOWER(?)", (email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")

    h = hash_password(password)
    cur = conn.execute("INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)",
                       (full_name, email, h, role))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return {
        "status": "success",
        "message": "User registered successfully",
        "user": {"id": new_id, "full_name": full_name, "email": email, "role": role}
    }

@app.post("/auth/login")
@app.post("/api/auth/login")
async def login(request: Request):
    data = await request.json()
    identifier = data.get("email") or data.get("username")
    password = data.get("password")

    if not identifier or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", (identifier,)).fetchone()
    
    if not user:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(password, user["password_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_dict = dict(user)
    conn.close()
    token = create_access_token({"sub": str(user_dict["id"]), "email": user_dict["email"], "role": user_dict["role"]})
    return {
        "status": "success",
        "message": "Login successful",
        "access_token": token,
        "token": token,
        "token_type": "bearer",
        "user": {
            "id": user_dict["id"],
            "full_name": user_dict["full_name"],
            "email": user_dict["email"],
            "role": user_dict["role"]
        }
    }

@app.get("/auth/me")
@app.get("/api/auth/me")
def auth_me(user: dict = Depends(get_current_user)):
    safe_user = {k: user.get(k) for k in ("id", "full_name", "email", "role", "created_at")}
    return {"status": "success", "user": safe_user}

@app.get("/admin-test")
@app.get("/api/admin-test")
@app.get("/investigator-test")
@app.get("/api/investigator-test")
@app.get("/analysis-test")
@app.get("/api/analysis-test")
@app.get("/supervisor-test")
@app.get("/api/supervisor-test")
def role_test(request: Request, user: dict = Depends(get_current_user)):
    route = request.url.path.lower()
    required = "admin" if "admin-test" in route else "investigator" if "investigator-test" in route else "analyst" if "analysis-test" in route else "supervisor"
    if user.get("role", "").upper() not in {required.upper(), "ADMIN"}:
        raise HTTPException(status_code=403, detail="You do not have permission to access this resource")
    return {"message": f"{required.capitalize()} access granted"}

# ============================================================
# CASES MANAGEMENT
# ============================================================
@app.post("/cases")
@app.post("/api/cases")
async def create_case(request: Request, user: dict = Depends(get_current_user)):
    data = await request.json()
    case_num = data.get("case_number") or data.get("caseNumber") or data.get("caseId") or data.get("case_id")
    title = data.get("title") or data.get("caseName")
    desc = data.get("description") or data.get("caseDescription") or ""
    priority = (data.get("priority") or data.get("casePriority") or "MEDIUM").upper()
    case_type = data.get("case_type") or data.get("caseType") or "Financial Crime"
    incident_date = data.get("incident_date") or data.get("incidentDate")
    primary_location = data.get("primary_location") or data.get("primaryLocation") or "Central Division"
    assigned_officer = data.get("assigned_officer") or data.get("assignedOfficer") or (user.get("full_name") if user else None) or "Investigating Officer"
    jurisdiction = data.get("jurisdiction") or (user.get("jurisdiction") if user else None) or "Central Division"
    tags = data.get("tags")
    if isinstance(tags, list):
        tags = ", ".join(tags)

    conn = get_db()
    if not case_num:
        cnt = conn.execute("SELECT COUNT(*) as c FROM cases WHERE created_by=?", (user.get("id"),)).fetchone()
        next_n = (cnt["c"] if cnt else 0) + 14
        case_num = f"C-2026-{str(next_n).zfill(3)}"

    if not title:
        conn.close()
        raise HTTPException(status_code=400, detail="Case title is required")

    existing = conn.execute("SELECT id FROM cases WHERE case_number = ?", (case_num,)).fetchone()
    if existing:
        case_num = f"{case_num}-{int(time.time()) % 10000}"

    try:
        sql = """
            INSERT INTO cases (case_number, title, description, priority, status, created_by, case_type, incident_date, primary_location, assigned_officer, jurisdiction, tags)
            VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, ?, ?)
        """
        if DATABASE_URL:
            cur = conn.execute(sql.rstrip() + " RETURNING *", (case_num, title, desc, priority, user.get("id", 1), case_type, incident_date, primary_location, assigned_officer, jurisdiction, tags))
            new_case = cur.fetchone()
        else:
            cur = conn.execute(sql, (case_num, title, desc, priority, user.get("id", 1), case_type, incident_date, primary_location, assigned_officer, jurisdiction, tags))
            new_case = conn.execute("SELECT * FROM cases WHERE id = ?", (cur.lastrowid,)).fetchone()
        conn.commit()
    except Exception as exc:
        try: conn.rollback()
        except Exception: pass
        try: conn.close()
        except Exception: pass
        _raise_db_http("creating case", exc)
    conn.close()
    if not new_case:
        raise HTTPException(status_code=500, detail="Database inserted the case but returned no row")
    return {"status": "success", "message": "Case created successfully", "case": dict(new_case)}

@app.get("/cases")
@app.get("/api/cases")
def list_cases(user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute("SELECT * FROM cases WHERE created_by = ? ORDER BY created_at DESC", (user.get("id"),)).fetchall()
    conn.close()
    cases = [dict(r) for r in rows]
    return {"status": "success", "count": len(cases), "cases": cases}

@app.get("/cases/{case_id}")
@app.get("/api/cases/{case_id}")
def get_case(case_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    c = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
    conn.close()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    return {"status": "success", "case": dict(c)}

@app.put("/cases/{case_id}")
@app.put("/api/cases/{case_id}")
async def update_case(case_id: int, request: Request, user: dict = Depends(get_current_user)):
    data = await request.json()
    conn = get_db()
    c = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
    if not c:
        conn.close()
        raise HTTPException(status_code=404, detail="Case not found")

    title = data.get("title", c["title"])
    desc = data.get("description", c["description"])
    status = data.get("status", c["status"])
    priority = data.get("priority", c["priority"])

    conn.execute("UPDATE cases SET title = ?, description = ?, status = ?, priority = ?, updated_at = datetime('now') WHERE id = ?",
                 (title, desc, status, priority, case_id))
    conn.commit()
    updated = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
    conn.close()
    return {"status": "success", "message": "Case updated successfully", "case": dict(updated)}

# ============================================================
# DOCUMENTS
# ============================================================
@app.post("/cases/{case_id}/documents")
@app.post("/api/cases/{case_id}/documents")
async def upload_document(case_id: int, file: UploadFile = File(...), evidence_type: str = Form("AUTO"), user: dict = Depends(get_current_user)):
    conn = get_db()
    c = conn.execute("SELECT id FROM cases WHERE id = ?", (case_id,)).fetchone()
    if not c:
        conn.close()
        raise HTTPException(status_code=404, detail="Case not found")

    original_name=os.path.basename(file.filename or "evidence.bin")
    ext = os.path.splitext(original_name)[1].lower()
    supported = {".txt",".csv",".pdf",".png",".jpg",".jpeg",".webp",".zip",".wav",".mp3",".m4a",".ogg",".webm"}
    if ext not in supported:
        conn.close(); raise HTTPException(status_code=400, detail="Supported evidence types: TXT, CSV, PDF, JPG, JPEG, PNG, WEBP; ZIP for Face Reference Dataset")
    selected_type = str(evidence_type or "AUTO").strip().upper()
    if ext == ".zip" and selected_type not in {"FACE_REFERENCE_DATASET","FACE_DATASET","AUTO"}:
        conn.close(); raise HTTPException(status_code=400, detail="ZIP evidence must be uploaded as a Face Reference Dataset")
    if selected_type in {"FACE_REFERENCE_DATASET","FACE_DATASET"} and ext != ".zip":
        conn.close(); raise HTTPException(status_code=400, detail="Face Reference Dataset uploads must be ZIP archives")
    content=await file.read()
    if ext == ".zip":
        if len(content) > 250 * 1024 * 1024:
            conn.close(); raise HTTPException(status_code=413, detail="Face Reference Dataset ZIP exceeds the 250 MB safety limit")
    elif len(content)>MAX_UPLOAD_BYTES:
        conn.close(); raise HTTPException(status_code=413, detail="Evidence file exceeds upload limit")
    sha256=hashlib.sha256(content).hexdigest()
    ts=datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    try:
        if storage_configured():
            object_path=f"cases/{case_id}/evidence/{ts}_{original_name}"
            save_path=upload_bytes(object_path, content, file.content_type or "application/octet-stream")
        else:
            save_path=os.path.join(UPLOADS_DIR, f"{ts}_{original_name}")
            with open(save_path, "wb") as f:
                f.write(content)

        source_type = "FACE_REFERENCE_DATASET" if (ext == ".zip" or selected_type in {"FACE_REFERENCE_DATASET","FACE_DATASET"}) else "UPLOAD"
        sql = "INSERT INTO documents (case_id, filename, file_type, file_path, processing_status, uploaded_by, sha256, source_type) VALUES (?, ?, ?, ?, 'UPLOADED', ?, ?, ?)"
        if DATABASE_URL:
            cur = conn.execute(sql + " RETURNING *", (case_id, original_name, file.content_type or "application/octet-stream", save_path, user.get("id", 1), sha256, source_type))
            doc = cur.fetchone()
            document_id = doc["id"] if doc else None
        else:
            cur = conn.execute(sql, (case_id, original_name, file.content_type or "application/octet-stream", save_path, user.get("id", 1), sha256, source_type))
            document_id = cur.lastrowid
            doc = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()

        if not document_id:
            raise RuntimeError("Document insert returned no ID")
        conn.execute("INSERT INTO chain_of_custody_logs (case_id, document_id, action, sha256_hash, actor_name) VALUES (?, ?, ?, ?, ?)", (case_id, document_id, "EVIDENCE_UPLOADED", sha256, user.get("full_name", "Investigator")))
        conn.commit()
    except HTTPException:
        try: conn.rollback(); conn.close()
        except Exception: pass
        raise
    except Exception as exc:
        try: conn.rollback(); conn.close()
        except Exception: pass
        if storage_configured() and "storage" in str(exc).lower():
            raise HTTPException(status_code=502, detail=f"Evidence storage unavailable: {str(exc)[:900]}") from exc
        _raise_db_http("uploading evidence", exc)
    conn.close()
    return {"status": "success", "message": "Document uploaded successfully", "document": dict(doc), "processing_required": True}

@app.get("/cases/{case_id}/documents")
@app.get("/api/cases/{case_id}/documents")
def list_documents(case_id: int, user: dict = Depends(get_current_user)):
    conn = get_db(); require_case(conn, case_id)
    rows = conn.execute("SELECT * FROM documents WHERE case_id = ? ORDER BY uploaded_at DESC", (case_id,)).fetchall()
    face_counts = {}
    try:
        face_counts = {int(r["source_evidence_id"]): int(r["profile_count"]) for r in conn.execute(
            "SELECT source_evidence_id, COUNT(*) AS profile_count FROM face_profiles WHERE case_id=? AND active=1 AND source_evidence_id IS NOT NULL GROUP BY source_evidence_id",
            (case_id,)
        ).fetchall()}
    except Exception:
        face_counts = {}
    documents=[]
    for row in rows:
        item=dict(row)
        if str(item.get("source_type") or "").upper() in {"FACE_REFERENCE_IMAGE", "FACE_REFERENCE_DATASET"}:
            count=face_counts.get(int(item["id"]),0)
            item["face_profile_count"]=count
            item["face_enrollment_status"]="ENROLLED" if count>0 else "FAILED"
        documents.append(item)
    conn.close()
    return {"status": "success", "count": len(documents), "documents": documents}

def _process_evidence_background(case_id: int, evidence_id: int, user: dict):
    """Run the canonical evidence pipeline used by both API and durable worker."""
    conn=get_db()
    try:
        doc=conn.execute("SELECT * FROM documents WHERE id=? AND case_id=?",(evidence_id,case_id)).fetchone()
        if not doc:
            return
        conn.execute("UPDATE documents SET processing_status='PROCESSING' WHERE id=? AND case_id=?",(evidence_id,case_id))
        conn.commit()
    finally:
        conn.close()
    try:
        process_evidence_document(case_id,evidence_id,user)
    except Exception as exc:
        conn=get_db()
        try:
            conn.execute("UPDATE documents SET processing_status='FAILED' WHERE id=? AND case_id=?",(evidence_id,case_id))
            conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)",
                         (case_id,"EVIDENCE_PROCESSING_FAILED","document",str(evidence_id),str(user.get("id")),str(exc)[:1000],"FAILED"))
            conn.commit()
        finally:
            conn.close()

@app.post("/cases/{case_id}/evidence/{evidence_id}/process")
@app.post("/api/cases/{case_id}/evidence/{evidence_id}/process")
async def process_evidence(case_id: int, evidence_id: int, request: Request, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    conn=get_db(); doc=conn.execute("SELECT * FROM documents WHERE id=? AND case_id=?",(evidence_id,case_id)).fetchone()
    if not doc:
        conn.close()
        raise HTTPException(status_code=404,detail="Evidence document not found")
    current_status=str(doc["processing_status"] or "").upper()
    if current_status in {"QUEUED", "PROCESSING"}:
        conn.close()
        return {"status":"queued","evidence_id":evidence_id,"processing_status":current_status,"message":"Evidence is already being processed in the background."}
    conn.execute("UPDATE documents SET processing_status='QUEUED' WHERE id=? AND case_id=?", (evidence_id, case_id))
    conn.commit(); conn.close()
    if os.getenv("CIPHER_USE_BACKGROUND_TASKS", "true").lower() == "true":
        background_tasks.add_task(_process_evidence_background, case_id, evidence_id, user)
        return {"status":"queued","evidence_id":evidence_id,"processing_status":"QUEUED","message":"Evidence queued for background extraction; review can be opened immediately."}
    _process_evidence_background(case_id, evidence_id, user)
    conn=get_db(); final=conn.execute("SELECT processing_status FROM documents WHERE id=? AND case_id=?",(evidence_id,case_id)).fetchone(); conn.close()
    return {"status":"processed" if final and str(final["processing_status"]).upper()=="PROCESSED" else "failed","evidence_id":evidence_id,"processing_status":final["processing_status"] if final else "UNKNOWN"}

# ============================================================
# RAG / FACE / EVIDENCE-FUSION INTELLIGENCE
@app.get("/cases/{case_id}/rag/health")
@app.get("/api/cases/{case_id}/rag/health")
def case_rag_health(case_id:int, user:dict=Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id); conn.close()
    return {"status":"success","case_id":case_id,**rag_health(case_id)}

@app.get("/cases/{case_id}/rag/search")
@app.get("/api/cases/{case_id}/rag/search")
def case_rag_search(case_id: int, q: str = Query(..., min_length=1), limit: int = Query(8, ge=1, le=30), user: dict = Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id); conn.close()
    return {"status":"success","case_id":case_id,"query":q,"results":rag_search(case_id,q,limit)}

@app.post("/cases/{case_id}/rag/reindex")
@app.post("/api/cases/{case_id}/rag/reindex")
def case_rag_reindex(case_id: int, user: dict = Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id); conn.close()
    return {"status":"success","case_id":case_id,"results":reindex_case(case_id)}

@app.post("/cases/{case_id}/rag/query")
@app.post("/api/cases/{case_id}/rag/query")
async def case_rag_query(case_id: int, request: Request, user: dict = Depends(get_current_user)):
    """Direct evidence-grounded RAG query endpoint. Existing AI query remains unchanged."""
    conn=get_db(); require_case(conn,case_id); conn.close()
    body=await request.json()
    question=(body.get("question") or body.get("query") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="question is required")
    from .investigation_engine import answer as investigation_answer
    try:
        generated, package = investigation_answer(case_id, question)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {
        "status":"success", "case_id":case_id, "question":question,
        "answer":generated.get("answer",""), "answer_type":generated.get("answer_type","source_backed"),
        "provider":generated.get("provider"), "model":generated.get("model"),
        "sources":generated.get("sources",package.get("rag",[])),
        "retrieval":generated.get("retrieval",package.get("rag_retrieval",{})),
        "inferences":generated.get("inferences",[]), "uncertainties":generated.get("uncertainties",[]),
        "llm_status":generated.get("llm_status",package.get("llm_status",{})),
    }

@app.get("/api/face/health")
@app.get("/face/health")
def api_face_health(user: dict = Depends(get_current_user)):
    return {"status":"success",**face_health()}

@app.post("/cases/{case_id}/face/enroll")
@app.post("/api/cases/{case_id}/face/enroll")
async def api_face_enroll(case_id:int, label:str=Form(...), file:UploadFile=File(...), entity_id:Optional[int]=Form(None), source_evidence_id:Optional[int]=Form(None), user:dict=Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id); conn.close()
    data=await file.read()
    try: result=face_enroll(case_id,label,data,source_evidence_id,entity_id)
    except Exception as exc: raise HTTPException(status_code=422,detail=str(exc)) from exc
    return {"status":"success",**result}

@app.post("/cases/{case_id}/face/search")
@app.post("/api/cases/{case_id}/face/search")
async def api_face_search(case_id:int, file:UploadFile=File(...), source_evidence_id:Optional[int]=Form(None), limit:int=Form(5), user:dict=Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id); conn.close()
    data=await file.read()
    try: result=face_search(case_id,data,source_evidence_id,limit)
    except Exception as exc: raise HTTPException(status_code=422,detail=str(exc)) from exc
    return {"status":"success",**result}

@app.get("/cases/{case_id}/investigation/evidence-package")
@app.get("/api/cases/{case_id}/investigation/evidence-package")
def evidence_package(case_id:int, q:str=Query(...,min_length=1), user:dict=Depends(get_current_user)):
    try: return {"status":"success",**build_investigation_package(case_id,q)}
    except ValueError as exc: raise HTTPException(status_code=404,detail=str(exc)) from exc

@app.post("/cases/{case_id}/investigation/query")
@app.post("/api/cases/{case_id}/investigation/query")
async def investigation_query(case_id:int, request:Request, user:dict=Depends(get_current_user)):
    body=await request.json(); q=(body.get('query') or body.get('question') or '').strip()
    if not q: raise HTTPException(status_code=400,detail='query is required')
    try: result,package=fusion_answer(case_id,q)
    except ValueError as exc: raise HTTPException(status_code=404,detail=str(exc)) from exc
    return {"status":"success","case_id":case_id,"answer":result.get('answer',''),"answer_text":result.get('answer',''),"provider":result.get('provider'),"sources":result.get('sources',package.get('rag',[])),"inferences":result.get('inferences',[]),"uncertainties":result.get('uncertainties',[]),"evidence_package":package,"data":result}

@app.post("/cases/{case_id}/entity-resolution/run")
@app.post("/api/cases/{case_id}/entity-resolution/run")
def run_entity_resolution(case_id:int, user:dict=Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id); conn.close()
    return {"status":"success",**resolve_case_entities(case_id)}

# ============================================================
# ENTITIES, RELATIONSHIPS & SPATIAL EVENTS
ENTITY_TYPES = {"person","phone","vehicle","account","organization","place","location","unknown"}

def canonical_entity_type(value):
    v = str(value or "unknown").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {"org":"organization","organisation":"organization","company":"organization","mobile":"phone","msisdn":"phone","site":"place","location_node":"location","individual":"person","persons":"person"}
    v = aliases.get(v, v)
    return v if v in ENTITY_TYPES else "unknown"

# ============================================================
def relationship_type_safe(value):
    allowed={"CALLS","USES_PHONE","OWNS","DRIVES","VISITED","WORKS_FOR","TRANSFERS_TO","ASSOCIATED_WITH","OBSERVED_AT","LOCATED_AT","CALLED","PAID","OWNED","TRAVELLED_TO","REFERENCED_BY","COMMUNICATES_WITH","TRAVELS_WITH","MEETS_WITH","OPERATES_UNDER"}
    v=str(value or "ASSOCIATED_WITH").strip().upper().replace(" ","_").replace("-","_")
    return v if v in allowed else "ASSOCIATED_WITH"

def _safe_float(value):
    try:
        if value in (None, ""): return None
        v=float(value)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None

def clean_id(value):
    """Normalize CIPHER entity/relationship/location IDs from UI/API forms."""
    if value is None or str(value).strip() == "":
        raise ValueError("ID is required")
    raw = str(value).strip()
    for prefix in ("ent-", "node-", "rel-", "loc-"):
        if raw.lower().startswith(prefix):
            raw = raw[len(prefix):]
            break
    # Accept integer-like strings but reject labels/external IDs here. External
    # IDs are resolved explicitly where an endpoint supports them.
    return int(raw)

@app.get("/cases/{case_id}/entities")
@app.get("/api/cases/{case_id}/entities")
def list_entities(case_id: int):
    conn = get_db()
    rows = conn.execute("SELECT * FROM entities WHERE case_id = ? ORDER BY id", (case_id,)).fetchall()
    conn.close()
    return {"status": "success", "count": len(rows), "entities": [dict(r) for r in rows]}

@app.post("/cases/{case_id}/entities")
@app.post("/api/cases/{case_id}/entities")
async def create_entity(case_id: int, request: Request, user: dict = Depends(get_current_user)):
    data = await request.json()
    label = (data.get("label") or data.get("name") or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="Entity label is required")
    conn = get_db()
    require_case(conn, case_id)
    entity_type = canonical_entity_type((data.get("entity_type") or data.get("type") or "person").lower())
    verification = (data.get("verification_status") or "verified").lower()
    if verification not in {"pending", "verified", "rejected"}: verification = "pending"
    cur = conn.execute("""INSERT INTO entities (case_id, entity_type, label, aliases, latitude, longitude, verification_status, source_type, source_reference, status_reason)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""", (case_id, entity_type, label,
                         data.get("aliases"), _safe_float(data.get("latitude")), _safe_float(data.get("longitude")), verification, "MANUAL_INVESTIGATOR", data.get("source_reference"), data.get("note")))
    entity_id = cur.lastrowid
    # A manual node with coordinates also creates a case location record so GIS is driven by the same source data.
    if data.get("latitude") not in (None, "") and data.get("longitude") not in (None, ""):
        conn.execute("""INSERT INTO locations (case_id,entity_id,label,latitude,longitude,location_type,address_text,verification_status,source_reference)
                        VALUES (?,?,?,?,?,?,?,?,?)""", (case_id, entity_id, label, _safe_float(data.get("latitude")), _safe_float(data.get("longitude")), entity_type.upper()+"_LOCATION", data.get("aliases") or "", verification, data.get("source_reference")))
    conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)", (case_id,"ENTITY_CREATED","entity",str(entity_id),str(user.get("id")),f"Manual entity created: {label}","SUCCESS"))
    conn.commit()
    row = conn.execute("SELECT * FROM entities WHERE id = ?", (entity_id,)).fetchone()
    conn.close()
    return {"status": "success", "entity": dict(row)}

@app.delete("/cases/{case_id}/entities/{entity_id}")
@app.delete("/api/cases/{case_id}/entities/{entity_id}")
def delete_entity(case_id: int, entity_id: str):
    try:
        eid = clean_id(entity_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Valid entity ID is required")
    conn = get_db()
    existing = conn.execute("SELECT id FROM entities WHERE id = ? AND case_id = ?", (eid, case_id)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Entity not found")
    # SQLite does not enable foreign-key cascades globally, so remove dependents explicitly.
    conn.execute("DELETE FROM relationships WHERE case_id=? AND (source_entity_id=? OR target_entity_id=?)", (case_id, eid, eid))
    conn.execute("DELETE FROM locations WHERE case_id=? AND entity_id=?", (case_id, eid))
    conn.execute("DELETE FROM timeline_events WHERE case_id=? AND entity_id=?", (case_id, eid))
    conn.execute("DELETE FROM review_actions WHERE case_id=? AND review_item_id IN (SELECT id FROM review_items WHERE case_id=? AND entity_id=?)", (case_id, case_id, eid))
    conn.execute("DELETE FROM review_items WHERE case_id=? AND entity_id=?", (case_id, eid))
    conn.execute("DELETE FROM entities WHERE id = ? AND case_id = ?", (eid, case_id))
    conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)", (case_id,"ENTITY_DELETED","entity",str(eid),"Investigator",f"Entity {eid} deleted with dependent case records","SUCCESS"))
    conn.commit(); conn.close()
    return {"status": "success", "deleted": eid}

@app.get("/cases/{case_id}/relationships")
@app.get("/api/cases/{case_id}/relationships")
def list_relationships(case_id: int):
    conn = get_db()
    rows = conn.execute("""
        SELECT r.*, s.label AS source_label, s.entity_type AS source_type_label,
               t.label AS target_label, t.entity_type AS target_type_label
        FROM relationships r
        JOIN entities s ON s.id = r.source_entity_id AND s.case_id = r.case_id
        JOIN entities t ON t.id = r.target_entity_id AND t.case_id = r.case_id
        WHERE r.case_id = ? ORDER BY r.id
    """, (case_id,)).fetchall()
    conn.close()
    return {"status": "success", "count": len(rows), "relationships": [dict(r) for r in rows]}

@app.post("/cases/{case_id}/relationships")
@app.post("/api/cases/{case_id}/relationships")
async def create_relationship(case_id: int, request: Request, user: dict = Depends(get_current_user)):
    data = await request.json()
    source_value = data.get("source_entity_id") or data.get("source_id") or data.get("source")
    target_value = data.get("target_entity_id") or data.get("target_id") or data.get("target")
    try:
        source_id = clean_id(source_value)
        target_id = clean_id(target_value)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Valid source and target entity IDs are required")
    if source_id == target_id:
        raise HTTPException(status_code=400, detail="Source and target entities must be different")

    relationship_type = relationship_type_safe(data.get("relationship_type") or data.get("type"))
    verification = str(data.get("verification_status") or "verified").strip().lower()
    if verification not in {"pending", "verified", "rejected"}:
        verification = "pending"

    conn = get_db()
    require_case(conn, case_id)
    source = conn.execute("SELECT id,label FROM entities WHERE id=? AND case_id=?", (source_id, case_id)).fetchone()
    target = conn.execute("SELECT id,label FROM entities WHERE id=? AND case_id=?", (target_id, case_id)).fetchone()
    if not source or not target:
        conn.close()
        raise HTTPException(status_code=400, detail="Source and target entities must both belong to this case")

    # Relationship creation is idempotent for the same directed pair/type. This
    # prevents double-clicks and UI retries from creating duplicate graph edges.
    existing = conn.execute(
        "SELECT * FROM relationships WHERE case_id=? AND source_entity_id=? AND target_entity_id=? AND relationship_type=? AND verification_status != 'rejected' ORDER BY id LIMIT 1",
        (case_id, source_id, target_id, relationship_type),
    ).fetchone()
    if existing:
        conn.close()
        return {"status": "success", "created": False, "already_exists": True, "relationship": dict(existing)}

    cur = conn.execute("""INSERT INTO relationships
        (case_id, source_entity_id, target_entity_id, relationship_type, evidence_sentence, verification_status, source_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (case_id, source_id, target_id, relationship_type, data.get("evidence_sentence") or data.get("evidence"), verification, "MANUAL_INVESTIGATOR"))
    relationship_id = cur.lastrowid
    conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)",
                 (case_id, "RELATIONSHIP_CREATED", "relationship", str(relationship_id), str(user.get("id")),
                  f"Manual relationship {source_id}->{target_id}: {relationship_type}", "SUCCESS"))
    conn.commit()
    row = conn.execute("SELECT * FROM relationships WHERE id = ?", (relationship_id,)).fetchone()
    conn.close()
    return {"status": "success", "created": True, "already_exists": False, "relationship": dict(row)}

@app.get("/cases/{case_id}/locations")
@app.get("/api/cases/{case_id}/locations")
def list_locations(case_id: int):
    conn = get_db()
    rows = conn.execute("SELECT * FROM locations WHERE case_id = ? ORDER BY id", (case_id,)).fetchall()
    conn.close()
    return {"status": "success", "count": len(rows), "locations": [dict(r) for r in rows]}

@app.post("/cases/{case_id}/spatial-events")
@app.post("/api/cases/{case_id}/spatial-events")
async def create_spatial_event(case_id: int, request: Request):
    data = await request.json()
    required = [data.get("entity_name"), data.get("location_id"), data.get("timestamp")]
    if any(value in (None, "") for value in required):
        raise HTTPException(status_code=400, detail="entity_name, location_id, and timestamp are required")
    conn = get_db(); require_case(conn, case_id)
    try:
        location_id = clean_id(data["location_id"])
    except (TypeError, ValueError):
        conn.close(); raise HTTPException(status_code=400, detail="Valid location_id is required")
    if not conn.execute("SELECT id FROM locations WHERE id=? AND case_id=?", (location_id, case_id)).fetchone():
        conn.close(); raise HTTPException(status_code=400, detail="Spatial-event location does not belong to this case")
    cur = conn.execute("""INSERT INTO spatial_events (case_id, entity_name, entity_type, location_id, timestamp, confidence_score, source_document)
                         VALUES (?, ?, ?, ?, ?, ?, ?)""", (case_id, data["entity_name"], data.get("entity_type", "PERSON"), location_id, data["timestamp"], data.get("confidence_score", 1.0), data.get("source_document")))
    conn.commit()
    row = conn.execute("SELECT * FROM spatial_events WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return {"status": "success", "spatial_event": dict(row)}

# ============================================================
# GEOSPATIAL & GIS INTELLIGENCE
# ============================================================
@app.post("/cases/{case_id}/locations")
@app.post("/api/cases/{case_id}/locations")
async def add_location(case_id: int, request: Request, user: dict = Depends(get_current_user)):
    data = await request.json()
    label = (data.get("label") or data.get("name") or "").strip()
    lat = data.get("latitude")
    lng = data.get("longitude")
    loc_type = data.get("location_type", "waypoint")
    address = data.get("address_text") or data.get("address")
    raw_ent = data.get("entity_id")
    try:
        ent_id = clean_id(raw_ent) if raw_ent not in (None, "") else None
        lat_f = float(lat); lng_f = float(lng)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="entity_id, latitude and longitude must be valid numeric values")

    if not label or lat is None or lng is None:
        raise HTTPException(status_code=400, detail="label, latitude, and longitude are required")
    if not (-90 <= lat_f <= 90 and -180 <= lng_f <= 180):
        raise HTTPException(status_code=400, detail="latitude must be between -90 and 90 and longitude between -180 and 180")

    conn = get_db(); require_case(conn, case_id)
    if ent_id is not None and not conn.execute("SELECT id FROM entities WHERE id=? AND case_id=?", (ent_id, case_id)).fetchone():
        conn.close(); raise HTTPException(status_code=400, detail="Location entity does not belong to this case")
    verification = (data.get("verification_status") or "verified").lower()
    if verification not in {"pending", "verified", "rejected"}: verification = "pending"
    cur = conn.execute("INSERT INTO locations (case_id, entity_id, label, latitude, longitude, location_type, address_text, verification_status, source_reference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                       (case_id, ent_id, label, lat_f, lng_f, loc_type, address, verification, data.get("source_reference")))
    conn.commit()
    loc = conn.execute("SELECT * FROM locations WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return {"status": "success", "message": "Location node added successfully", "location": dict(loc)}

@app.get("/cases/{case_id}/gis-data")
@app.get("/api/cases/{case_id}/gis-data")
def get_gis_data(case_id: int):
    conn = get_db()
    entities = conn.execute("""
      SELECT e.*,
             COALESCE(e.latitude, loc.latitude) AS map_latitude,
             COALESCE(e.longitude, loc.longitude) AS map_longitude,
             COALESCE(NULLIF(e.aliases, ''), loc.address_text, e.label) AS map_address
      FROM entities e
      LEFT JOIN locations loc
        ON loc.id = (
          SELECT l.id
          FROM locations l
          WHERE l.case_id = e.case_id
            AND l.entity_id = e.id
            AND l.verification_status = 'verified'
          ORDER BY l.id DESC
          LIMIT 1
        )
      WHERE e.case_id = ?
        AND e.verification_status = 'verified'
        AND COALESCE(e.latitude, loc.latitude) IS NOT NULL
        AND COALESCE(e.longitude, loc.longitude) IS NOT NULL
    """, (case_id,)).fetchall()
    locations = conn.execute("SELECT * FROM locations WHERE case_id = ? AND verification_status = 'verified' AND latitude IS NOT NULL AND longitude IS NOT NULL", (case_id,)).fetchall()
    relationships = conn.execute("""
      SELECT r.id as rel_id, r.relationship_type, r.evidence_sentence, r.confidence_score,
             s.id as source_id, s.label as source_label, COALESCE(s.latitude, sl.latitude) as source_lat, COALESCE(s.longitude, sl.longitude) as source_lng,
             t.id as target_id, t.label as target_label, COALESCE(t.latitude, tl.latitude) as target_lat, COALESCE(t.longitude, tl.longitude) as target_lng
      FROM relationships r
      JOIN entities s ON r.source_entity_id = s.id
      JOIN entities t ON r.target_entity_id = t.id
      LEFT JOIN locations sl ON sl.id = (
        SELECT l.id FROM locations l
        WHERE l.case_id=s.case_id AND l.entity_id=s.id AND l.verification_status='verified'
        ORDER BY l.id DESC LIMIT 1
      )
      LEFT JOIN locations tl ON tl.id = (
        SELECT l.id FROM locations l
        WHERE l.case_id=t.case_id AND l.entity_id=t.id AND l.verification_status='verified'
        ORDER BY l.id DESC LIMIT 1
      )
      WHERE r.case_id = ?
        AND r.verification_status = 'verified'
        AND s.verification_status = 'verified'
        AND t.verification_status = 'verified'
        AND COALESCE(s.latitude, sl.latitude) IS NOT NULL
        AND COALESCE(s.longitude, sl.longitude) IS NOT NULL
        AND COALESCE(t.latitude, tl.latitude) IS NOT NULL
        AND COALESCE(t.longitude, tl.longitude) IS NOT NULL
    """, (case_id,)).fetchall()
    conn.close()

    features = []
    seen = set()

    for e in entities:
        coord_key = f"{round(float(e['map_latitude']), 4)},{round(float(e['map_longitude']), 4)}"
        seen.add(coord_key)
        loc_type = "INVESTIGATION_NODE"
        if e["entity_type"] == "place": loc_type = "CASE_LOCATION"
        elif e["entity_type"] == "person": loc_type = "PERSON_LOCATION"
        elif e["entity_type"] == "vehicle": loc_type = "VEHICLE_LOCATION"

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(e["map_longitude"]), float(e["map_latitude"])]},
            "properties": {
                "id": e["id"],
                "entity_id": e["id"],
                "name": e["label"],
                "label": e["label"],
                "location_type": loc_type,
                "entity_type": e["entity_type"],
                "address": e["map_address"] or e["label"],
                "latitude": float(e["map_latitude"]),
                "longitude": float(e["map_longitude"]),
                "confidence": e["confidence_score"],
                "status": e["verification_status"]
            }
        })

    for loc in locations:
        coord_key = f"{round(float(loc['latitude']), 4)},{round(float(loc['longitude']), 4)}"
        if coord_key not in seen:
            seen.add(coord_key)
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [float(loc["longitude"]), float(loc["latitude"])]},
                "properties": {
                    "id": loc["id"] + 10000,
                    "entity_id": loc["entity_id"],
                    "name": loc["label"],
                    "label": loc["label"],
                    "location_type": (loc["location_type"] or "WAYPOINT").upper(),
                    "entity_type": "place",
                    "address": loc["address_text"] or loc["label"],
                    "latitude": float(loc["latitude"]),
                    "longitude": float(loc["longitude"]),
                    "status": loc["verification_status"] or "verified"
                }
            })

    corridors = {}
    for rel in relationships:
        key = f"{rel['source_label']} ↔ {rel['target_label']}"
        corridors[key] = [
            {"location_name": rel["source_label"], "latitude": float(rel["source_lat"]), "longitude": float(rel["source_lng"]), "relationship": rel["relationship_type"]},
            {"location_name": rel["target_label"], "latitude": float(rel["target_lat"]), "longitude": float(rel["target_lng"]), "relationship": rel["relationship_type"]}
        ]

    # Detect co-locations
    co_locations = []
    for i in range(len(features)):
        for j in range(i + 1, len(features)):
            p1 = features[i]["properties"]
            p2 = features[j]["properties"]
            if abs(p1["latitude"] - p2["latitude"]) < 0.025 and abs(p1["longitude"] - p2["longitude"]) < 0.025 and p1["name"] != p2["name"]:
                co_locations.append({
                    "entity_a": p1["name"],
                    "entity_b": p2["name"],
                    "location": f"{p1['name']} & {p2['name']}",
                    "latitude": (p1["latitude"] + p2["latitude"]) / 2,
                    "longitude": (p1["longitude"] + p2["longitude"]) / 2,
                    "time_gap_minutes": None,
                    "anomaly_score": "CO-LOCATION_OBSERVATION"
                })

    directed_corridors = []
    for rel in relationships:
        directed_corridors.append({
            "rel_id": rel["rel_id"],
            "source_id": rel["source_id"],
            "source_label": rel["source_label"],
            "source_type": "entity",
            "source_lat": float(rel["source_lat"]),
            "source_lng": float(rel["source_lng"]),
            "target_id": rel["target_id"],
            "target_label": rel["target_label"],
            "target_type": "entity",
            "target_lat": float(rel["target_lat"]),
            "target_lng": float(rel["target_lng"]),
            "relationship_type": rel["relationship_type"],
            "evidence_sentence": rel["evidence_sentence"],
            "confidence_score": rel["confidence_score"]
        })

    return {
        "status": "success",
        "case_id": case_id,
        "location_count": len(features),
        "geojson": {"type": "FeatureCollection", "features": features},
        "transit_corridors": corridors,
        "directed_corridors": directed_corridors,
        "colocation_anomalies": co_locations
    }

@app.get("/cases/{case_id}/gis/locations")
@app.get("/api/cases/{case_id}/gis/locations")
def gis_locations(case_id: int):
    data = get_gis_data(case_id)
    return {"type": "FeatureCollection", "features": data["geojson"]["features"], "status": "success", "case_id": case_id}

@app.get("/cases/{case_id}/gis/nearby")
@app.get("/api/cases/{case_id}/gis/nearby")
def gis_nearby(case_id: int, latitude: Optional[float] = None, longitude: Optional[float] = None, radius: float = 0.05):
    data = get_gis_data(case_id)
    if latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="latitude and longitude query parameters required")
    radius_meters = float(radius)
    nearby = []
    for feature in data["geojson"]["features"]:
        props = feature["properties"]
        d_lat = math.radians(props["latitude"] - latitude)
        d_lon = math.radians(props["longitude"] - longitude)
        a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(latitude)) * math.cos(math.radians(props["latitude"])) * math.sin(d_lon / 2) ** 2
        distance = round(6371000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))
        if distance <= radius_meters:
            nearby.append({"location_id": f"loc-{props['id']}", "raw_id": props["id"], "name": props["name"], "type": props.get("location_type"), "latitude": props["latitude"], "longitude": props["longitude"], "distance_meters": distance, "address": props.get("address", "")})
    nearby.sort(key=lambda item: item["distance_meters"])
    return {"status": "success", "center": {"latitude": latitude, "longitude": longitude}, "radius_meters": radius_meters, "locations": nearby, "count": len(nearby)}

@app.get("/cases/{case_id}/gis/corridors")
@app.get("/api/cases/{case_id}/gis/corridors")
def gis_corridors(case_id: int):
    data = get_gis_data(case_id)
    corridors = []
    for rel in data.get("directed_corridors", []):
        corridors.append({
            "corridor_id": f"rel-{rel['rel_id']}",
            "name": f"{rel['source_label']} → {rel['target_label']}",
            "algorithm": "verified_relationship_geometry",
            "status": "VERIFIED",
            "points_count": 2,
            "relationship_type": rel.get("relationship_type"),
            "linestring_geojson": {"type": "LineString", "coordinates": [[rel["source_lng"], rel["source_lat"]], [rel["target_lng"], rel["target_lat"]]]},
            "waypoints": [
                {"location_id": rel.get("source_id"), "name": rel.get("source_label"), "latitude": rel.get("source_lat"), "longitude": rel.get("source_lng")},
                {"location_id": rel.get("target_id"), "name": rel.get("target_label"), "latitude": rel.get("target_lat"), "longitude": rel.get("target_lng")}
            ]
        })
    return {"status": "success", "case_id": case_id, "corridors": corridors, "label": "VERIFIED RELATIONSHIP LINES"}

@app.post("/cases/{case_id}/gis/waypoints")
@app.post("/api/cases/{case_id}/gis/waypoints")
async def create_waypoint(case_id: int, request: Request):
    result = await add_location(case_id, request)
    location = result.get("location", {})
    raw_id = location.get("id")
    return {**result, "location_id": f"loc-{raw_id}" if raw_id is not None else result.get("location_id"), "raw_id": raw_id, "verification_status": location.get("verification_status", "verified")}

@app.post("/cases/{case_id}/geocode")
@app.post("/api/cases/{case_id}/geocode")
async def geocode(case_id: int, request: Request):
    data = await request.json()
    query = data.get("query") or data.get("address") or data.get("location") or ""
    if not query:
        raise HTTPException(status_code=400, detail="Address string is required")
    try:
        response = requests.get("https://nominatim.openstreetmap.org/search", params={"q": query, "format": "json", "limit": 1, "countrycodes": "in"}, headers={"User-Agent": "Cipher-Criminal-Analysis-Platform/2.0"}, timeout=10)
        matches = response.json() if response.ok else []
        if matches:
            match = matches[0]
            result = {"status": "success", "found": True, "display_name": match.get("display_name", query), "latitude": float(match["lat"]), "longitude": float(match["lon"])}
            result["results"] = [result.copy()]
            return result
    except (requests.RequestException, ValueError, KeyError):
        pass
    return {"status": "not_found", "found": False, "message": "No coordinate match found for this query", "results": []}

@app.api_route("/geocode/reverse", methods=["GET", "POST"])
@app.api_route("/api/geocode/reverse", methods=["GET", "POST"])
async def reverse_geocode(request: Request):
    data = dict(request.query_params)
    if request.method == "POST":
        try:
            data.update(await request.json())
        except Exception:
            pass
    lat = data.get("lat") or data.get("latitude")
    lon = data.get("lon") or data.get("lng") or data.get("longitude")
    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="Valid lat and lon are required")
    latitude = float(lat)
    longitude = float(lon)
    primary_location = f"Coordinates {latitude}, {longitude}"
    jurisdiction = "Central Zone"
    try:
        response = requests.get("https://nominatim.openstreetmap.org/reverse", params={"lat": latitude, "lon": longitude, "format": "json", "addressdetails": 1}, headers={"User-Agent": "Cipher-Criminal-Analysis-Platform/2.0"}, timeout=10)
        if response.ok:
            result = response.json()
            address = result.get("address", {})
            point = address.get("suburb") or address.get("neighbourhood") or address.get("road") or ""
            city = address.get("city") or address.get("town") or address.get("municipality") or address.get("village") or address.get("county") or ""
            state = address.get("state") or ""
            primary_location = f"{point}, {city}" if point and city else f"{city}, {state}" if city and state else result.get("display_name", primary_location)
            jurisdiction = f"{city or state or 'Central'} Police Zone"
            return {"status": "success", "found": True, "primary_location": primary_location, "jurisdiction": jurisdiction, "display_name": result.get("display_name", primary_location), "city": city, "state": state, "country": address.get("country", ""), "latitude": latitude, "longitude": longitude, "source": "gps_osm_reverse"}
    except (requests.RequestException, ValueError):
        pass
    return {"status": "success", "found": True, "primary_location": primary_location, "jurisdiction": jurisdiction, "display_name": primary_location, "latitude": latitude, "longitude": longitude, "source": "configured_default"}

@app.api_route("/location/current", methods=["GET", "POST"])
@app.api_route("/api/location/current", methods=["GET", "POST"])
async def current_location():
    return {"status": "success", "found": True, "primary_location": "Central Division Command", "jurisdiction": "Central Zone", "city": "Central", "state": "", "country": "", "latitude": 19.0760, "longitude": 72.8777, "accuracy": 0, "source": "system_default", "location": {"latitude": 19.0760, "longitude": 72.8777, "accuracy": 0, "source": "system_default"}}

@app.get("/cases/{case_id}/evidence/{evidence_id}")
@app.get("/api/cases/{case_id}/evidence/{evidence_id}")
def evidence_file(case_id: int, evidence_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    row = conn.execute("SELECT * FROM documents WHERE id = ? AND case_id = ?", (clean_id(evidence_id), case_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Evidence not found")
    file_path = row["file_path"]
    if str(file_path or "").startswith("supabase://"):
        try:
            data = download_uri(str(file_path))
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Evidence storage unavailable: {exc}")
        return Response(content=data, media_type=row["file_type"] or "application/octet-stream", headers={"Content-Disposition": f'inline; filename="{row["filename"] or f"evidence-{evidence_id}"}"'})
    if not file_path or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Evidence file is not available on this server")
    return FileResponse(path=file_path, media_type=row["file_type"] or "application/octet-stream", filename=row["filename"] or f"evidence-{evidence_id}")

@app.get("/cases/{case_id}/evidence/{evidence_id}/metadata")
@app.get("/api/cases/{case_id}/evidence/{evidence_id}/metadata")
def evidence_metadata(case_id: int, evidence_id: str, user: dict = Depends(get_current_user)):
    conn = get_db()
    row = conn.execute("SELECT * FROM documents WHERE id = ? AND case_id = ?", (clean_id(evidence_id), case_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return {"status": "success", "case_id": case_id, "evidence_id": evidence_id, "evidence": dict(row)}

# ============================================================
# ML LINK PREDICTION
# ============================================================
def _case_ml_graph(case_id: int):
    conn = get_db()
    require_case(conn, case_id)
    entities = [dict(row) for row in conn.execute(
        "SELECT id, entity_type, label, verification_status FROM entities WHERE case_id = ? ORDER BY id",
        (case_id,),
    ).fetchall()]
    relationships = [dict(row) for row in conn.execute(
        "SELECT source_entity_id, target_entity_id, relationship_type, verification_status FROM relationships WHERE case_id = ? ORDER BY id",
        (case_id,),
    ).fetchall()]
    conn.close()
    return build_case_graph(entities, relationships), entities, relationships


def _external_ml_predict(source, target):
    if not ML_MODEL_URL:
        return None
    url=f"{ML_MODEL_URL}/predict"
    try:
        response=requests.post(url,json={"source":int(source),"target":int(target)},timeout=float(os.getenv("ML_MODEL_TIMEOUT","15")))
        response.raise_for_status()
        data=response.json()
        return {"provider":"external-ml-lab","model_url":ML_MODEL_URL,"result":data}
    except Exception as exc:
        return {"provider":"external-ml-lab","model_url":ML_MODEL_URL,"error":f"{type(exc).__name__}: {str(exc)[:400]}"}

@app.get("/cases/{case_id}/ml/health")
@app.get("/api/cases/{case_id}/ml/health")
def ml_health(case_id: int, user: dict = Depends(get_current_user)):
    graph, _, _ = _case_ml_graph(case_id)
    return {
        "status": "ready",
        "case_id": case_id,
        "graph_nodes": graph.number_of_nodes(),
        "graph_edges": graph.number_of_edges(),
        "model": "case_scoped_random_forest_with_graph_score_fallback",
        "label": "MODEL ESTIMATE - NOT AN AI CONCLUSION",
        "external_model_url": ML_MODEL_URL or None,
    }


@app.post("/cases/{case_id}/ml/predict")
@app.post("/api/cases/{case_id}/ml/predict")
async def ml_predict(case_id: int, request: Request, user: dict = Depends(get_current_user)):
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Request body must be valid JSON") from exc
    source = body.get("source_entity_id", body.get("source"))
    target = body.get("target_entity_id", body.get("target"))
    if source is None or target is None:
        raise HTTPException(status_code=422, detail="source_entity_id and target_entity_id are required")
    try:
        threshold = float(body.get("threshold", 0.20))
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="threshold must be numeric")
    if not 0 <= threshold <= 1:
        raise HTTPException(status_code=422, detail="threshold must be between 0 and 1")
    external = _external_ml_predict(source, target)
    if external and "result" in external:
        result = external["result"]
        result["provider"] = "external-ml-lab"
        result["case_id"] = case_id
        return {"status": "success", "prediction": result}
    graph, _, _ = _case_ml_graph(case_id)
    try:
        result = predict_pair(graph, source, target, threshold)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    result["case_id"] = case_id
    return {"status": "success", "prediction": result}


@app.post("/cases/{case_id}/ml/preview")
@app.post("/api/cases/{case_id}/ml/preview")
async def ml_preview(case_id: int, request: Request, user: dict = Depends(get_current_user)):
    """Run ML against the frontend's freshly uploaded CSV preview.

    This keeps the preview useful even while evidence extraction/review is pending.
    It does not write predicted relationships to the database.
    """
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Request body must be valid JSON") from exc
    nodes = body.get("nodes") or []
    edges = body.get("edges") or []
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise HTTPException(status_code=422, detail="nodes and edges must be arrays")
    graph = build_case_graph(nodes, edges)
    source = body.get("source_entity_id", body.get("source"))
    target = body.get("target_entity_id", body.get("target"))
    threshold = float(body.get("threshold", 0.20))
    if not 0 <= threshold <= 1:
        raise HTTPException(status_code=422, detail="threshold must be between 0 and 1")
    if source is not None or target is not None:
        if source is None or target is None:
            raise HTTPException(status_code=422, detail="Both source and target are required")
        try:
            result = predict_pair(graph, source, target, threshold)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        return {"status": "success", "case_id": case_id, "prediction": result, "source": "csv_preview"}
    return {"status": "success", "case_id": case_id, "candidates": rank_candidates(graph, limit=max(1, min(100, int(body.get("limit", 25)))), threshold=threshold), "source": "csv_preview"}


@app.post("/cases/{case_id}/ml/candidates")
@app.post("/api/cases/{case_id}/ml/candidates")
async def ml_candidates(case_id: int, request: Request, user: dict = Depends(get_current_user)):
    try:
        body = await request.json()
    except Exception:
        body = {}
    try:
        limit = max(1, min(100, int(body.get("limit", 25))))
        threshold = float(body.get("threshold", 0.20))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="limit and threshold must be numeric") from exc
    if not 0 <= threshold <= 1:
        raise HTTPException(status_code=422, detail="threshold must be between 0 and 1")
    graph, _, _ = _case_ml_graph(case_id)
    return {
        "status": "success",
        "case_id": case_id,
        "threshold": threshold,
        "limit": limit,
        "candidates": rank_candidates(graph, limit=limit, threshold=threshold),
        "label": "MODEL ESTIMATE - NOT AN AI CONCLUSION",
    }


# ============================================================
# GRAPH API (NEO4J)
# ============================================================
def _verified_relational_graph(case_id: int):
    conn = get_db()
    entities = conn.execute("SELECT * FROM entities WHERE case_id = ? AND verification_status = 'verified' ORDER BY id", (case_id,)).fetchall()
    relationships = conn.execute("SELECT * FROM relationships WHERE case_id = ? AND verification_status = 'verified' ORDER BY id", (case_id,)).fetchall()
    conn.close()
    return [dict(e) for e in entities], [dict(r) for r in relationships]

def _sync_verified_graph(case_id: int):
    entities, relationships = _verified_relational_graph(case_id)
    if neo4j_graph.configured():
        try:
            return entities, relationships, neo4j_graph.sync_case(case_id, entities, relationships)
        except Exception as exc:
            # A Neo4j outage must not make the investigative workspace unusable.
            # Relational verified records remain the source of truth and provide
            # a deterministic graph fallback until Neo4j connectivity is restored.
            return entities, relationships, {
                "configured": True,
                "status": "neo4j_unavailable_fallback",
                "nodes": len(entities),
                "edges": len(relationships),
                "error": f"{type(exc).__name__}: {str(exc)[:500]}",
            }
    return entities, relationships, {"configured": False, "status": "relational_fallback", "nodes": len(entities), "edges": len(relationships)}

@app.get("/cases/{case_id}/graph")
@app.get("/api/cases/{case_id}/graph")
def get_graph(case_id: int, include: Optional[str] = None, user: dict = Depends(get_current_user)):
    entities, relationships, sync = _sync_verified_graph(case_id)
    if neo4j_graph.configured() and sync.get("status") == "synced":
        try:
            graph = neo4j_graph.case_graph(case_id)
            nodes = [{"data": n} for n in graph["nodes"]]
            edges = [{"data": e} for e in graph["edges"]]
            return {"status": "success", "case_id": case_id, "graph_store": "neo4j", "sync": sync, "nodes": nodes, "edges": edges}
        except Exception as exc:
            sync = {**sync, "status": "neo4j_unavailable_fallback", "error": f"{type(exc).__name__}: {str(exc)[:500]}"}
    nodes = [{"data": {"id": str(e["id"]), "label": e["label"], "type": e["entity_type"], "aliases": e.get("aliases") or "", "confidence": e.get("confidence_score"), "status": e.get("verification_status"), "lat": e.get("latitude"), "lng": e.get("longitude")}} for e in entities]
    ids = {str(n["data"]["id"]) for n in nodes}
    edges = [{"data": {"id": str(r["id"]), "source": str(r["source_entity_id"]), "target": str(r["target_entity_id"]), "label": r["relationship_type"], "evidence": r.get("evidence_sentence") or "", "confidence": r.get("confidence_score"), "status": r.get("verification_status")}} for r in relationships if str(r["source_entity_id"]) in ids and str(r["target_entity_id"]) in ids]
    return {"status": "success", "case_id": case_id, "graph_store": "relational_fallback", "sync": sync, "nodes": nodes, "edges": edges}

@app.get("/cases/{case_id}/graph/nodes/{entity_id}")
@app.get("/api/cases/{case_id}/graph/nodes/{entity_id}")
def graph_node(case_id: int, entity_id: str, user: dict = Depends(get_current_user)):
    _sync_verified_graph(case_id)
    eid = clean_id(entity_id)
    if neo4j_graph.configured():
        result = neo4j_graph.node(case_id, eid)
        if not result:
            raise HTTPException(status_code=404, detail="Graph node not found")
        conn = get_db(); locs = conn.execute("SELECT * FROM locations WHERE case_id = ? AND entity_id = ?", (case_id, eid)).fetchall(); conn.close()
        n = result["node"]
        return {"status": "success", "graph_store": "neo4j", "node": n, "entity_id": f"ent-{eid}", "raw_id": eid, "canonical_name": n["label"], "type": n["type"], "aliases": [p.strip() for p in (n.get("aliases") or "").split(",") if p.strip()], "confidence_score": n.get("confidence"), "verification_status": n.get("status"), "coordinates": [n["lng"], n["lat"]] if n.get("lat") is not None and n.get("lng") is not None else None, "relationships": result["relationships"], "locations": [dict(x) for x in locs]}
    conn=get_db(); row=conn.execute("SELECT * FROM entities WHERE id=? AND case_id=? AND verification_status='verified'",(eid,case_id)).fetchone(); rels=conn.execute("SELECT * FROM relationships WHERE case_id=? AND verification_status='verified' AND (source_entity_id=? OR target_entity_id=?)",(case_id,eid,eid)).fetchall(); locs=conn.execute("SELECT * FROM locations WHERE case_id=? AND entity_id=? AND verification_status='verified'",(case_id,eid)).fetchall(); conn.close()
    if not row: raise HTTPException(status_code=404, detail="Graph node not found")
    d=dict(row); return {"status":"success","graph_store":"relational_fallback","node":d,"entity_id":f"ent-{eid}","raw_id":eid,"canonical_name":d["label"],"type":d["entity_type"],"aliases":[p.strip() for p in (d.get("aliases") or "").split(",") if p.strip()],"confidence_score":d.get("confidence_score"),"verification_status":d.get("verification_status"),"coordinates":[d["longitude"],d["latitude"]] if d.get("latitude") is not None and d.get("longitude") is not None else None,"relationships":[dict(x) for x in rels],"locations":[dict(x) for x in locs]}

@app.get("/cases/{case_id}/graph/nodes/{entity_id}/neighbors")
@app.get("/api/cases/{case_id}/graph/nodes/{entity_id}/neighbors")
def graph_neighbors(case_id: int, entity_id: str, user: dict = Depends(get_current_user)):
    _sync_verified_graph(case_id); eid = clean_id(entity_id)
    if neo4j_graph.configured():
        result=neo4j_graph.neighbors(case_id,eid)
        return {"status":"success","graph_store":"neo4j","nodes":[{"data":n} for n in result["nodes"]],"edges":[{"data":e} for e in result["edges"]]}
    conn=get_db(); rels=[dict(r) for r in conn.execute("SELECT * FROM relationships WHERE case_id=? AND verification_status='verified' AND (source_entity_id=? OR target_entity_id=?)",(case_id,eid,eid)).fetchall()]; conn.close(); ids=set()
    for r in rels: ids.add(int(r["target_entity_id"]) if int(r["source_entity_id"])==eid else int(r["source_entity_id"]))
    conn=get_db(); rows=[dict(r) for r in conn.execute("SELECT * FROM entities WHERE case_id=? AND verification_status='verified' AND id IN ({})".format(','.join('?'*len(ids)) if ids else '0'),(case_id,*sorted(ids))).fetchall()] if ids else []; conn.close()
    return {"status":"success","graph_store":"relational_fallback","nodes":[{"data":{"id":str(r["id"]),"label":r["label"],"type":r["entity_type"],"aliases":r.get("aliases") or "","confidence":r.get("confidence_score"),"status":r.get("verification_status"),"lat":r.get("latitude"),"lng":r.get("longitude")}} for r in rows],"edges":[{"data":{"id":str(r["id"]),"source":str(r["source_entity_id"]),"target":str(r["target_entity_id"]),"label":r["relationship_type"],"evidence":r.get("evidence_sentence") or "","confidence":r.get("confidence_score"),"status":r.get("verification_status")}} for r in rels]}

@app.get("/cases/{case_id}/graph/relationships/{relationship_id}")
@app.get("/api/cases/{case_id}/graph/relationships/{relationship_id}")
def graph_relationship(case_id: int, relationship_id: int, user: dict = Depends(get_current_user)):
    _sync_verified_graph(case_id)
    if neo4j_graph.configured():
        result=neo4j_graph.relationship(case_id, relationship_id)
        if not result: raise HTTPException(status_code=404, detail="Graph relationship not found")
        r,s,t=result["relationship"],result["from_entity"],result["to_entity"]
        return {"status":"success","graph_store":"neo4j","relationship":r,"relationship_id":f"rel-{relationship_id}","raw_id":relationship_id,"from_entity":{"id":s.get("entity_id"),"label":s.get("label"),"type":s.get("entity_type")},"to_entity":{"id":t.get("entity_id"),"label":t.get("label"),"type":t.get("entity_type")},"type":r.get("relationship_type"),"evidence_sentence":r.get("evidence"),"confidence_score":r.get("confidence"),"verification_status":r.get("verification_status"),"source_document_id":r.get("source_document_id")}
    conn=get_db(); row=conn.execute("SELECT r.*,s.label AS source_label,s.entity_type AS source_type,t.label AS target_label,t.entity_type AS target_type FROM relationships r JOIN entities s ON s.id=r.source_entity_id JOIN entities t ON t.id=r.target_entity_id WHERE r.id=? AND r.case_id=? AND r.verification_status='verified'",(relationship_id,case_id)).fetchone(); conn.close()
    if not row: raise HTTPException(status_code=404, detail="Graph relationship not found")
    d=dict(row); return {"status":"success","graph_store":"relational_fallback","relationship":d,"relationship_id":f"rel-{relationship_id}","raw_id":relationship_id,"from_entity":{"id":d["source_entity_id"],"label":d["source_label"],"type":d["source_type"]},"to_entity":{"id":d["target_entity_id"],"label":d["target_label"],"type":d["target_type"]},"type":d["relationship_type"],"evidence_sentence":d.get("evidence_sentence"),"confidence_score":d.get("confidence_score"),"verification_status":d.get("verification_status"),"source_document_id":d.get("source_document_id")}

@app.post("/cases/{case_id}/graph/analytics/centrality")
@app.post("/api/cases/{case_id}/graph/analytics/centrality")
async def graph_centrality(case_id: int, user: dict = Depends(get_current_user)):
    _sync_verified_graph(case_id)
    if neo4j_graph.configured():
        ranked=neo4j_graph.degree_centrality(case_id)
    else:
        entities, relationships=_verified_relational_graph(case_id); deg={int(e["id"]):0 for e in entities}
        for r in relationships: deg[int(r["source_entity_id"])]+=1; deg[int(r["target_entity_id"])]+=1
        total=max(1,len(entities)-1); ranked=[{"id":e["id"],"label":e["label"],"degree":deg.get(int(e["id"]),0),"centrality":round(deg.get(int(e["id"]),0)/total,6)} for e in entities]; ranked.sort(key=lambda x:(-x["degree"],x["label"]))
    return {"status":"success","case_id":case_id,"graph_store":"neo4j" if neo4j_graph.configured() else "relational_fallback","algorithm":"degree_centrality","graph_scope":{"case_id":case_id,"verification":"VERIFIED"},"centrality":ranked,"results":ranked,"label":"COMPUTED ANALYTIC - NOT AN AI CONCLUSION"}

@app.post("/cases/{case_id}/graph/analytics/communities")
@app.post("/api/cases/{case_id}/graph/analytics/communities")
async def graph_communities(case_id: int, user: dict = Depends(get_current_user)):
    _sync_verified_graph(case_id)
    graph = neo4j_graph.graph_records(case_id) if neo4j_graph.configured() else {"nodes":[{**n} for n in []],"edges":[]}
    if not neo4j_graph.configured():
        ents, rels=_verified_relational_graph(case_id); graph={"nodes":[{"id":str(e["id"]),"label":e["label"]} for e in ents],"edges":[{"source":str(r["source_entity_id"]),"target":str(r["target_entity_id"])} for r in rels]}
    try:
        import networkx as nx
        G=nx.Graph(); G.add_nodes_from([str(n["id"]) for n in graph["nodes"]]); G.add_edges_from([(str(e["source"]),str(e["target"])) for e in graph["edges"]]); communities=list(nx.connected_components(G))
    except Exception:
        communities=[]
        seen=set(); adj={str(n["id"]):set() for n in graph["nodes"]}
        for e in graph["edges"]: adj.setdefault(str(e["source"]),set()).add(str(e["target"])); adj.setdefault(str(e["target"]),set()).add(str(e["source"]))
        for n in adj:
            if n in seen: continue
            q=[n]; seen.add(n); comp=[]
            while q:
                u=q.pop(); comp.append(u)
                for v in adj.get(u,set()):
                    if v not in seen: seen.add(v); q.append(v)
            communities.append(set(comp))
    by_id={str(n["id"]):n for n in graph["nodes"]}
    result=[{"community_id":i+1,"size":len(c),"members":[{"id":int(x),"label":by_id.get(x,{}).get("label",x)} for x in sorted(c)]} for i,c in enumerate(communities)]
    return {"status":"success","case_id":case_id,"graph_store":"neo4j" if neo4j_graph.configured() else "relational_fallback","algorithm":"connected_components_community_proxy","total_communities":len(result),"communities":result,"label":"COMPUTED ANALYTIC - NOT AN AI CONCLUSION"}

@app.post("/cases/{case_id}/graph/analytics/patterns")
@app.post("/api/cases/{case_id}/graph/analytics/patterns")
async def graph_patterns(case_id: int, user: dict = Depends(get_current_user)):
    _sync_verified_graph(case_id)
    ranked=neo4j_graph.degree_centrality(case_id) if neo4j_graph.configured() else []
    if not ranked:
        ents, rels=_verified_relational_graph(case_id); deg={int(e["id"]):0 for e in ents}
        for r in rels: deg[int(r["source_entity_id"])]+=1; deg[int(r["target_entity_id"])]+=1
        ranked=[{"id":e["id"],"label":e["label"],"degree":deg.get(int(e["id"]),0)} for e in ents]
    patterns=[{"pattern_type":"HIGH_CONNECTIVITY","type":"HIGH_CONNECTIVITY","severity":"HIGH","title":f"High Connectivity: {r['label']}","description":f"Entity has {r['degree']} direct links.","anchor_entity_id":f"ent-{r['id']}","entity_id":r['id'],"label":r['label'],"degree":r['degree']} for r in ranked if int(r.get("degree",0))>=3]
    return {"status":"success","case_id":case_id,"graph_store":"neo4j" if neo4j_graph.configured() else "relational_fallback","patterns":patterns,"results":patterns,"patterns_count":len(patterns),"label":"COMPUTED ANALYTIC - NOT AN AI CONCLUSION"}

@app.post("/cases/{case_id}/graph/path")
@app.post("/api/cases/{case_id}/graph/path")
async def find_graph_path(case_id: int, request: Request, user: dict = Depends(get_current_user)):
    data=await request.json(); start=data.get("start_entity_id") or data.get("source_id") or data.get("source") or data.get("from"); end=data.get("end_entity_id") or data.get("target_id") or data.get("target") or data.get("to"); max_hops=int(data.get("max_hops") or 6)
    entities, relationships, _ = _sync_verified_graph(case_id)
    def resolve(value):
        if value in (None,""): return None
        try: return int(clean_id(value))
        except Exception: pass
        text=str(value).lower()
        for e in entities:
            if text in str(e.get("label","")).lower(): return int(e["id"])
        return None
    s_id,t_id=resolve(start),resolve(end)
    if not s_id or not t_id: return {"status":"not_found","connected":False,"path_found":False,"message":"Could not resolve start or target entity"}
    if neo4j_graph.configured():
        result=neo4j_graph.shortest_path(case_id,s_id,t_id,max_hops); result.update({"status":"success" if result.get("path_found") else "not_found","graph_store":"neo4j"}); return result
    return {"status":"not_found","connected":False,"path_found":False,"graph_store":"relational_fallback","message":"Neo4j required for path analytics in this configuration"}

# ============================================================
# CASE REPORT PDF EXPORT
# ============================================================
@app.get("/cases/{case_id}/report.pdf")
@app.get("/api/cases/{case_id}/report.pdf")
def export_case_report_pdf(case_id: int, user: dict = Depends(get_current_user)):
    """Generate a real, case-specific PDF report from verified CIPHER data."""
    try:
        from io import BytesIO
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_LEFT
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF export dependency unavailable: {exc}")

    conn = get_db()
    case = conn.execute("SELECT * FROM cases WHERE id=?", (case_id,)).fetchone()
    if not case:
        conn.close()
        raise HTTPException(status_code=404, detail="Case not found")
    case = dict(case)
    entities = [dict(r) for r in conn.execute("SELECT id,label,entity_type,aliases,confidence_score,verification_status FROM entities WHERE case_id=? AND verification_status='verified' ORDER BY id", (case_id,)).fetchall()]
    relationships = [dict(r) for r in conn.execute("""SELECT r.id,s.label AS source_label,t.label AS target_label,r.relationship_type,r.confidence_score,r.evidence_sentence
        FROM relationships r JOIN entities s ON s.id=r.source_entity_id JOIN entities t ON t.id=r.target_entity_id
        WHERE r.case_id=? AND r.verification_status='verified' ORDER BY r.id""", (case_id,)).fetchall()]
    locations = [dict(r) for r in conn.execute("SELECT id,label,latitude,longitude,location_type,address_text,verification_status FROM locations WHERE case_id=? AND verification_status='verified' ORDER BY id", (case_id,)).fetchall()]
    events = [dict(r) for r in conn.execute("SELECT id,event_type,event_time,description,verification_status,source_reference FROM timeline_events WHERE case_id=? AND verification_status='verified' ORDER BY event_time,id", (case_id,)).fetchall()]
    evidence = [dict(r) for r in conn.execute("SELECT id,filename,file_type,processing_status,sha256,uploaded_at,processed_at FROM documents WHERE case_id=? ORDER BY id", (case_id,)).fetchall()]
    conn.close()

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36, title=f"CIPHER Case Report - {case.get('case_number') or case_id}")
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontSize=8.5, leading=11, textColor=colors.HexColor("#333333")))
    styles.add(ParagraphStyle(name="Section", parent=styles["Heading2"], fontSize=12, leading=15, spaceBefore=10, spaceAfter=6, textColor=colors.HexColor("#17324d")))
    story=[]
    story.append(Paragraph("CIPHER — CASE INTELLIGENCE REPORT", styles["Title"]))
    story.append(Spacer(1, 8))
    meta = [
        ["Case ID", str(case.get("case_number") or case_id)],
        ["Title", str(case.get("title") or "Investigation")],
        ["Type", str(case.get("case_type") or "—")],
        ["Priority", str(case.get("priority") or "—")],
        ["Status", str(case.get("status") or "—")],
        ["Incident", f"{case.get('incident_date') or '—'} to {case.get('incident_end') or '—'}"],
        ["Primary Location", str(case.get("primary_location") or "—")],
    ]
    t=Table(meta, colWidths=[105, 380]); t.setStyle(TableStyle([("BACKGROUND",(0,0),(0,-1),colors.HexColor("#eaf0f5")),("FONTNAME",(0,0),(0,-1),"Helvetica-Bold"),("FONTSIZE",(0,0),(-1,-1),9),("GRID",(0,0),(-1,-1),0.35,colors.HexColor("#c7d0d9")),("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6)]))
    story.append(t)

    story.append(Paragraph("Verified Evidence", styles["Section"]))
    evidence_rows=[["ID","File","Type","Status","SHA-256"]]
    for e in evidence:
        evidence_rows.append([str(e["id"]), str(e["filename"]), str(e["file_type"]), str(e["processing_status"]), str(e.get("sha256") or "—")[:20] + ("..." if e.get("sha256") else "")])
    et=Table(evidence_rows, colWidths=[35,150,70,80,180], repeatRows=1); et.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#17324d")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTSIZE",(0,0),(-1,-1),7.5),("GRID",(0,0),(-1,-1),0.3,colors.grey),("VALIGN",(0,0),(-1,-1),"TOP")])); story.append(et)

    story.append(Paragraph(f"Verified Entities ({len(entities)})", styles["Section"]))
    entity_rows=[["ID","Entity","Type","Confidence","Status"]]
    for e in entities: entity_rows.append([str(e["id"]), str(e["label"]), str(e["entity_type"]), f"{round(float(e.get('confidence_score') or 0)*100)}%", str(e["verification_status"])])
    tbl=Table(entity_rows, colWidths=[35,220,100,80,70], repeatRows=1); tbl.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#17324d")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTSIZE",(0,0),(-1,-1),8),("GRID",(0,0),(-1,-1),0.3,colors.grey)])); story.append(tbl)

    story.append(Paragraph(f"Verified Relationships ({len(relationships)})", styles["Section"]))
    rel_rows=[["From","Relationship","To","Confidence","Evidence"]]
    for r in relationships: rel_rows.append([str(r["source_label"]), str(r["relationship_type"]), str(r["target_label"]), f"{round(float(r.get('confidence_score') or 0)*100)}%", str(r.get("evidence_sentence") or "—")[:65]])
    tbl=Table(rel_rows, colWidths=[105,95,105,65,140], repeatRows=1); tbl.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#17324d")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTSIZE",(0,0),(-1,-1),7.5),("GRID",(0,0),(-1,-1),0.3,colors.grey),("VALIGN",(0,0),(-1,-1),"TOP")])); story.append(tbl)

    story.append(Paragraph(f"Verified Locations ({len(locations)})", styles["Section"]))
    loc_rows=[["Location","Type","Latitude","Longitude","Address"]]
    for l in locations: loc_rows.append([str(l["label"]), str(l.get("location_type") or "—"), str(l.get("latitude") or "—"), str(l.get("longitude") or "—"), str(l.get("address_text") or "—")[:55]])
    tbl=Table(loc_rows, colWidths=[130,85,70,70,155], repeatRows=1); tbl.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#17324d")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTSIZE",(0,0),(-1,-1),7.5),("GRID",(0,0),(-1,-1),0.3,colors.grey)])); story.append(tbl)

    story.append(Paragraph(f"Verified Timeline ({len(events)})", styles["Section"]))
    event_rows=[["Time","Event","Description","Source"]]
    for e in events: event_rows.append([str(e.get("event_time") or "—"), str(e.get("event_type") or "EVENT"), str(e.get("description") or "—")[:70], str(e.get("source_reference") or "—")[:35]])
    tbl=Table(event_rows, colWidths=[90,90,230,100], repeatRows=1); tbl.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#17324d")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTSIZE",(0,0),(-1,-1),7.5),("GRID",(0,0),(-1,-1),0.3,colors.grey),("VALIGN",(0,0),(-1,-1),"TOP")])); story.append(tbl)

    story.append(Spacer(1, 14))
    story.append(Paragraph("This report contains verified CIPHER records only. AI suggestions and pending/rejected findings are excluded from the verified sections. Generated by CIPHER.", styles["Small"]))
    doc.build(story)
    buf.seek(0)
    from fastapi.responses import StreamingResponse
    filename = f"CIPHER_{case.get('case_number') or case_id}_Case_Report.pdf".replace("/", "-")
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{filename}"'})

# ============================================================
# TIMELINE & AUDIT DATA
# ============================================================
@app.post("/cases/{case_id}/timeline")
@app.post("/api/cases/{case_id}/timeline")
async def create_timeline_event(case_id: int, request: Request, user: dict = Depends(get_current_user)):
    data = await request.json()
    conn = get_db(); require_case(conn, case_id)
    event_type = (data.get("event_type") or data.get("type") or "MANUAL_EVENT").strip()
    description = (data.get("description") or data.get("title") or "Investigator recorded event").strip()
    event_time = data.get("event_time") or data.get("timestamp") or datetime.datetime.utcnow().isoformat()
    status = (data.get("verification_status") or "verified").lower()
    if status not in {"pending","verified","rejected"}: status = "verified"
    entity_id = clean_id(data.get("entity_id")) if data.get("entity_id") not in (None, "") else None
    location_id = clean_id(data.get("location_id")) if data.get("location_id") not in (None, "") else None
    evidence_id = clean_id(data.get("evidence_id")) if data.get("evidence_id") not in (None, "") else None
    if entity_id:
        if not conn.execute("SELECT id FROM entities WHERE id=? AND case_id=?",(entity_id,case_id)).fetchone():
            conn.close(); raise HTTPException(status_code=400, detail="Timeline entity does not belong to this case")
    if location_id:
        if not conn.execute("SELECT id FROM locations WHERE id=? AND case_id=?",(location_id,case_id)).fetchone():
            conn.close(); raise HTTPException(status_code=400, detail="Timeline location does not belong to this case")
    cur=conn.execute("""INSERT INTO timeline_events (case_id,event_type,event_time,description,entity_id,location_id,evidence_id,confidence_score,verification_status,source_reference)
                       VALUES (?,?,?,?,?,?,?,?,?,?)""",(case_id,event_type,event_time,description,entity_id,location_id,evidence_id,float(data.get("confidence_score") or 1.0),status,data.get("source_reference") or "MANUAL_INVESTIGATOR"))
    conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)",(case_id,"TIMELINE_EVENT_CREATED","timeline_event",str(cur.lastrowid),str(user.get("id")),description,"SUCCESS"))
    conn.commit(); row=conn.execute("SELECT * FROM timeline_events WHERE id=?",(cur.lastrowid,)).fetchone(); conn.close()
    return {"status":"success","event":dict(row)}

@app.get("/cases/{case_id}/timeline")

@app.get("/api/cases/{case_id}/timeline")
def list_timeline(case_id: int, status: Optional[str] = None):
    conn = get_db()
    params = [case_id]
    query = "SELECT * FROM timeline_events WHERE case_id = ?"
    if status and status.upper() != "ALL":
        query += " AND UPPER(verification_status) = ?"
        params.append(status.upper())
    query += " ORDER BY event_time ASC, id ASC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    events = [dict(r) for r in rows]
    return {"status": "success", "case_id": case_id, "count": len(events), "events": events, "timeline": events}

@app.get("/cases/{case_id}/audit")
@app.get("/api/cases/{case_id}/audit")
def list_audit(case_id: int):
    conn = get_db()
    rows = conn.execute("SELECT * FROM audit_log WHERE case_id = ? ORDER BY datetime(timestamp) DESC, id DESC", (case_id,)).fetchall()
    conn.close()
    items = [dict(r) for r in rows]
    return {"status": "success", "case_id": case_id, "count": len(items), "audit": items, "items": items}


# ============================================================
# CSV IMPORT & TEMPLATE
# ============================================================
@app.get("/cases/{case_id}/sample-csv")
@app.get("/api/cases/{case_id}/sample-csv")
def get_sample_csv(case_id: int, user: dict = Depends(get_current_user)):
    """Return a case-aware CSV template for the active investigation."""
    import csv
    import io

    conn = get_db()
    case = conn.execute(
        "SELECT id, case_number, title, primary_location, case_type FROM cases WHERE id = ? AND created_by = ?",
        (case_id, user.get("id"))
    ).fetchone()
    conn.close()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case_number = str(case["case_number"] or f"CASE-{case_id}")
    title = str(case["title"] or "Active Investigation")
    location = str(case["primary_location"] or "Location Pending")
    case_type = str(case["case_type"] or "Investigation")

    rows = [
        [f"{title} Subject", "person", f"{case_number} · {case_type}", "", "", "", "", "Case template record"],
        [location, "place", "Primary case location", "", "", f"{title} Subject", "OBSERVED_AT", f"{case_number} location template"],
        [f"{case_number} Evidence Record", "evidence", "Case evidence reference", "", "", f"{title} Subject", "SUPPORTED_BY", "Template row — replace with source evidence"],
    ]

    out = io.StringIO(newline="")
    writer = csv.writer(out)
    writer.writerow(["name", "type", "aliases", "latitude", "longitude", "connected_to", "relationship", "evidence"])
    writer.writerows(rows)
    filename = f"{case_number}_investigation_template.csv"
    return Response(
        content=out.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@app.post("/cases/{case_id}/import-csv")
@app.post("/api/cases/{case_id}/import-csv")
async def import_csv(case_id: int, request: Request, file: Optional[UploadFile] = File(None), mode: Optional[str] = Form(None), user: dict = Depends(get_current_user)):
    """Compatibility CSV endpoint.

    CSV evidence follows the same pipeline as every other uploaded evidence item:
    save → hash → process → PENDING review. It never bypasses human verification.
    The old destructive `replace` behavior is intentionally ignored; re-importing a
    file appends/reconciles suggestions instead of deleting verified investigation data.
    """
    conn = get_db(); require_case(conn, case_id); conn.close()
    if file:
        content = await file.read()
        filename = file.filename or "imported_data.csv"
    else:
        body = await request.json()
        csv_text = body.get("csvText", "")
        filename = body.get("filename") or "imported_data.csv"
        content = csv_text.encode("utf-8")
    if not content:
        raise HTTPException(status_code=400, detail="No CSV text or file provided")
    if not filename.lower().endswith(".csv"):
        filename += ".csv"
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="CSV exceeds upload limit")

    sha256 = hashlib.sha256(content).hexdigest()
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    if storage_configured():
        object_path=f"cases/{case_id}/evidence/{ts}_{os.path.basename(filename)}"
        save_path=upload_bytes(object_path, content, "text/csv")
    else:
        save_path = os.path.join(UPLOADS_DIR, f"{ts}_{os.path.basename(filename)}")
        with open(save_path, "wb") as f:
            f.write(content)
    conn = get_db()
    cur = conn.execute("""INSERT INTO documents (case_id,filename,file_type,file_path,processing_status,uploaded_by,sha256,source_type)
                          VALUES (?,?,?,?,?,?,?,?)""", (case_id, os.path.basename(filename), "text/csv", save_path, "QUEUED", user.get("id",1), sha256, "CSV_UPLOAD"))
    document_id = cur.lastrowid
    conn.execute("INSERT INTO chain_of_custody_logs (case_id,document_id,action,sha256_hash,actor_name) VALUES (?,?,?,?,?)", (case_id,document_id,"EVIDENCE_UPLOADED",sha256,user.get("full_name","Investigator")))
    conn.commit()
    doc = dict(conn.execute("SELECT * FROM documents WHERE id=?",(document_id,)).fetchone())
    conn.close()

    return {
        "status":"queued",
        "message":"CSV evidence queued for background extraction; review can be opened immediately",
        "filename":os.path.basename(filename),
        "document_id":document_id,
        "stats":{
            "totalRows":0,
            "importedEntities":0,
            "importedRelationships":0,
            "importedLocations":0,
            "importedEvents":0,
            "reviewItemsCreated":0,
        },
        "processing_status":"QUEUED",
    }

# ============================================================
# MASTER CSV IMPORTER
# ============================================================
MASTER_TYPES = {
    "case", "nodes", "relationships", "evidence", "locations",
    "observations", "events", "review_queue", "audit_log",
    "ai_test_issues", "test_cases"
}


def _csv_float(value, default=None):
    try:
        if value is None or str(value).strip() == "":
            return default
        parsed = float(value)
        if not math.isfinite(parsed):
            return default
        return parsed
    except (TypeError, ValueError):
        return default


def _csv_confidence(value, default=0.85):
    raw = _csv_float(value, default)
    if raw is None:
        return default
    # Test datasets sometimes use 78 for 78% and sometimes 0.78.
    return raw / 100.0 if raw > 1 else raw


def _status_to_verification(status: str, default="pending"):
    value = (status or "").strip().upper()
    if value in {"VERIFIED", "ACCEPTED", "EDITED", "MERGED"}:
        return "verified"
    if value in {"REJECTED"}:
        return "rejected"
    return default


def _read_master_csv(csv_text: str):
    csv_text = csv_text.replace("\ufeff", "")
    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames or "record_type" not in reader.fieldnames:
        raise HTTPException(status_code=400, detail="Master CSV must contain a record_type column")
    rows = []
    unknown = set()
    for idx, row in enumerate(reader, start=2):
        row = {str(k): ("" if v is None or str(v).strip().lower() in {"nan", "none"} else v) for k, v in row.items()}
        rt = row.get("record_type", "").strip().lower()
        if not rt:
            continue
        if rt not in MASTER_TYPES:
            unknown.add(rt)
            continue
        row["_line"] = idx
        rows.append(row)
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unsupported record_type values: {', '.join(sorted(unknown))}")
    return rows


def _case_external_lookup(conn, external_id: str, owner_id=None):
    if not external_id:
        return None
    if owner_id is None:
        return conn.execute("SELECT * FROM cases WHERE external_id = ? OR case_number = ?", (external_id, external_id)).fetchone()
    return conn.execute("SELECT * FROM cases WHERE created_by=? AND (external_id = ? OR case_number = ?)", (owner_id, external_id, external_id)).fetchone()


def import_master_rows(rows, acting_user_id=None, target_case_id=None):
    """Import the unified CIPHER master CSV into the normalized SQLite schema.

    All records are imported into operational tables. External IDs are retained so
    repeated imports can be traced back to the single source CSV.
    """
    if not acting_user_id:
        raise HTTPException(status_code=401, detail="Authenticated user is required for import")
    conn = get_db()
    result = {"case": 0, "nodes": 0, "relationships": 0, "evidence": 0,
              "locations": 0, "observations": 0, "events": 0, "review_queue": 0,
              "audit_log": 0, "ai_test_issues": 0, "test_cases": 0,
              "skipped": 0, "errors": []}
    maps = {"case": {}, "entity": {}, "relationship": {}, "evidence": {}, "location": {}, "event": {}, "review": {}}

    case_rows = [r for r in rows if r["record_type"] == "case"]
    if not case_rows:
        raise HTTPException(status_code=400, detail="Master CSV must contain one case record")
    if len(case_rows) > 1:
        raise HTTPException(status_code=400, detail="Master CSV must contain exactly one case record")

    c = case_rows[0]
    external_case_id = c.get("case_id") or c.get("case_name") or "MASTER-CASE"
    existing = conn.execute("SELECT * FROM cases WHERE id = ? AND created_by = ?", (target_case_id, acting_user_id)).fetchone() if target_case_id else _case_external_lookup(conn, external_case_id, acting_user_id)
    if existing:
        case_id = existing["id"]
        conn.execute("""UPDATE cases SET title=?, description=?, priority=?, case_type=?, incident_date=?, incident_end=?, primary_location=?, updated_at=datetime('now') WHERE id=?""",
                     (c.get("case_name") or existing["title"], c.get("description") or existing["description"],
                      (c.get("priority") or existing["priority"] or "MEDIUM").upper(), c.get("case_type") or existing["case_type"],
                      c.get("incident_start") or existing["incident_date"], c.get("incident_end") or existing["incident_end"],
                      c.get("primary_location") or existing["primary_location"], case_id))
    else:
        cur = conn.execute("""INSERT INTO cases (case_number,title,description,status,priority,created_by,case_type,incident_date,incident_end,primary_location,assigned_officer,jurisdiction,external_id)
                             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                           (external_case_id, c.get("case_name") or external_case_id, c.get("description") or "",
                            "OPEN", (c.get("priority") or "MEDIUM").upper(), acting_user_id, c.get("case_type") or "Investigation",
                            c.get("incident_start") or None, c.get("incident_end") or None, c.get("primary_location") or None,
                            None, None, external_case_id))
        case_id = cur.lastrowid
    maps["case"][external_case_id] = case_id
    result["case"] = 1

    # Preserve a human-readable link to the source case in the audit log.
    conn.execute("INSERT INTO audit_log (external_id,case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?,?)",
                 (f"IMPORT-{external_case_id}", case_id, "MASTER_CSV_IMPORTED", "case", external_case_id,
                  str(acting_user_id), "Unified CIPHER master CSV import started/completed", "SUCCESS"))

    # Base records first so later relationship/event/review records can resolve IDs.
    for r in rows:
        if r["record_type"] == "nodes":
            ext = r.get("entity_id") or r.get("name")
            if not ext:
                result["skipped"] += 1; continue
            existing = conn.execute("SELECT * FROM entities WHERE case_id=? AND external_id=?", (case_id, ext)).fetchone()
            verification = _status_to_verification(r.get("status"), "pending")
            aliases = r.get("aliases") or ""
            if isinstance(aliases, str):
                aliases = aliases.strip()
            if existing:
                ent_id = existing["id"]
                conn.execute("""UPDATE entities SET entity_type=?, label=?, aliases=?, confidence_score=?, verification_status=?, latitude=?, longitude=?, source_reference=? WHERE id=?""",
                             ((r.get("type") or "PERSON").lower(), r.get("name") or existing["label"], aliases,
                              _csv_confidence(r.get("ai_confidence"), existing["confidence_score"] or 0.85), verification,
                              _csv_float(r.get("latitude")), _csv_float(r.get("longitude")), r.get("source_reference"), ent_id))
            else:
                cur = conn.execute("""INSERT INTO entities (case_id,entity_type,label,aliases,confidence_score,verification_status,latitude,longitude,external_id,source_reference,evidence_id_text)
                                     VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                                   (case_id, (r.get("type") or "PERSON").lower(), r.get("name") or ext, aliases,
                                    _csv_confidence(r.get("ai_confidence")), verification, _csv_float(r.get("latitude")), _csv_float(r.get("longitude")),
                                    ext, r.get("source_reference"), r.get("primary_evidence_id") or r.get("evidence_id")))
                ent_id = cur.lastrowid
            maps["entity"][ext] = ent_id
            result["nodes"] += 1

    for r in rows:
        if r["record_type"] == "evidence":
            ext = r.get("evidence_id") or r.get("file_name")
            if not ext:
                result["skipped"] += 1; continue
            existing = conn.execute("SELECT * FROM documents WHERE case_id=? AND external_id=?", (case_id, ext)).fetchone()
            file_name = r.get("file_name") or ext
            file_type = r.get("file_type") or "application/octet-stream"
            status = (r.get("status") or "UPLOADED").upper()
            if existing:
                doc_id = existing["id"]
                conn.execute("""UPDATE documents SET filename=?,file_type=?,processing_status=?,sha256=?,source_type=?,description=?,uploaded_by=?,processed_at=? WHERE id=?""",
                             (file_name,file_type,status,r.get("sha256") or existing["sha256"],r.get("source_type"),r.get("description"),acting_user_id,r.get("processed_at"),doc_id))
            else:
                cur = conn.execute("""INSERT INTO documents (case_id,filename,file_type,file_path,processing_status,uploaded_by,external_id,sha256,source_type,description,uploaded_at,processed_at)
                                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                                   (case_id,file_name,file_type,f"master-csv://{external_case_id}/{ext}",status,acting_user_id,ext,r.get("sha256") or None,
                                    r.get("source_type") or "MASTER_CSV",r.get("description") or "Imported from unified master CSV",r.get("uploaded_at") or None,r.get("processed_at") or None))
                doc_id = cur.lastrowid
            maps["evidence"][ext] = doc_id
            result["evidence"] += 1

    for r in rows:
        if r["record_type"] == "locations":
            ext = r.get("location_id") or r.get("name")
            if not ext:
                result["skipped"] += 1; continue
            existing = conn.execute("SELECT * FROM locations WHERE case_id=? AND external_id=?", (case_id, ext)).fetchone()
            vals = ((r.get("name") or ext), _csv_float(r.get("latitude"), 0), _csv_float(r.get("longitude"), 0),
                    r.get("type") or "LOCATION", r.get("address"), _csv_float(r.get("accuracy_m")),
                    maps["evidence"].get(r.get("primary_evidence_id")), r.get("source_id"), r.get("observed_at"),
                    _status_to_verification(r.get("status"), "pending"), r.get("source_reference"))
            if existing:
                loc_id = existing["id"]
                conn.execute("""UPDATE locations SET label=?,latitude=?,longitude=?,location_type=?,address_text=?,accuracy_m=?,primary_evidence_id=?,source_id=?,observed_at=?,verification_status=?,source_reference=? WHERE id=?""", vals+(loc_id,))
            else:
                cur = conn.execute("""INSERT INTO locations (case_id,entity_id,label,latitude,longitude,location_type,address_text,source_document_id,verification_status,event_timestamp,external_id,accuracy_m,primary_evidence_id,source_id,observed_at,source_reference)
                                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                                   (case_id,None,vals[0],vals[1],vals[2],vals[3],vals[4],vals[6],vals[9],vals[8],ext,vals[5],vals[6],vals[7],vals[8],vals[10]))
                loc_id = cur.lastrowid
            maps["location"][ext] = loc_id
            result["locations"] += 1

    # Observations become verified/pending spatial events.
    for r in rows:
        if r["record_type"] == "observations":
            ext = r.get("observation_id") or f"OBS-{r.get('_line')}"
            loc_id = maps["location"].get(r.get("location_id"))
            ent_id = maps["entity"].get(r.get("entity_id") or r.get("related_entity_id"))
            if not loc_id:
                # Some test datasets use location_id in source_id; skip only if truly unresolved.
                result["skipped"] += 1; continue
            cur = conn.execute("""INSERT INTO spatial_events (case_id,entity_name,entity_type,location_id,timestamp,confidence_score,source_document)
                                 VALUES (?,?,?,?,?,?,?)""",
                               (case_id,r.get("name") or r.get("entity_id") or "Unknown",r.get("type") or "PERSON",loc_id,
                                r.get("observed_at") or datetime.datetime.utcnow().isoformat(),_csv_confidence(r.get("ai_confidence")),r.get("source_id")))
            result["observations"] += 1

    # Relationships after entities are present.
    for r in rows:
        if r["record_type"] == "relationships":
            ext = r.get("relationship_id") or f"REL-{r.get('_line')}"
            src_ext = r.get("relationship_source") or r.get("source_entity_id") or r.get("source_id")
            dst_ext = r.get("relationship_target") or r.get("target_entity_id") or r.get("target_id")
            if src_ext in {None, "", "nan", "NaN"}: src_ext = None
            if dst_ext in {None, "", "nan", "NaN"}: dst_ext = None
            src_id = maps["entity"].get(src_ext)
            dst_id = maps["entity"].get(dst_ext)
            if not src_id or not dst_id:
                result["skipped"] += 1
                result["errors"].append(f"Relationship {ext}: unresolved source/target {src_ext}/{dst_ext}")
                continue
            existing = conn.execute("SELECT * FROM relationships WHERE case_id=? AND external_id=?", (case_id, ext)).fetchone()
            args = (case_id,src_id,dst_id,r.get("relationship_type") or "ASSOCIATED_WITH",r.get("description") or r.get("reason") or "",maps["evidence"].get(r.get("evidence_id")),_csv_confidence(r.get("ai_confidence")),_status_to_verification(r.get("status"),"pending"),ext,r.get("source_reference"),src_ext,dst_ext,r.get("relationship_source") or "MASTER_CSV")
            if existing:
                rel_id = existing["id"]
                conn.execute("""UPDATE relationships SET source_entity_id=?,target_entity_id=?,relationship_type=?,evidence_sentence=?,source_document_id=?,confidence_score=?,verification_status=?,source_reference=?,source_external_id=?,target_external_id=?,source_type=? WHERE id=?""", args[1:]+(rel_id,))
            else:
                cur=conn.execute("""INSERT INTO relationships (case_id,source_entity_id,target_entity_id,relationship_type,evidence_sentence,source_document_id,confidence_score,verification_status,external_id,source_reference,source_external_id,target_external_id,source_type)
                                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""", args)
                rel_id=cur.lastrowid
            maps["relationship"][ext]=rel_id
            result["relationships"] += 1

    # Timeline/events after location and evidence mappings exist.
    for r in rows:
        if r["record_type"] == "events":
            ext = r.get("event_id") or f"EVT-{r.get('_line')}"
            conn.execute("DELETE FROM timeline_events WHERE case_id=? AND external_id=?", (case_id, ext))
            cur=conn.execute("""INSERT INTO timeline_events (external_id,case_id,event_type,event_time,description,entity_id,location_id,evidence_id,confidence_score,verification_status,source_reference)
                               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                             (ext,case_id,r.get("event_type") or "EVENT",r.get("event_time") or None,r.get("description") or r.get("details") or "",
                              maps["entity"].get(r.get("entity_id") or r.get("related_entity_id")),maps["location"].get(r.get("location_id")),maps["evidence"].get(r.get("evidence_id")),
                              _csv_confidence(r.get("confidence") or r.get("ai_confidence")),_status_to_verification(r.get("status"),"pending"),r.get("source_reference")))
            maps["event"][ext]=cur.lastrowid
            result["events"] += 1

    # Review queue — preserve the officer-review gate.
    for r in rows:
        if r["record_type"] == "review_queue":
            ext = r.get("review_id") or f"REV-{r.get('_line')}"
            item_type=(r.get("type") or r.get("target_type") or "entity").lower()
            entity_id=maps["entity"].get(r.get("entity_id") or r.get("target_id"))
            rel_id=maps["relationship"].get(r.get("relationship_id") or r.get("target_id"))
            loc_id=maps["location"].get(r.get("location_id") or r.get("target_id"))
            event_id=maps["event"].get(r.get("event_id") or r.get("target_id"))
            evidence_id=maps["evidence"].get(r.get("evidence_id"))
            existing=conn.execute("SELECT * FROM review_items WHERE case_id=? AND external_id=?",(case_id,ext)).fetchone()
            params=(case_id,item_type.upper(),r.get("reason") or f"Master CSV review item {ext}",r.get("reason") or "Officer review required",r.get("source_reference") or "master_csv",
                    _csv_confidence(r.get("ai_confidence") or r.get("confidence")),r.get("status") or "PENDING",item_type,entity_id,rel_id,loc_id,event_id,evidence_id,
                    r.get("source_reference"),r.get("reason") or "",json.dumps({k:v for k,v in r.items() if k not in {"_line","record_type"}}),_csv_confidence(r.get("ai_confidence") or r.get("confidence")),
                    r.get("reason") or "Imported from master CSV",r.get("review_note") or "MEDIUM",ext)
            if existing:
                review_id=existing["id"]
            else:
                cur=conn.execute("""INSERT INTO review_items (case_id,suggestion_type,title,description,source_document,confidence_score,status,type,entity_id,relationship_id,location_id,event_id,evidence_id,source_reference,extracted_context,ai_output,confidence,reason,priority,external_id)
                                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                                 params)
                review_id=cur.lastrowid
            maps["review"][ext]=review_id
            result["review_queue"]+=1

    for r in rows:
        if r["record_type"] == "audit_log":
            ext=r.get("audit_id") or f"AUD-{r.get('_line')}"
            actor=r.get("actor") or "system"
            target_id=r.get("target_id") or ""
            conn.execute("INSERT INTO audit_log (external_id,case_id,action,target_type,target_id,actor,timestamp,details,status) VALUES (?,?,?,?,?,?,?,?,?)",
                         (ext,case_id,r.get("action") or "IMPORT_EVENT",r.get("target_type"),target_id,actor,r.get("timestamp") or datetime.datetime.utcnow().isoformat(),r.get("details") or "",r.get("status") or "IMPORTED"))
            result["audit_log"]+=1

    for r in rows:
        if r["record_type"] == "ai_test_issues":
            conn.execute("INSERT INTO ai_test_issues (issue_id,case_id,issue_type,description,related_entity_id,related_evidence_id,status,details) VALUES (?,?,?,?,?,?,?,?)",
                         (r.get("issue_id"),case_id,r.get("issue_type"),r.get("description"),r.get("related_entity_id"),r.get("related_evidence_id"),r.get("status") or "OPEN",r.get("details") or ""))
            result["ai_test_issues"]+=1

    for r in rows:
        if r["record_type"] == "test_cases":
            conn.execute("INSERT INTO test_cases (test_id,case_id,test_area,test_action,expected_result,status) VALUES (?,?,?,?,?,?)",
                         (r.get("test_id"),case_id,r.get("test_area"),r.get("test_action"),r.get("expected_result"),"NOT_RUN"))
            result["test_cases"]+=1

    conn.commit()
    conn.close()
    result["case_id"] = case_id
    result["case_external_id"] = external_case_id
    return result


@app.post("/api/import/master-csv")
@app.post("/import/master-csv")
async def import_master_csv(request: Request, file: Optional[UploadFile] = File(None)):
    user = get_current_user(request)
    if file:
        content = await file.read()
        text = content.decode("utf-8-sig", errors="replace")
        filename = file.filename or "master.csv"
    else:
        body = await request.json()
        text = body.get("csvText") or ""
        filename = body.get("filename") or "master.csv"
    if not text.strip():
        raise HTTPException(status_code=400, detail="Master CSV is empty")
    rows = _read_master_csv(text)
    result = import_master_rows(rows, acting_user_id=int(user.get("id", 1)))
    result["filename"] = filename
    try:
        # Master CSV is already the evidence source; index its exact uploaded contents
        # even though its normalized document record may not have a local file path.
        case_id = int(result["case_id"])
        conn = get_db(); docs = conn.execute("SELECT id,sha256 FROM documents WHERE case_id=? ORDER BY id DESC LIMIT 1", (case_id,)).fetchone(); conn.close()
        if docs:
            index_text_document(case_id, int(docs["id"]), filename, text, docs["sha256"] if "sha256" in docs.keys() else None)
            result["rag"] = {"status":"READY","chunks":rag_health(case_id).get("chunks",0)}
    except Exception as exc:
        result["rag"] = {"status":"FAILED","error":str(exc)[:500]}
    return {"status":"success", "message":"Unified master CSV imported successfully", "import":result}


@app.post("/cases/{case_id}/import-master-csv")
@app.post("/api/cases/{case_id}/import-master-csv")
async def import_case_master_csv(case_id: int, request: Request, file: Optional[UploadFile] = File(None)):
    user = get_current_user(request)
    conn = get_db()
    require_case(conn, case_id)
    conn.close()
    if file:
        text=(await file.read()).decode("utf-8-sig", errors="replace")
        filename=file.filename or "master.csv"
    else:
        body=await request.json()
        text=body.get("csvText") or ""
        filename=body.get("filename") or "master.csv"
    rows=_read_master_csv(text)
    # Force the case record to the selected case when using the case-scoped endpoint.
    for row in rows:
        if row["record_type"] == "case":
            row["case_id"] = str(case_id)
    result=import_master_rows(rows, acting_user_id=int(user.get("id",1)), target_case_id=case_id)
    result["filename"]=filename
    try:
        conn=get_db(); docs=conn.execute("SELECT id,sha256 FROM documents WHERE case_id=? ORDER BY id DESC LIMIT 1",(case_id,)).fetchone(); conn.close()
        if docs:
            index_text_document(case_id,int(docs["id"]),filename,text,docs["sha256"] if "sha256" in docs.keys() else None)
            result["rag"]={"status":"READY","chunks":rag_health(case_id).get("chunks",0)}
    except Exception as exc:
        result["rag"]={"status":"FAILED","error":str(exc)[:500]}
    return {"status":"success","message":"Unified master CSV imported into selected case","import":result}

# ============================================================
# REVIEW QUEUE & CHAIN OF CUSTODY
# ============================================================
def promote_review_item(row, status: str, note: str = "", reviewer: Optional[dict] = None):
    conn=get_db(); verified_status="verified" if status in {"ACCEPTED","EDITED","MERGED"} else "rejected"
    before=dict(row)
    if row["entity_id"]: conn.execute("UPDATE entities SET verification_status=? WHERE id=? AND case_id=?",(verified_status,row["entity_id"],row["case_id"]))
    if row["relationship_id"]: conn.execute("UPDATE relationships SET verification_status=? WHERE id=? AND case_id=?",(verified_status,row["relationship_id"],row["case_id"]))
    if row["location_id"]: conn.execute("UPDATE locations SET verification_status=? WHERE id=? AND case_id=?",(verified_status,row["location_id"],row["case_id"]))
    if row["event_id"]: conn.execute("UPDATE timeline_events SET verification_status=? WHERE id=? AND case_id=?",(verified_status,row["event_id"],row["case_id"]))
    # Face candidates use a dedicated table but share the review decision.
    try:
        if str(row["suggestion_type"] or "").upper() == "FACE_MATCH":
            payload=json.loads(row["ai_output"] or "{}") if isinstance(row["ai_output"],str) else (row["ai_output"] or {})
            face_match_id=payload.get("face_match_id")
            if face_match_id:
                conn.execute("UPDATE face_matches SET status=?, reviewed_at=datetime('now') WHERE id=? AND case_id=?", ("VERIFIED" if verified_status=="verified" else "REJECTED", face_match_id, row["case_id"]))
    except Exception:
        pass
    reviewer_name=(reviewer or {}).get("full_name") or (reviewer or {}).get("email") or "Investigator"
    reviewer_id=str((reviewer or {}).get("id") or "")
    conn.execute("UPDATE review_items SET status=?,review_note=?,reviewed_at=datetime('now'),reviewed_by=? WHERE id=?",(status,note,reviewer_name,row["id"]))
    updated=conn.execute("SELECT * FROM review_items WHERE id=?",(row["id"],)).fetchone()
    conn.execute("INSERT INTO review_actions (review_item_id,case_id,action,old_value_json,new_value_json,reason,reviewer_id) VALUES (?,?,?,?,?,?,?)",(row["id"],row["case_id"],status,json.dumps(before,default=str),json.dumps(dict(updated),default=str),note,reviewer_id))
    conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)",(row["case_id"],f"REVIEW_{status}","review_item",str(row["id"]),reviewer_name,note or "Investigator review decision","SUCCESS"))
    conn.commit(); conn.close()
    # Verified graph projection is downstream of human review. A Neo4j outage must not
    # invalidate the relational review decision; it is recorded for the next sync.
    if status in {"ACCEPTED","EDITED","MERGED"}:
        try:
            from .neo4j_graph import sync_case
            c2=get_db(); ents=[dict(x) for x in c2.execute("SELECT * FROM entities WHERE case_id=? AND verification_status='verified'",(row["case_id"],)).fetchall()]; rels=[dict(x) for x in c2.execute("SELECT * FROM relationships WHERE case_id=? AND verification_status='verified'",(row["case_id"],)).fetchall()]; c2.close()
            sync_case(row["case_id"],ents,rels)
        except Exception:
            pass
    return dict(updated)

def update_review_status(review_id: int, status: str, note: Optional[str] = None, reviewer: Optional[dict] = None):
    conn = get_db()
    row = conn.execute("SELECT * FROM review_items WHERE id = ?", (review_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Review item not found")
    return {"status": "success", "review": promote_review_item(row, status, note or "", reviewer), "note": note or ""}

@app.get("/cases/{case_id}/review")
@app.get("/api/cases/{case_id}/review")
def list_case_reviews(case_id: int, status: Optional[str] = None, type: Optional[str] = None, confidence: Optional[str] = None, source: Optional[str] = None, sort: Optional[str] = None, search: Optional[str] = None):
    conn = get_db()
    query = "SELECT * FROM review_items WHERE case_id = ?"
    params = [case_id]
    if status and status.upper() != "ALL":
        query += " AND UPPER(status) = ?"
        params.append(status.upper())
    elif not status:
        query += " AND UPPER(status) = 'PENDING'"
    if type and type.upper() != "ALL":
        query += " AND LOWER(COALESCE(type, suggestion_type)) = ?"
        params.append(type.lower())
    if confidence:
        confidence_upper = confidence.upper()
        if confidence_upper == "HIGH":
            query += " AND COALESCE(confidence, confidence_score) >= 0.90"
        elif confidence_upper == "MEDIUM":
            query += " AND COALESCE(confidence, confidence_score) >= 0.70 AND COALESCE(confidence, confidence_score) < 0.90"
        elif confidence_upper == "LOW":
            query += " AND COALESCE(confidence, confidence_score) < 0.70"
    if source and source.upper() != "ALL":
        query += " AND source_document = ?"
        params.append(source)
    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query += " AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(COALESCE(extracted_context, '')) LIKE ? OR LOWER(COALESCE(source_document, '')) LIKE ?)"
        params.extend([term, term, term, term])
    query += " ORDER BY COALESCE(confidence, confidence_score) DESC, id DESC" if sort == "confidence" else " ORDER BY id DESC"
    rows = conn.execute(query, params).fetchall()
    all_rows = conn.execute("SELECT * FROM review_items WHERE case_id = ?", (case_id,)).fetchall()
    conn.close()

    def normalize(row):
        item = dict(row)
        item["confidence"] = item.get("confidence") if item.get("confidence") is not None else item.get("confidence_score", 0.85)
        item["confidence_level"] = "High" if item["confidence"] >= 0.90 else "Medium" if item["confidence"] >= 0.70 else "Low"
        item["type"] = item.get("type") or {"ENTITY_EXTRACTION": "entity", "RELATIONSHIP_EXTRACTION": "relationship", "EVENT_EXTRACTION": "event", "ENTITY_RESOLUTION": "duplicate"}.get(item.get("suggestion_type"), "event")
        try:
            item["parsed_output"] = json.loads(item.get("ai_output")) if isinstance(item.get("ai_output"), str) else item.get("ai_output")
        except (TypeError, json.JSONDecodeError):
            item["parsed_output"] = {}
        item["ai_output"] = item["parsed_output"] or {}
        return item

    items = [normalize(row) for row in rows]
    all_items = [normalize(row) for row in all_rows]
    pending = [item for item in all_items if str(item.get("status", "")).upper() == "PENDING"]
    by_type = {key: sum(1 for item in pending if item.get("type") == key) for key in ("entity", "relationship", "location", "duplicate", "event")}
    pending_conf = [item["confidence"] for item in pending]
    sources = sorted({item["source_document"] for item in all_items if item.get("source_document")})
    summary = {
        "pending": len(pending),
        "pending_count": len(pending),
        "accepted": sum(1 for item in all_items if str(item.get("status", "")).upper() == "ACCEPTED"),
        "rejected": sum(1 for item in all_items if str(item.get("status", "")).upper() == "REJECTED"),
        "edited": sum(1 for item in all_items if str(item.get("status", "")).upper() == "EDITED"),
        "low_confidence": sum(1 for value in pending_conf if value < 0.70),
        "by_type": by_type,
        "by_confidence": {"high": sum(1 for value in pending_conf if value >= 0.90), "medium": sum(1 for value in pending_conf if 0.70 <= value < 0.90), "low": sum(1 for value in pending_conf if value < 0.70)},
        "metrics": {"pending": len(pending), "verified_today": sum(1 for item in all_items if str(item.get("status", "")).upper() in {"ACCEPTED", "EDITED"}), "rejected_today": sum(1 for item in all_items if str(item.get("status", "")).upper() == "REJECTED"), "edited_today": sum(1 for item in all_items if str(item.get("status", "")).upper() == "EDITED")}
    }
    return {"status": "success", "case_id": case_id, "items": items, "count": len(items), "reviews": items, "data": items, "sources": sources, "summary": summary}

@app.get("/review/{review_id}")
@app.get("/api/review/{review_id}")
def get_review(review_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM review_items WHERE id = ?", (review_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Review item not found")
    return {"status": "success", "review": dict(row)}

@app.post("/cases/{case_id}/review/{object_id}")
@app.post("/api/cases/{case_id}/review/{object_id}")
async def review_object(case_id: int, object_id: str, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    decision = (body.get("decision") or "ACCEPT").upper()
    target = object_id.lower()
    conn = get_db()
    if target.startswith("ent-"):
        table, raw_id = "entities", clean_id(object_id)
    elif target.startswith("loc-"):
        table, raw_id = "locations", clean_id(object_id)
    else:
        table, raw_id = "review_items", clean_id(object_id)
    row = conn.execute(f"SELECT * FROM {table} WHERE id = ? AND case_id = ?", (raw_id, case_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Review target not found")
    status = "verified" if decision.startswith("ACCEPT") else "rejected"
    if table == "review_items":
        result = update_review_status(raw_id, "ACCEPTED" if decision.startswith("ACCEPT") else "REJECTED", body.get("reason"), user)
        return {"status": "success", "target": raw_id, "decision": decision, "review": result["review"]}
    conn = get_db()
    conn.execute(f"UPDATE {table} SET verification_status = ? WHERE id = ? AND case_id = ?", (status, raw_id, case_id))
    conn.commit()
    conn.close()
    return {"status": "success", "target": object_id, "decision": decision, "new_status": status}

@app.post("/review/{review_id}/accept")
@app.post("/api/review/{review_id}/accept")
async def accept_review(review_id: int, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json() if request.headers.get("content-length") else {}
    return update_review_status(review_id, "ACCEPTED", body.get("note"), user)

@app.post("/review/{review_id}/reject")
@app.post("/api/review/{review_id}/reject")
async def reject_review(review_id: int, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json() if request.headers.get("content-length") else {}
    return update_review_status(review_id, "REJECTED", body.get("reason") or body.get("note"), user)

@app.post("/review/{review_id}/edit")
@app.post("/api/review/{review_id}/edit")
async def edit_review(review_id: int, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    conn = get_db()
    row = conn.execute("SELECT * FROM review_items WHERE id = ?", (review_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Review item not found")
    edited_data = body.get("edited_data") or body.get("ai_output") or {}
    if isinstance(edited_data, str):
        try:
            edited_data = json.loads(edited_data)
        except json.JSONDecodeError:
            edited_data = {}
    title = body.get("title", row["title"])
    description = body.get("description", row["description"])
    conn.execute("UPDATE review_items SET title = ?, description = ?, ai_output = ?, review_note = ? WHERE id = ?", (title, description, json.dumps(edited_data), body.get("review_note") or body.get("note") or "", review_id))
    if row["entity_id"]:
        conn.execute("UPDATE entities SET label = COALESCE(?, label), entity_type = COALESCE(?, entity_type), aliases = COALESCE(?, aliases) WHERE id = ? AND case_id = ?", (edited_data.get("name"), edited_data.get("entity_type") or edited_data.get("type"), "; ".join(edited_data.get("aliases", [])) if isinstance(edited_data.get("aliases"), list) else edited_data.get("aliases"), row["entity_id"], row["case_id"]))
    if row["relationship_id"]:
        conn.execute("UPDATE relationships SET relationship_type = COALESCE(?, relationship_type), evidence_sentence = COALESCE(?, evidence_sentence) WHERE id = ? AND case_id = ?", (edited_data.get("relationship_type"), edited_data.get("evidence_quote") or edited_data.get("evidence_sentence"), row["relationship_id"], row["case_id"]))
    if row["location_id"]:
        conn.execute("UPDATE locations SET label = COALESCE(?, label), address_text = COALESCE(?, address_text), latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude) WHERE id = ? AND case_id = ?", (edited_data.get("name"), edited_data.get("address"), _safe_float(edited_data.get("latitude")), _safe_float(edited_data.get("longitude")), row["location_id"], row["case_id"]))
    conn.commit()
    updated = conn.execute("SELECT * FROM review_items WHERE id = ?", (review_id,)).fetchone()
    conn.close()
    return {"status": "success", "review": promote_review_item(updated, "EDITED", body.get("review_note") or body.get("note") or "", user)}

@app.post("/review/{review_id}/merge")
@app.post("/api/review/{review_id}/merge")
async def merge_review(review_id: int, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    return update_review_status(review_id, "MERGED", body.get("note"), user)

@app.post("/review/bulk-accept")
@app.post("/api/review/bulk-accept")
async def bulk_accept_reviews(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    review_ids = body.get("review_ids") or []
    if not isinstance(review_ids, list) or not review_ids:
        raise HTTPException(status_code=400, detail="Array of review_ids is required for bulk accept.")
    accepted = 0
    for review_id in review_ids:
        try:
            update_review_status(clean_id(review_id), "ACCEPTED", body.get("note"), user)
            accepted += 1
        except HTTPException:
            continue
    return {"status": "success", "accepted_count": accepted}

@app.get("/cases/{case_id}/review/history")
@app.get("/api/cases/{case_id}/review/history")
def review_history(case_id: int):
    conn = get_db()
    rows = conn.execute("SELECT * FROM review_items WHERE case_id = ? AND UPPER(status) != 'PENDING' ORDER BY id DESC", (case_id,)).fetchall()
    conn.close()
    return {"status": "success", "case_id": case_id, "history": [dict(r) for r in rows]}

@app.post("/review-queue/{item_id}/decision")
@app.post("/api/review-queue/{item_id}/decision")
async def review_queue_decision(item_id: int, request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    decision = (body.get("decision") or "ACCEPT").upper()
    return update_review_status(item_id, "ACCEPTED" if decision in {"ACCEPT", "APPROVE"} else "REJECTED", body.get("reason"), user)

@app.get("/cases/{case_id}/review-queue")
@app.get("/api/cases/{case_id}/review-queue")
def get_review_queue(case_id: int):
    conn = get_db()
    rows = conn.execute("SELECT * FROM review_items WHERE case_id = ?", (case_id,)).fetchall()
    conn.close()
    return {"status": "success", "count": len(rows), "review_queue": [dict(r) for r in rows]}

@app.get("/cases/{case_id}/blockchain-custody")
@app.get("/api/cases/{case_id}/blockchain-custody")
def get_blockchain_custody(case_id: int):
    conn = get_db()
    rows = conn.execute("SELECT * FROM chain_of_custody_logs WHERE case_id = ?", (case_id,)).fetchall()
    conn.close()
    return {"status": "success", "count": len(rows), "chain_of_custody": [dict(r) for r in rows], "mode": "hash_based_audit_ledger"}

# ============================================================
# AI INVESTIGATOR (PORT OF THE TS BACKEND)
# ============================================================
@app.get("/api/ai/cases")
@app.get("/ai/cases")
def ai_accessible_cases(user: dict = Depends(get_current_user)):
    """Return cases available to the authenticated investigator so AI can switch context safely."""
    conn=get_db()
    rows=conn.execute("SELECT id,case_number,title,status,priority,case_type,incident_date,primary_location,updated_at FROM cases WHERE created_by=? ORDER BY updated_at DESC, id DESC", (user.get("id"),)).fetchall()
    conn.close()
    return {"status":"success","count":len(rows),"cases":[dict(r) for r in rows]}

SYSTEM_PROMPT = """You are CIPHER AI Investigator, an augmented investigative co-pilot.
Use ONLY the data provided by authorized CIPHER tools.
Never invent evidence or people.
Return valid JSON with answer, answer_type, confidence, sources, actions, highlights.
"""


def get_case_summary(case_id: int):
    conn = get_db()
    case_row = conn.execute("SELECT * FROM cases WHERE id = ?", (case_id,)).fetchone()
    if not case_row:
        conn.close()
        return {"case_number": "N/A", "case_title": "Unknown case", "evidence_items_total": 0, "verified_entities_total": 0, "verified_relationships_total": 0, "verified_locations_total": 0, "pending_review_total": 0, "entity_type_breakdown": {"person": 0, "phone": 0, "vehicle": 0, "organisation": 0, "place": 0, "account": 0}}

    entity_breakdown = conn.execute("SELECT entity_type, COUNT(*) as c FROM entities WHERE case_id = ? GROUP BY entity_type", (case_id,)).fetchall()
    breakdown = {"person": 0, "phone": 0, "vehicle": 0, "organisation": 0, "place": 0, "account": 0}
    for row in entity_breakdown:
        key = row["entity_type"]
        if key in breakdown:
            breakdown[key] = row["c"]

    doc_total = conn.execute("SELECT COUNT(*) as c FROM documents WHERE case_id = ?", (case_id,)).fetchone()["c"]
    rel_total = conn.execute("SELECT COUNT(*) as c FROM relationships WHERE case_id = ? AND verification_status = 'verified'", (case_id,)).fetchone()["c"]
    loc_total = conn.execute("SELECT COUNT(*) as c FROM locations WHERE case_id = ? AND verification_status = 'verified'", (case_id,)).fetchone()["c"]
    pending_total = conn.execute("SELECT COUNT(*) as c FROM review_items WHERE case_id = ? AND UPPER(status) = 'PENDING'", (case_id,)).fetchone()["c"]
    entity_total = conn.execute("SELECT COUNT(*) as c FROM entities WHERE case_id = ? AND verification_status = 'verified'", (case_id,)).fetchone()["c"]
    conn.close()

    return {
        "case_number": case_row["case_number"],
        "case_title": case_row["title"],
        "evidence_items_total": doc_total,
        "verified_entities_total": entity_total,
        "verified_relationships_total": rel_total,
        "verified_locations_total": loc_total,
        "pending_review_total": pending_total,
        "entity_type_breakdown": breakdown,
    }


def get_user_summary(case_id: int):
    conn = get_db()
    pending = conn.execute("SELECT COUNT(*) as c FROM review_items WHERE case_id = ? AND status = 'PENDING'", (case_id,)).fetchone()["c"]
    duplicates = conn.execute("SELECT COUNT(*) as c FROM review_items WHERE case_id = ? AND suggestion_type = 'ENTITY_RESOLUTION' AND status = 'PENDING'", (case_id,)).fetchone()["c"]
    conflicts = conn.execute("SELECT COUNT(*) as c FROM review_items WHERE case_id = ? AND suggestion_type = 'EVIDENCE_CONFLICT' AND status = 'PENDING'", (case_id,)).fetchone()["c"]
    conn.close()
    return {"new_suggestions_count": pending, "possible_duplicates_count": duplicates, "evidence_conflicts_count": conflicts}


def deterministic_response(tool_name: str, tool_data: Any, default_type: str, confidence: Optional[str], sources: List[dict], actions: List[dict], highlights: dict):
    if tool_name == "get_case_summary":
        d = tool_data
        answer = (
            f"Case {d['case_number']} ({d['case_title']}) is currently OPEN with HIGH priority. "
            f"The case comprises {d['verified_entities_total']} verified entities broken down into "
            f"{d['entity_type_breakdown'].get('person', 0)} persons, {d['entity_type_breakdown'].get('phone', 0)} phone numbers, "
            f"{d['entity_type_breakdown'].get('organisation', 0)} organisations, {d['entity_type_breakdown'].get('place', 0)} places, "
            f"{d['entity_type_breakdown'].get('account', 0)} account, and {d['entity_type_breakdown'].get('vehicle', 0)} vehicle. "
            f"Additionally, the index records {d['verified_relationships_total']} verified relationships, "
            f"{d['verified_locations_total']} verified locations, {d['evidence_items_total']} evidence items, "
            f"{d['pending_review_total']} pending review items."
        )
    else:
        answer = f"Information retrieved from case database under controlled backend query '{tool_name}'."

    return {
        "answer": answer,
        "answer_type": default_type,
        "confidence": confidence,
        "sources": sources,
        "actions": actions,
        "highlights": highlights,
        "provider": "deterministic",
    }


def call_gemini(prompt: str):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not configured")

    primary = (os.getenv("GEMINI_MODEL", "gemini-3.6-flash") or "gemini-3.6-flash").strip()
    fallback_text = os.getenv("GEMINI_MODEL_FALLBACKS", "")
    models = []
    for model in [primary] + [item.strip() for item in fallback_text.split(",") if item.strip()]:
        if model and model not in models:
            models.append(model)
    last_error = None
    for model in models:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            payload = {
                "system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]},
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
            }
            response = requests.post(url, json=payload, timeout=25)
            if response.status_code == 404:
                last_error = Exception(f"{model} not available")
                continue
            if response.status_code >= 400:
                raise ValueError(f"Gemini HTTP {response.status_code}: {response.text[:300]}")
            data = response.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except Exception as exc:
            last_error = exc
    raise last_error or ValueError("Gemini request failed")


def call_groq(prompt: str):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not configured")

    payload = {
        "model": "openai/gpt-oss-20b",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    response = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, timeout=25)
    if response.status_code >= 400:
        raise ValueError(f"Groq HTTP {response.status_code}: {response.text[:300]}")
    data = response.json()
    txt = data["choices"][0]["message"]["content"]
    return json.loads(txt)


def deterministic_ai_answer(case_id: int, question: str, context: dict) -> dict:
    case = context.get("case") or {}
    verified_entities = [e for e in context.get("entities", []) if str(e.get("verification_status", "")).lower() == "verified"]
    verified_rels = [r for r in context.get("relationships", []) if str(r.get("verification_status", "")).lower() == "verified"]
    verified_locs = [l for l in context.get("locations", []) if str(l.get("verification_status", "")).lower() == "verified"]
    verified_events = [e for e in context.get("timeline", []) if str(e.get("verification_status", "")).lower() == "verified"]
    pending = len(context.get("pending_review", []))
    q = question.lower()
    answer = (
        f"Case {case.get('case_number') or case_id} — {case.get('title') or 'Investigation'}. "
        f"The current database contains {len(verified_entities)} verified entities, "
        f"{len(verified_rels)} verified relationships, {len(verified_locs)} verified locations, "
        f"and {len(verified_events)} verified timeline events, with {pending} pending review items."
    )
    answer_type = "computed"
    if any(k in q for k in ("pending", "review", "unverified")):
        answer = f"There are {pending} pending review items in the active case. Pending findings are not treated as verified graph evidence."
        answer_type = "source_backed"
    elif any(k in q for k in ("entities", "people", "persons", "nodes")):
        answer = f"The active case has {len(verified_entities)} verified entities. Pending or rejected entities are excluded from the trusted graph."
        answer_type = "source_backed"
    elif any(k in q for k in ("relationship", "relationships", "links", "network")):
        answer = f"The active case has {len(verified_rels)} verified relationships between verified entities."
        answer_type = "source_backed"
    elif any(k in q for k in ("location", "gis", "map", "where")):
        answer = f"The active case has {len(verified_locs)} verified locations available to GIS. Relationship corridors are generated only when verified endpoints have coordinates."
        answer_type = "source_backed"
    elif any(k in q for k in ("timeline", "event", "when")):
        answer = f"The active case has {len(verified_events)} verified timeline events. They are ordered by event time in the timeline view."
        answer_type = "source_backed"
    sources = [{"reference": f"CASE {case.get('case_number') or case_id}", "source_type": "case_database"}]
    return {
        "answer": answer,
        "answer_type": answer_type,
        "confidence": "Database-derived",
        "sources": sources,
        "actions": [
            {"type": "OPEN_NETWORK", "label": "View Network"},
            {"type": "OPEN_GIS", "label": "View GIS"},
            {"type": "OPEN_TIMELINE", "label": "View Timeline"},
            {"type": "OPEN_EVIDENCE", "label": "View Evidence"},
        ],
        "highlights": {
            "verified_entities": len(verified_entities),
            "verified_relationships": len(verified_rels),
            "verified_locations": len(verified_locs),
            "verified_events": len(verified_events),
            "pending_review": pending,
        },
        "provider": "deterministic",
    }


def build_ai_context(case_id:int, question:str):
    conn=get_db(); require_case(conn,case_id)
    case=dict(conn.execute("SELECT * FROM cases WHERE id=?",(case_id,)).fetchone())
    entities=[dict(r) for r in conn.execute("SELECT id,label,entity_type,aliases,confidence_score,verification_status,latitude,longitude FROM entities WHERE case_id=? ORDER BY id LIMIT 250",(case_id,)).fetchall()]
    relationships=[dict(r) for r in conn.execute("SELECT id,source_entity_id,target_entity_id,relationship_type,evidence_sentence,confidence_score,verification_status,source_document_id FROM relationships WHERE case_id=? ORDER BY id LIMIT 500",(case_id,)).fetchall()]
    evidence=[dict(r) for r in conn.execute("SELECT id,filename,file_type,processing_status,sha256,uploaded_at FROM documents WHERE case_id=? ORDER BY id DESC LIMIT 100",(case_id,)).fetchall()]
    locations=[dict(r) for r in conn.execute("SELECT id,label,latitude,longitude,location_type,address_text,verification_status,event_timestamp FROM locations WHERE case_id=? LIMIT 250",(case_id,)).fetchall()]
    timeline=[dict(r) for r in conn.execute("SELECT id,event_type,event_time,description,entity_id,location_id,evidence_id,verification_status,source_reference FROM timeline_events WHERE case_id=? ORDER BY event_time ASC LIMIT 250",(case_id,)).fetchall()]
    review=[dict(r) for r in conn.execute("SELECT id,type,title,description,confidence_score,status,source_document,source_reference FROM review_items WHERE case_id=? AND UPPER(status)='PENDING' ORDER BY id DESC LIMIT 100",(case_id,)).fetchall()]
    q=question.lower(); all_cases=[]
    if any(k in q for k in ["all cases","previous case","other case","cases created","case list"]):
        all_cases=[]
    conn.close()
    return {"case":case,"entities":entities,"relationships":relationships,"evidence":evidence,"locations":locations,"timeline":timeline,"pending_review":review,"all_cases":all_cases}

@app.post("/cases/{case_id}/ai/query")
@app.post("/api/cases/{case_id}/ai/query")
async def ai_query(case_id: int, request: Request, user: dict = Depends(get_current_user)):
    data = await request.json()
    question = (data.get("query") or data.get("question") or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question or query text is required")

    conn = get_db()
    conv = conn.execute("INSERT INTO ai_conversations (case_id, user_id, created_at, updated_at) VALUES (?, ?, datetime('now'), datetime('now'))", (case_id, user.get("id", 1)))
    conn.commit()
    conversation_id = conv.lastrowid
    conn.close()

    # Existing frontend contract is preserved, but the backend brain now uses the
    # unified evidence-fusion engine (RAG + verified graph/GIS/timeline + ML-ready package + local Ollama).
    try:
        generated, fusion_package = fusion_answer(case_id, question)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    answer_type = generated.get("answer_type") or ("source_backed" if generated.get("sources") else "computed")
    provider = generated.get("provider") or "deterministic-fusion"
    sources = generated.get("sources") or fusion_package.get("rag", [])
    actions = [
        {"type": "OPEN_NETWORK", "label": "View Network"},
        {"type": "OPEN_GIS", "label": "View GIS"},
        {"type": "OPEN_TIMELINE", "label": "View Timeline"},
        {"type": "OPEN_EVIDENCE", "label": "View Evidence"},
    ]
    highlights = {
        "rag_sources": len(fusion_package.get("rag", [])),
        "verified_entities": sum(str(x.get("verification_status", "")).lower() == "verified" for x in fusion_package.get("entities", [])),
        "verified_relationships": sum(str(x.get("verification_status", "")).lower() == "verified" for x in fusion_package.get("relationships", [])),
        "verified_locations": sum(str(x.get("verification_status", "")).lower() == "verified" for x in fusion_package.get("locations", [])),
        "verified_events": sum(str(x.get("verification_status", "")).lower() == "verified" for x in fusion_package.get("timeline", [])),
        "pending_review": len(fusion_package.get("pending_review", [])),
    }
    ai_response = {
        "answer": generated.get("answer") or generated.get("text") or "No answer available",
        "answer_type": answer_type,
        "confidence": generated.get("confidence") or "Evidence-fusion",
        "sources": sources,
        "actions": actions,
        "highlights": highlights,
        "provider": provider,
        "conversation_id": conversation_id,
        "evidence_package": fusion_package,
        "inferences": generated.get("inferences", []),
        "uncertainties": generated.get("uncertainties", []),
        "llm_status": generated.get("llm_status") or fusion_package.get("llm_status", {}),
    }

    conn = get_db()
    conn.execute("INSERT INTO ai_messages (conversation_id, role, message, answer_type, payload_json) VALUES (?, 'assistant', ?, ?, ?)",
                 (conversation_id, ai_response["answer"], ai_response["answer_type"], json.dumps(ai_response)))
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "case_id": case_id,
        "conversation_id": conversation_id,
        "answer": ai_response["answer"],
        "answer_text": ai_response["answer"],
        "answer_type": ai_response["answer_type"],
        "response_type": "SOURCE-BACKED" if ai_response["answer_type"] == "source_backed" else "COMPUTED" if ai_response["answer_type"] == "computed" else "AI_SUGGESTION",
        "confidence": ai_response["confidence"],
        "sources": ai_response["sources"],
        "actions": ai_response["actions"],
        "suggested_actions": ai_response["actions"],
        "highlights": ai_response["highlights"],
        "provider": provider,
        "llm_status": ai_response.get("llm_status", {}),
        "data": ai_response,
    }


@app.get("/api/ai/search")
async def global_ai_search(q: str = Query(..., min_length=1), user: dict = Depends(get_current_user)):
    conn=get_db(); term=f"%{q.strip()}%"
    cases=[dict(r) for r in conn.execute("SELECT id,case_number,title,status,priority FROM cases WHERE created_by=? AND (case_number LIKE ? OR title LIKE ? OR description LIKE ?) LIMIT 50",(user.get("id"),term,term,term)).fetchall()]
    owned_case_ids=[int(r["id"]) for r in conn.execute("SELECT id FROM cases WHERE created_by=?",(user.get("id"),)).fetchall()]
    entities=[]; evidence=[]
    if owned_case_ids:
        placeholders=",".join("?" for _ in owned_case_ids)
        entities=[dict(r) for r in conn.execute(f"SELECT id,case_id,label,entity_type,verification_status FROM entities WHERE case_id IN ({placeholders}) AND (label LIKE ? OR aliases LIKE ?) LIMIT 100",(*owned_case_ids,term,term)).fetchall()]
        evidence=[dict(r) for r in conn.execute(f"SELECT id,case_id,filename,processing_status FROM documents WHERE case_id IN ({placeholders}) AND filename LIKE ? LIMIT 100",(*owned_case_ids,term)).fetchall()]
    conn.close(); return {"status":"success","query":q,"cases":cases,"entities":entities,"evidence":evidence}

@app.get("/cases/{case_id}/ai/activity")
@app.get("/api/cases/{case_id}/ai/activity")
def ai_activity(case_id: int, user: dict = Depends(get_current_user)):
    return {"status": "success", "case_id": case_id, **get_user_summary(case_id)}


@app.get("/cases/{case_id}/ai/suggestions")
@app.get("/api/cases/{case_id}/ai/suggestions")
def ai_suggestions(case_id: int, user: dict = Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute("SELECT * FROM review_items WHERE case_id = ? AND UPPER(status) = 'PENDING' ORDER BY id DESC", (case_id,)).fetchall()
    conn.close()
    suggestions = []
    for row in rows:
        item = dict(row)
        try:
            payload = json.loads(item.get("ai_output")) if isinstance(item.get("ai_output"), str) else item.get("ai_output") or {}
        except (TypeError, json.JSONDecodeError):
            payload = {}
        item["suggested_payload"] = payload
        item["payload"] = payload
        item["reasoning"] = item.get("reason") or item.get("description") or "Algorithm detected a finding requiring officer review."
        suggestions.append(item)
    return {"status": "success", "case_id": case_id, "suggestions": suggestions, "data": suggestions}

@app.post("/cases/{case_id}/ai/review-action")
@app.post("/api/cases/{case_id}/ai/review-action")
@app.post("/cases/{case_id}/ai/suggestions/{suggestion_id}/review")
@app.post("/api/cases/{case_id}/ai/suggestions/{suggestion_id}/review")
async def ai_review_action(case_id: int, request: Request, suggestion_id: Optional[int] = None):
    body = await request.json()
    review_id = suggestion_id or body.get("suggestion_id")
    if not review_id:
        raise HTTPException(status_code=400, detail="suggestion_id is required")
    decision = (body.get("decision") or "ACCEPT").upper()
    conn = get_db()
    row = conn.execute("SELECT * FROM review_items WHERE id = ? AND case_id = ?", (int(review_id), case_id)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="AI suggestion not found")
    status = "ACCEPTED" if decision.startswith("ACCEPT") else "REJECTED"
    promote_review_item(row, status, body.get("notes") or body.get("reason") or "AI Investigator review")
    return {"status": "success", "suggestion_id": int(review_id), "decision": decision, "new_status": status, "message": "Suggestion accepted and verified in case records." if status == "ACCEPTED" else "Suggestion rejected and excluded from trusted graph."}

@app.post("/cases/{case_id}/review/create-from-ai")
@app.post("/api/cases/{case_id}/review/create-from-ai")
async def create_review_from_ai(case_id: int, request: Request):
    body = await request.json()
    conn = get_db()
    cur = conn.execute("""INSERT INTO review_items (case_id, suggestion_type, title, description, source_document, confidence_score, status)
                         VALUES (?, ?, ?, ?, ?, ?, 'PENDING')""", (case_id, body.get("suggestion_type", "AI_SUGGESTION"), body.get("title", "AI Investigator suggestion"), body.get("description", "Suggestion created by AI Investigator"), body.get("source_document"), body.get("confidence_score", 0.85)))
    conn.commit()
    row = conn.execute("SELECT * FROM review_items WHERE id = ?", (cur.lastrowid,)).fetchone()
    conn.close()
    return {"status": "success", "review": dict(row), "suggestion": dict(row)}


@app.post("/cases/{case_id}/ai/draft-report")
@app.post("/api/cases/{case_id}/ai/draft-report")
async def ai_draft_report(case_id: int, request: Request):
    body = await request.json()
    focus = (body.get("focusArea") or body.get("focus_area") or "general").strip()
    summary = get_case_summary(case_id)
    draft = (
        f"Investigation Summary for {summary['case_number']} ({summary['case_title']}):\n"
        f"- Status: OPEN\n- Focus Area: {focus}\n- Verified entities: {summary['verified_entities_total']}\n"
        f"- Verified relationships: {summary['verified_relationships_total']}\n"
        f"- Evidence items: {summary['evidence_items_total']}\n"
        f"- Pending review items: {summary['pending_review_total']}\n"
        "This report reflects case data already in the investigation database and should be reviewed by an assigned officer before final action."
    )
    return {"status": "success", "report": {"draft_text": draft}, "draft_text": draft}

@app.post("/cases/{case_id}/ai/approve-report")
@app.post("/api/cases/{case_id}/ai/approve-report")
async def approve_ai_report(case_id: int, request: Request):
    body = await request.json()
    report = body.get("report") or body.get("draft_text") or ""
    conn = get_db()
    conn.execute("INSERT INTO chain_of_custody_logs (case_id, action, sha256_hash, actor_name) VALUES (?, ?, ?, ?)", (case_id, "AI_REPORT_APPROVED", hashlib.sha256(report.encode("utf-8")).hexdigest(), body.get("approved_by", "Investigator")))
    conn.commit()
    conn.close()
    return {"status": "success", "status_text": "APPROVED_AND_LOGGED", "message": "Report successfully approved and permanently registered in the verified chain of custody.", "report": report}


# ============================================================
# CIPHER VISION / AUTHORIZED FACE INTELLIGENCE (polished frontend contract)
# ============================================================
FACE_GALLERY_DIR = os.path.join(UPLOADS_DIR, "face_profiles")
os.makedirs(FACE_GALLERY_DIR, exist_ok=True)

def _face_public(row: dict) -> dict:
    data = dict(row)
    data.pop("embedding_json", None)
    data["image_url"] = f"/api/cases/{data['case_id']}/face-gallery/{data['id']}/image"
    data["active"] = bool(data.get("active", 1))
    return data

def _entity_evidence_context(conn, case_id:int, entity_id:int) -> dict:
    """Collect every case-evidence object currently traceable to a canonical entity.

    This includes explicit provenance links (relationship/location/timeline/entity/
    observation/profile) and text evidence retrieved from the case RAG chunks by
    the canonical person's label. RAG hits remain evidence references; they do not
    create or verify graph facts automatically.
    """
    er=conn.execute("SELECT * FROM entities WHERE id=? AND case_id=?",(entity_id,case_id)).fetchone()
    label=str(er["label"] if er else "").strip()
    ev_ids=set()
    for row in conn.execute("SELECT source_document_id FROM entities WHERE id=? AND case_id=? AND source_document_id IS NOT NULL",(entity_id,case_id)).fetchall():
        ev_ids.add(int(row["source_document_id"]))
    for row in conn.execute("SELECT source_document_id FROM relationships WHERE case_id=? AND (source_entity_id=? OR target_entity_id=?) AND source_document_id IS NOT NULL",(case_id,entity_id,entity_id)).fetchall():
        ev_ids.add(int(row["source_document_id"]))
    for row in conn.execute("SELECT primary_evidence_id,source_document_id FROM locations WHERE case_id=? AND entity_id=?",(case_id,entity_id)).fetchall():
        if row["primary_evidence_id"] is not None: ev_ids.add(int(row["primary_evidence_id"]))
        if row["source_document_id"] is not None: ev_ids.add(int(row["source_document_id"]))
    for row in conn.execute("SELECT evidence_id FROM timeline_events WHERE case_id=? AND entity_id=? AND evidence_id IS NOT NULL",(case_id,entity_id)).fetchall():
        ev_ids.add(int(row["evidence_id"]))
    for row in conn.execute("SELECT evidence_id FROM evidence_observations WHERE case_id=? AND entity_id=? AND evidence_id IS NOT NULL",(case_id,entity_id)).fetchall():
        ev_ids.add(int(row["evidence_id"]))
    for row in conn.execute("SELECT source_evidence_id FROM face_profiles WHERE case_id=? AND entity_id=? AND source_evidence_id IS NOT NULL",(case_id,entity_id)).fetchall():
        ev_ids.add(int(row["source_evidence_id"]))

    rag_hits=[]
    if label:
        term=f"%{label.lower()}%"
        try:
            rag_hits=conn.execute("SELECT DISTINCT evidence_id,page_number,source_reference FROM rag_chunks WHERE case_id=? AND LOWER(text) LIKE ? ORDER BY evidence_id,page_number LIMIT 100",(case_id,term)).fetchall()
            ev_ids.update(int(x["evidence_id"]) for x in rag_hits if x["evidence_id"] is not None)
        except Exception:
            rag_hits=[]
    docs=[]
    if ev_ids:
        qmarks=",".join("?" for _ in ev_ids)
        docs=[dict(x) for x in conn.execute(f"SELECT id,filename,file_type,processing_status,uploaded_at,sha256,source_type FROM documents WHERE case_id=? AND id IN ({qmarks}) ORDER BY uploaded_at DESC",[case_id,*sorted(ev_ids)]).fetchall()]
    return {"documents":docs,"images":[d for d in docs if str(d.get("file_type") or "").lower().startswith("image/")],"rag_hits":[dict(x) for x in rag_hits],"evidence_ids":sorted(ev_ids)}


@app.get("/cases/{case_id}/vision/cdr")
@app.get("/api/cases/{case_id}/vision/cdr")
def vision_cdr(case_id:int, entity_id:Optional[int]=None, user:dict=Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id)
    records=extract_case_records(conn,case_id,"CDR")
    records,highlighted=add_highlight(records,conn,case_id,entity_id)
    docs=documents_for_kind(conn,case_id,"CDR")
    conn.close()
    return {"status":"success","case_id":case_id,"kind":"CDR","count":len(records),"highlighted_count":highlighted,"active_entity_id":entity_id,"records":records,"documents":docs,"read_only":True}

@app.get("/cases/{case_id}/vision/statements")
@app.get("/api/cases/{case_id}/vision/statements")
def vision_statements(case_id:int, entity_id:Optional[int]=None, user:dict=Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id)
    records=extract_case_records(conn,case_id,"FINANCIAL")
    records,highlighted=add_highlight(records,conn,case_id,entity_id)
    docs=documents_for_kind(conn,case_id,"FINANCIAL")
    conn.close()
    return {"status":"success","case_id":case_id,"kind":"FINANCIAL","count":len(records),"highlighted_count":highlighted,"active_entity_id":entity_id,"records":records,"documents":docs,"read_only":True}

@app.get("/cases/{case_id}/face-intelligence/status")
@app.get("/api/cases/{case_id}/face-intelligence/status")
def face_intelligence_status(case_id: int, user: dict = Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id); conn.close()
    return {"status":"success",**face_engine_status(),"case_id":case_id,"scope":"AUTHORIZED_CASE_GALLERY",
            "message":"Cipher Vision uses InsightFace/ArcFace embeddings. Model weights must be installed/licensed separately."}

@app.get("/cases/{case_id}/vision/evidence")
@app.get("/api/cases/{case_id}/vision/evidence")
def vision_evidence(case_id: int, kind: str = "all", user: dict = Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id)
    rows=[dict(r) for r in conn.execute("SELECT * FROM documents WHERE case_id=? ORDER BY uploaded_at DESC",(case_id,)).fetchall()]
    conn.close()
    def classify(d):
        n=str(d.get("filename") or "").lower(); t=str(d.get("file_type") or "").lower()
        if any(x in n for x in ("cdr","call","communication","telecom","msisdn","phone","voice","recording")) or t.startswith("audio/") or n.endswith((".mp3",".wav",".m4a",".ogg",".webm")): return "communications"
        if any(x in n for x in ("bank","statement","transaction","financial","account","ledger","rtgs","neft","upi","wallet")): return "financial"
        return "other"
    requested=str(kind or "all").lower()
    if requested in {"cdr","communications","comms"}: rows=[r for r in rows if classify(r)=="communications"]
    elif requested in {"bank","finance","financial","statements"}: rows=[r for r in rows if classify(r)=="financial"]
    return {"status":"success","case_id":case_id,"kind":requested,"count":len(rows),"documents":rows,"read_only":True,
            "message":"Vision reads evidence already stored for this case. Upload/ingestion remains in Evidence."}

@app.post("/cases/{case_id}/face-gallery/bulk")
@app.post("/api/cases/{case_id}/face-gallery/bulk")
async def enroll_face_profiles_bulk(case_id:int, images:List[UploadFile]=File(...), labels:str=Form(""), user:dict=Depends(get_current_user)):
    """Upload several reference photos at once into the case Face Dataset.

    Each image becomes both case evidence and an ArcFace gallery profile.
    Optional labels is a JSON object keyed by filename; when omitted, the
    filename convention (P101__01.jpg / Arjun_Mehta_02.jpg) is used.
    """
    if not images: raise HTTPException(status_code=400,detail="Select at least one reference image")
    conn=get_db(); require_case(conn,case_id); conn.close()
    try: label_map=json.loads(labels or "{}")
    except Exception: raise HTTPException(status_code=400,detail="labels must be valid JSON")
    if not isinstance(label_map,dict): raise HTTPException(status_code=400,detail="labels must be a JSON object")
    payload=[]
    for image in images:
        name=os.path.basename(image.filename or "reference.jpg"); ext=os.path.splitext(name)[1].lower()
        if ext not in {".jpg",".jpeg",".png",".webp"}: raise HTTPException(status_code=400,detail=f"Unsupported reference image: {name}")
        raw=await image.read()
        if not raw or len(raw)>MAX_UPLOAD_BYTES: raise HTTPException(status_code=413,detail=f"Reference image {name} exceeds the {MAX_UPLOAD_BYTES} byte limit")
        payload.append((name,raw,label_map.get(name)))
    try: result=ingest_face_reference_images(case_id,payload,user)
    except RuntimeError as exc: raise HTTPException(status_code=503,detail=str(exc)) from exc
    except Exception as exc: raise HTTPException(status_code=500,detail=f"Face dataset ingestion failed: {str(exc)[:900]}") from exc
    return result

@app.post("/cases/{case_id}/face-gallery/retry/{evidence_id}")
@app.post("/api/cases/{case_id}/face-gallery/retry/{evidence_id}")
async def retry_face_gallery_enrollment(case_id:int, evidence_id:int, user:dict=Depends(get_current_user)):
    """Retry enrollment for an already-stored face reference evidence item.

    This repairs historical uploads that were stored successfully but could not
    create a face profile because an older schema/model/runtime was unavailable.
    It never creates a second profile for an evidence item that is already enrolled.
    """
    conn=get_db(); require_case(conn,case_id)
    doc=conn.execute("SELECT * FROM documents WHERE id=? AND case_id=?",(evidence_id,case_id)).fetchone()
    if not doc:
        conn.close(); raise HTTPException(status_code=404,detail="Face reference evidence not found")
    source=str(doc["source_type"] or "").upper()
    if source not in {"FACE_REFERENCE_IMAGE","FACE_REFERENCE_DATASET"}:
        conn.close(); raise HTTPException(status_code=400,detail="Evidence item is not a Face Reference upload")
    existing=conn.execute("SELECT * FROM face_profiles WHERE case_id=? AND source_evidence_id=? AND active=1 ORDER BY id LIMIT 1",(case_id,evidence_id)).fetchone()
    if existing:
        conn.close(); return {"status":"success","already_enrolled":True,"profile":_face_public(dict(existing))}
    conn.close()
    try:
        raw=download_uri(str(doc["file_path"]))
        vector,bbox=detect_face(raw)
    except ValueError as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500,detail=f"Face enrollment retry failed: {str(exc)[:900]}") from exc
    gallery_dir=Path(FACE_GALLERY_DIR); gallery_dir.mkdir(parents=True,exist_ok=True)
    ext=os.path.splitext(os.path.basename(str(doc["filename"] or "face.jpg")))[1].lower()
    if ext not in {".jpg",".jpeg",".png",".webp"}: ext=".jpg"
    path=gallery_dir/f"case_{case_id}_retry_{secrets.token_hex(12)}{ext}"; path.write_bytes(raw)
    conn=get_db()
    key=derive_reference_key(str(doc["filename"] or "reference"))
    entity=_find_entity(conn,case_id,key) if key else None
    if not entity:
        entity,_=_ensure_entity(conn,case_id,key or "Unassigned Face Reference",evidence_id)
    cur=conn.execute("INSERT INTO face_profiles (case_id,entity_id,display_name,username,source_label,source_evidence_id,image_path,embedding_json,embedding_engine,model_version,active) VALUES (?,?,?,?,?,?,?,?,?,?,1)",(case_id,int(entity["id"]),entity["label"],"","FACE_REFERENCE_DATASET",evidence_id,str(path),encode(vector),FACE_ENGINE,FACE_MODEL_VERSION))
    profile_id=cur.lastrowid
    verification=str(entity["verification_status"] or "").lower()
    if verification not in {"verified","accepted"}:
        exists=conn.execute("SELECT id FROM review_items WHERE case_id=? AND entity_id=? AND suggestion_type='FACE_REFERENCE_ENTITY' AND status='PENDING'",(case_id,int(entity["id"]))).fetchone()
        if not exists:
            conn.execute("INSERT INTO review_items (case_id,type,suggestion_type,title,description,entity_id,evidence_id,source_document,source_reference,confidence_score,confidence,status,priority,source_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",(case_id,"entity","FACE_REFERENCE_ENTITY","Face dataset person requires verification",f"Reference image {doc['filename']} was enrolled for {entity['label']}. Verify the person/entity association before trusting it.",int(entity["id"]),evidence_id,"Face Reference Dataset","face-dataset",0.95,0.95,"PENDING","HIGH","FACE_REFERENCE_DATASET"))
    conn.commit(); row=conn.execute("SELECT * FROM face_profiles WHERE id=?",(profile_id,)).fetchone(); conn.close()
    return {"status":"success","already_enrolled":False,"profile":_face_public(dict(row))}

@app.get("/cases/{case_id}/face-gallery")
@app.get("/api/cases/{case_id}/face-gallery")
def list_face_gallery(case_id: int, user: dict = Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id)
    rows=conn.execute("SELECT * FROM face_profiles WHERE case_id=? AND active=1 ORDER BY display_name COLLATE NOCASE",(case_id,)).fetchall()
    conn.close()
    return {"status":"success","case_id":case_id,"count":len(rows),"engine":FACE_ENGINE,"model_version":FACE_MODEL_VERSION,
            "profiles":[_face_public(dict(r)) for r in rows]}

@app.post("/cases/{case_id}/face-gallery")
@app.post("/api/cases/{case_id}/face-gallery")
async def enroll_face_profile(case_id:int,image:UploadFile=File(...),display_name:str=Form(...),username:str=Form(""),
    source_label:str=Form("AUTHORIZED CASE GALLERY"),latitude:Optional[float]=Form(None),longitude:Optional[float]=Form(None),
    address_text:str=Form(""),entity_id:Optional[int]=Form(None),user:dict=Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id); raw=await image.read()
    if not raw or len(raw)>MAX_UPLOAD_BYTES: conn.close(); raise HTTPException(status_code=413,detail=f"Image must be between 1 byte and {MAX_UPLOAD_BYTES} bytes")
    if not (image.content_type or "").lower().startswith("image/"): conn.close(); raise HTTPException(status_code=400,detail="Only image files can be enrolled")
    try: vector,_=detect_face(raw)
    except ValueError as exc: conn.close(); raise HTTPException(status_code=422,detail=str(exc)) from exc
    if latitude is not None and not -90<=float(latitude)<=90: conn.close(); raise HTTPException(status_code=400,detail="latitude must be between -90 and 90")
    if longitude is not None and not -180<=float(longitude)<=180: conn.close(); raise HTTPException(status_code=400,detail="longitude must be between -180 and 180")
    if entity_id is not None and not conn.execute("SELECT id FROM entities WHERE id=? AND case_id=?",(entity_id,case_id)).fetchone(): conn.close(); raise HTTPException(status_code=400,detail="entity_id does not belong to this case")
    ext=os.path.splitext(os.path.basename(image.filename or "face.jpg"))[1].lower()
    if ext not in {".jpg",".jpeg",".png",".webp"}: ext=".jpg"
    path=os.path.join(FACE_GALLERY_DIR,f"case_{case_id}_{secrets.token_hex(12)}{ext}")
    with open(path,"wb") as fh: fh.write(raw)
    cur=conn.execute("""INSERT INTO face_profiles
      (case_id,entity_id,display_name,username,source_label,latitude,longitude,address_text,source_evidence_id,image_path,embedding_json,embedding_engine,model_version,active)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1)""",
      (case_id,entity_id,display_name.strip(),username.strip(),source_label.strip() or "AUTHORIZED CASE GALLERY",latitude,longitude,address_text.strip(),None,path,encode(vector),FACE_ENGINE,FACE_MODEL_VERSION))
    conn.commit(); row=conn.execute("SELECT * FROM face_profiles WHERE id=?",(cur.lastrowid,)).fetchone(); conn.close()
    return {"status":"success","message":"Face profile enrolled in the authorized case gallery","profile":_face_public(dict(row))}

@app.get("/cases/{case_id}/face-gallery/{profile_id}/image")
@app.get("/api/cases/{case_id}/face-gallery/{profile_id}/image")
def get_face_profile_image(case_id:int,profile_id:int,user:dict=Depends(get_current_user)):
    conn=get_db(); row=conn.execute("SELECT * FROM face_profiles WHERE id=? AND case_id=? AND active=1",(profile_id,case_id)).fetchone(); conn.close()
    if not row: raise HTTPException(status_code=404,detail="Face profile not found")
    path=os.path.abspath(row["image_path"]); root=os.path.abspath(FACE_GALLERY_DIR)
    if not path.startswith(root+os.sep) or not os.path.isfile(path): raise HTTPException(status_code=404,detail="Profile image unavailable")
    media={".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp"}.get(os.path.splitext(path)[1].lower(),"application/octet-stream")
    return FileResponse(path,media_type=media)

@app.post("/cases/{case_id}/face-intelligence/match")
@app.post("/api/cases/{case_id}/face-intelligence/match")
async def match_face_against_case_gallery(case_id:int,image:UploadFile=File(...),limit:int=Form(5),user:dict=Depends(get_current_user)):
    conn=get_db(); require_case(conn,case_id); conn.close()
    raw=await image.read()
    if not raw or len(raw)>MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413,detail=f"Image must be between 1 byte and {MAX_UPLOAD_BYTES} bytes")
    if not (image.content_type or "").lower().startswith("image/"):
        raise HTTPException(status_code=400,detail="Only image files can be analyzed by Cipher Vision")

    # Persist every Vision query as case evidence so the candidate, review decision
    # and later graph/GIS navigation remain traceable to the original image.
    original_name=os.path.basename(image.filename or "vision_query.jpg")
    ext=os.path.splitext(original_name)[1].lower()
    if ext not in {".jpg",".jpeg",".png",".webp"}: ext=".jpg"
    sha256=hashlib.sha256(raw).hexdigest(); ts=datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    if storage_configured():
        object_path=f"cases/{case_id}/evidence/{ts}_vision_{original_name}"
        save_path=upload_bytes(object_path,raw,image.content_type or "image/jpeg")
    else:
        save_path=os.path.join(UPLOADS_DIR,f"{ts}_vision_{original_name}")
        with open(save_path,"wb") as fh: fh.write(raw)
    conn=get_db()
    try:
        cur=conn.execute("INSERT INTO documents (case_id,filename,file_type,file_path,processing_status,uploaded_by,sha256,source_type,description) VALUES (?,?,?,?,?,?,?,?,?)",
                         (case_id,original_name,image.content_type or "image/jpeg",save_path,"PROCESSED",user.get("id",1),sha256,"VISION_QUERY","Cipher Vision unknown-photo query"))
        evidence_id=cur.lastrowid
        conn.execute("INSERT INTO chain_of_custody_logs (case_id,document_id,action,sha256_hash,actor_name) VALUES (?,?,?,?,?)",(case_id,evidence_id,"VISION_IMAGE_ANALYZED",sha256,user.get("full_name","Investigator")))
        conn.commit()
    except Exception:
        conn.rollback(); conn.close(); raise
    conn.close()
    try:
        result=search_case_gallery(case_id,raw,evidence_id,max(1,min(int(limit or 5),10)))
    except ValueError as exc:
        raise HTTPException(status_code=422,detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503,detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500,detail=f"Vision analysis failed: {str(exc)[:900]}") from exc
    # Attach the canonical evidence ID to every result and include current case
    # context without asserting identity.
    conn=get_db(); enriched=[]
    for item in result.get("matches",[]):
        p=conn.execute("SELECT * FROM face_profiles WHERE id=? AND case_id=?",(item["profile_id"],case_id)).fetchone()
        payload=_face_public(dict(p)) if p else {}
        if item.get("entity_id"):
            locs=conn.execute("SELECT id,label,latitude,longitude,address_text,location_type,event_timestamp,verification_status,primary_evidence_id,source_document_id FROM locations WHERE case_id=? AND entity_id=? AND LOWER(COALESCE(verification_status,''))='verified' ORDER BY id DESC",(case_id,item["entity_id"])).fetchall()
            rels=conn.execute("SELECT r.id,r.relationship_type,r.source_entity_id,r.target_entity_id,s.label source_label,t.label target_label,r.verification_status FROM relationships r JOIN entities s ON s.id=r.source_entity_id JOIN entities t ON t.id=r.target_entity_id WHERE r.case_id=? AND (r.source_entity_id=? OR r.target_entity_id=?) AND LOWER(COALESCE(r.verification_status,''))='verified' ORDER BY r.id",(case_id,item["entity_id"],item["entity_id"])).fetchall()
            payload["verified_locations"]=[dict(x) for x in locs]; payload["verified_relationships"]=[dict(x) for x in rels]
            payload["latest_verified_location"]=(dict(locs[0]) if locs else None)
            evidence_context=_entity_evidence_context(conn,case_id,int(item["entity_id"]))
            payload["related_evidence"]=evidence_context["documents"]
            payload["related_images"]=evidence_context["images"]
            payload["rag_evidence_hits"]=evidence_context["rag_hits"]

        item["profile"]=payload; item["evidence_id"]=evidence_id; enriched.append(item)
    conn.close()
    return {"status":"success","case_id":case_id,"evidence_id":evidence_id,"engine":FACE_ENGINE,"model_version":FACE_MODEL_VERSION,"face_detected":True,"face_box":result.get("face_box"),"gallery_size":result.get("gallery_size",0),"matches":enriched,"notice":"Matches are candidates from the authorized case gallery. Identity becomes verified only after investigator acceptance."}

@app.post("/cases/{case_id}/face-intelligence/matches/{match_id}/review")
@app.post("/api/cases/{case_id}/face-intelligence/matches/{match_id}/review")
async def review_face_match(case_id:int,match_id:str,request:Request,user:dict=Depends(get_current_user)):
    body=await request.json(); decision=str(body.get("decision") or "").upper()
    if decision not in {"ACCEPT","REJECT"}: raise HTTPException(status_code=400,detail="decision must be ACCEPT or REJECT")
    conn=get_db(); row=conn.execute("SELECT * FROM face_matches WHERE id=? AND case_id=?",(match_id,case_id)).fetchone()
    if not row: conn.close(); raise HTTPException(status_code=404,detail="Face match not found")
    review=conn.execute("SELECT * FROM review_items WHERE case_id=? AND suggestion_type='FACE_MATCH' AND ai_output LIKE ? ORDER BY id DESC LIMIT 1",(case_id,f'%{match_id}%')).fetchone()
    conn.close()
    if not review: raise HTTPException(status_code=404,detail="Face match review item not found")
    result=update_review_status(int(review["id"]),"ACCEPTED" if decision=="ACCEPT" else "REJECTED",body.get("note") or body.get("reason"),user)
    conn=get_db(); eid=row["candidate_entity_id"]
    context={"entity":None,"relationships":[],"locations":[],"timeline_events":[],"evidence_documents":[]}
    if decision=="ACCEPT" and eid:
        er=conn.execute("SELECT * FROM entities WHERE id=? AND case_id=?",(eid,case_id)).fetchone(); context["entity"]=dict(er) if er else None
        context["relationships"]=[dict(x) for x in conn.execute("SELECT r.*,s.label source_label,t.label target_label FROM relationships r JOIN entities s ON s.id=r.source_entity_id JOIN entities t ON t.id=r.target_entity_id WHERE r.case_id=? AND (r.source_entity_id=? OR r.target_entity_id=?) AND LOWER(COALESCE(r.verification_status,''))='verified' ORDER BY r.id",(case_id,eid,eid)).fetchall()]
        context["locations"]=[dict(x) for x in conn.execute("SELECT * FROM locations WHERE case_id=? AND entity_id=? AND LOWER(COALESCE(verification_status,''))='verified' ORDER BY event_timestamp,id",(case_id,eid)).fetchall()]
        context["timeline_events"]=[dict(x) for x in conn.execute("SELECT * FROM timeline_events WHERE case_id=? AND entity_id=? AND LOWER(COALESCE(verification_status,''))='verified' ORDER BY event_time,id",(case_id,eid)).fetchall()]
        evctx=_entity_evidence_context(conn,case_id,int(eid))
        context["evidence_documents"]=evctx["documents"]
        context["related_images"]=evctx["images"]
        context["rag_evidence_hits"]=evctx["rag_hits"]
    conn.execute("INSERT INTO evidence_observations (id,case_id,evidence_id,entity_id,observation_type,confidence,verification_status,source_reference,details_json) VALUES (?,?,?,?,?,?,?,?,?)",(secrets.token_hex(12),case_id,row["evidence_id"],eid if decision=="ACCEPT" else None,"FACE_MATCH_ACCEPTED" if decision=="ACCEPT" else "FACE_MATCH_REJECTED",float(row["similarity"]),"VERIFIED" if decision=="ACCEPT" else "REJECTED","vision-face-search",json.dumps({"match_id":match_id,"review_id":review["id"],"reviewer":user.get("full_name","Investigator")},default=str)))
    conn.execute("UPDATE face_matches SET status=?,reviewed_at=datetime('now'),reviewed_by=? WHERE id=? AND case_id=?",("VERIFIED" if decision=="ACCEPT" else "REJECTED",user.get("full_name","Investigator"),match_id,case_id))
    conn.commit(); conn.close()
    return {"status":"success","case_id":case_id,"match_id":match_id,"decision":decision,"review_id":review["id"],"identity_verified":decision=="ACCEPT","canonical_entity_id":eid if decision=="ACCEPT" else None,"propagation":context}

@app.get("/cases/{case_id}/graph/nodes/{entity_id}/intel")
@app.get("/api/cases/{case_id}/graph/nodes/{entity_id}/intel")
def graph_node_intelligence(case_id: int, entity_id: str, include: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Return the complete backend-backed intelligence record for a selected node.

    This endpoint deliberately does not invent domain facts. It assembles the
    records already attached to the entity in the active case: relationships,
    locations, timeline events, evidence documents, observations and review
    records. The Network inspector uses this as its NODE/LINKS/SOURCE data.
    """
    eid = clean_id(entity_id)
    include_pending = str(include or "").lower() in {"pending", "all", "pending,verified", "verified,pending"}
    allowed = "LOWER(COALESCE(verification_status,'')) != 'rejected'" if include_pending else "LOWER(COALESCE(verification_status,'')) = 'verified'"

    conn = get_db()
    row = conn.execute("SELECT * FROM entities WHERE id=? AND case_id=? AND " + allowed, (eid, case_id)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Graph node not found")
    entity = dict(row)

    rel_rows = conn.execute(f"""
        SELECT r.*, s.label AS source_label, s.entity_type AS source_type_label,
               t.label AS target_label, t.entity_type AS target_type_label
        FROM relationships r
        JOIN entities s ON s.id=r.source_entity_id AND s.case_id=r.case_id
        JOIN entities t ON t.id=r.target_entity_id AND t.case_id=r.case_id
        WHERE r.case_id=? AND (r.source_entity_id=? OR r.target_entity_id=?)
          AND LOWER(COALESCE(r.verification_status,'')) != 'rejected'
        ORDER BY COALESCE(r.created_at,''), r.id
    """, (case_id, eid, eid)).fetchall()
    relationships = [dict(r) for r in rel_rows]

    loc_rows = conn.execute(f"""
        SELECT * FROM locations
        WHERE case_id=? AND entity_id=? AND {allowed}
        ORDER BY COALESCE(event_timestamp,''), id
    """, (case_id, eid)).fetchall()
    locations = [dict(r) for r in loc_rows]

    event_rows = conn.execute(f"""
        SELECT t.*, l.label AS location_label, l.address_text AS location_address,
               d.filename AS evidence_filename, d.file_type AS evidence_file_type,
               d.processing_status AS evidence_processing_status
        FROM timeline_events t
        LEFT JOIN locations l ON l.id=t.location_id AND l.case_id=t.case_id
        LEFT JOIN documents d ON d.id=t.evidence_id AND d.case_id=t.case_id
        WHERE t.case_id=? AND t.entity_id=? AND {allowed.replace("verification_status", "t.verification_status")}
        ORDER BY COALESCE(t.event_time,''), t.id
    """, (case_id, eid)).fetchall()
    timeline = [dict(r) for r in event_rows]

    # Evidence can be linked directly from the entity, from timeline events,
    # locations, relationships, or review records. Collect only documents that
    # are actually attached to this node's case records.
    evidence_ids = set()
    raw_evidence_text = str(entity.get("evidence_id_text") or "")
    for token in raw_evidence_text.replace(";", ",").split(","):
        token = token.strip()
        if token.isdigit(): evidence_ids.add(int(token))
    evidence_ids.update(int(r["source_document_id"]) for r in rel_rows if r["source_document_id"] is not None)
    evidence_ids.update(int(r["source_document_id"]) for r in loc_rows if r["source_document_id"] is not None)
    evidence_ids.update(int(r["evidence_id"]) for r in event_rows if r["evidence_id"] is not None)

    review_rows = conn.execute("""
        SELECT id,type,suggestion_type,title,description,relationship_id,location_id,event_id,evidence_id,
               source_document,source_reference,extracted_context,confidence_score,confidence,status,reason,created_at
        FROM review_items WHERE case_id=? AND entity_id=? ORDER BY id
    """, (case_id, eid)).fetchall()
    reviews = [dict(r) for r in review_rows]
    evidence_ids.update(int(r["evidence_id"]) for r in review_rows if r["evidence_id"] is not None)

    docs = []
    if evidence_ids:
        placeholders = ",".join("?" * len(evidence_ids))
        doc_rows = conn.execute(
            f"SELECT id,case_id,filename,file_type,file_path,processing_status,uploaded_at,processed_at,external_id,sha256,source_type,description FROM documents WHERE case_id=? AND id IN ({placeholders}) ORDER BY id",
            (case_id, *sorted(evidence_ids))
        ).fetchall()
        docs = [dict(r) for r in doc_rows]
    if entity.get("source_document_id") is not None and int(entity["source_document_id"]) not in evidence_ids:
        d = conn.execute("SELECT id,case_id,filename,file_type,file_path,processing_status,uploaded_at,processed_at,external_id,sha256,source_type,description FROM documents WHERE id=? AND case_id=?", (int(entity["source_document_id"]), case_id)).fetchone()
        if d: docs.append(dict(d))

    # Spatial observations are a separate legacy table. They have no entity_id,
    # so match only the exact case + entity label; never manufacture a match.
    observation_rows = conn.execute(
        "SELECT * FROM spatial_events WHERE case_id=? AND LOWER(entity_name)=LOWER(?) ORDER BY timestamp, id",
        (case_id, entity.get("label") or "")
    ).fetchall()
    observations = [dict(r) for r in observation_rows]

    conn.close()

    source = {
        "entity": entity,
        "locations": locations,
        "timeline_events": timeline,
        "observations": observations,
        "evidence_documents": docs,
        "review_records": reviews,
    }
    return {
        "status": "success",
        "case_id": case_id,
        "entity_id": f"ent-{eid}",
        "raw_id": eid,
        "graph_store": "relational_case_data",
        "scope": "VERIFIED + PENDING" if include_pending else "VERIFIED",
        "node": entity,
        "relationships": relationships,
        "source": source,
    }

@app.post("/review/bulk-reject")
@app.post("/api/review/bulk-reject")
async def bulk_reject_reviews(request: Request, user: dict = Depends(get_current_user)):
    body = await request.json()
    review_ids = body.get("review_ids") or []
    if not isinstance(review_ids, list) or not review_ids:
        raise HTTPException(status_code=400, detail="Array of review_ids is required for bulk reject.")
    reason = body.get("reason") or body.get("note") or "Investigator rejected selected finding"
    rejected = 0
    for review_id in review_ids:
        try:
            update_review_status(clean_id(review_id), "REJECTED", reason, user)
            rejected += 1
        except HTTPException:
            continue
    return {"status": "success", "rejected_count": rejected}

# ============================================================
# STATIC FRONTEND / LOCAL FILES
# ============================================================
# Always register these routes. A bad/missing frontend path should produce a clear
# server-side 503 rather than an unexplained FastAPI 404 at `/`.
@app.get("/", include_in_schema=False)
def serve_frontend_root():
    index = os.path.join(FRONTEND_DIR, "index.html")
    if not os.path.isfile(index):
        raise HTTPException(status_code=503, detail={
            "message": "CIPHER frontend is not available.",
            "frontend_dir": FRONTEND_DIR,
            "expected_file": index,
            "hint": "Set CIPHER_FRONTEND_DIR to the project frontend folder and restart the backend."
        })
    return FileResponse(index)


@app.get("/static/{filename:path}", include_in_schema=False)
def serve_static_files(filename: str):
    root = os.path.abspath(FRONTEND_DIR)
    safe = os.path.abspath(os.path.join(root, filename))
    if not safe.startswith(root + os.sep) or not os.path.isfile(safe):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(safe)


@app.get("/{filename:path}", include_in_schema=False)
def serve_frontend_files(filename: str):
    if filename.startswith(("api/", "auth/", "cases/", "review/", "review-queue/", "uploads/", "health", "db-test")):
        raise HTTPException(status_code=404, detail="Not found")
    root = os.path.abspath(FRONTEND_DIR)
    safe = os.path.abspath(os.path.join(root, filename))
    if safe.startswith(root + os.sep) and os.path.isfile(safe):
        return FileResponse(safe)
    index = os.path.join(root, "index.html")
    if os.path.isfile(index):
        return FileResponse(index)
    raise HTTPException(status_code=503, detail={"message":"CIPHER frontend is not available.","frontend_dir":root})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
