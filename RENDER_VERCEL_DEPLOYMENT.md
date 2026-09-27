# CIPHER — Render Backend + Vercel Frontend Deployment

This package is prepared for a split deployment:

- **Vercel:** static `frontend/` folder
- **Render Web Service:** FastAPI `app.py`
- **Render Background Worker:** `python_backend.worker`
- **Supabase PostgreSQL:** persistent relational database
- **Supabase Storage:** durable private evidence storage
- **Neo4j Aura:** verified graph
- **Gemini:** evidence extraction / AI Investigator

## 1. Supabase

Create a PostgreSQL database and apply `supabase/migrations/001_init_schema.sql`.
Create a **private** Storage bucket named `cipher-evidence`.
Create/use the service-role key only on Render. Never expose it to Vercel/browser code.

Required Render variables:

```text
DATABASE_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET=cipher-evidence
```

Uploaded evidence is stored as durable Supabase Storage objects. The database stores a `supabase://bucket/object/path` reference.

## 2. Neo4j Aura

Use the existing Aura settings:

```text
NEO4J_URI=neo4j+s://YOUR_INSTANCE.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=...
NEO4J_DATABASE=neo4j
NEO4J_REQUIRED_FOR_GRAPH=true
```

## 3. Render

Use the included `render.yaml` with Render Blueprint, or create two services manually.

### Web service

Build:

```bash
pip install -r python_backend/requirements.txt
```

Start:

```bash
uvicorn app:app --host 0.0.0.0 --port $PORT
```

### Background worker

Build:

```bash
pip install -r python_backend/requirements.txt
```

Start:

```bash
python -m python_backend.worker
```

Set `CIPHER_USE_BACKGROUND_TASKS=false` so queued evidence is processed by the Render worker rather than depending on an HTTP request lifecycle.

## 4. CORS

After you create the Vercel frontend domain, set Render:

```text
CIPHER_CORS_ORIGINS=https://YOUR-FRONTEND.vercel.app
```

For a custom domain, include it too, comma separated:

```text
CIPHER_CORS_ORIGINS=https://cipher.example.com,https://YOUR-FRONTEND.vercel.app
```

## 5. Vercel frontend

Deploy **the `frontend/` directory** as its own Vercel project.

Before deploying, edit:

```text
frontend/config.js
```

Set:

```javascript
window.CIPHER_API_BASE = "https://YOUR-BACKEND.onrender.com";
```

Do not add a trailing slash.

The runtime layer automatically rewrites API requests from the Vercel origin to the Render backend while leaving static assets on Vercel.

## 6. Verify backend

Open:

```text
https://YOUR-BACKEND.onrender.com/api/health
https://YOUR-BACKEND.onrender.com/docs
```

Check that:

- `database` is `postgresql`
- `database_url_configured` is true
- `storage_configured` is true
- Neo4j health is OK

## 7. Verify end-to-end

Test:

1. Register/login.
2. Create a case.
3. Upload TXT/CSV/PDF evidence.
4. Confirm upload returns quickly and status becomes `QUEUED`.
5. Open Review immediately.
6. Confirm worker changes status to `PROCESSING` then `PROCESSED`.
7. Review and accept findings.
8. Confirm verified findings appear in Network/GIS/Timeline.
9. Open the evidence file again.
10. Logout/login and reopen the case.
11. Confirm the evidence and verified data are still present.
12. Generate the case PDF report.

## Important

The Supabase service-role key belongs only on Render. Never put it in `frontend/config.js`, Vercel environment variables exposed to browser code, or committed source.
