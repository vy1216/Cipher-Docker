# CIPHER — Render Free deployment

This package is prepared for a **single Render Free Web Service**. The FastAPI application serves the existing `frontend/` folder, so a separate Vercel frontend and Render background worker are not required.

## Architecture

- Render Free Web Service: FastAPI + existing CIPHER frontend
- Supabase PostgreSQL: persistent application data
- Supabase Storage: persistent evidence files
- Neo4j Aura: network graph
- Gemini API: cloud AI

Render Free web services have 512 MB RAM, an ephemeral filesystem, and spin down after 15 minutes without inbound traffic. Do not use local SQLite, `uploads/`, or `data/rag/` as persistent production storage.

## GitHub

Commit the source package to GitHub. Do **not** commit `.env`, databases, uploads, model files, caches, or generated runtime RAG indexes. `.gitignore` already excludes these.

## Render

The included `render.yaml` declares exactly one service:

```text
Type: Web Service
Plan: Free
Build: pip install -r python_backend/requirements.txt
Start: uvicorn app:app --host 0.0.0.0 --port $PORT
Health: /api/health
```

Set the secret environment variables in Render:

```text
DATABASE_URL
SECRET_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
NEO4J_URI
NEO4J_USERNAME
NEO4J_PASSWORD
GEMINI_API_KEY
```

The public frontend and API are same-origin, so `CIPHER_CORS_ORIGINS=*` is safe for this browser architecture. If you later move the frontend to a separate origin, replace it with that exact HTTPS origin.

## Supabase

1. Apply `supabase/migrations/001_init_schema.sql` to the production PostgreSQL database.
2. Create a private Storage bucket named `cipher-evidence`.
3. Put the Supabase service-role key only in Render environment variables.

## Neo4j

Use Aura credentials:

```text
NEO4J_URI=neo4j+s://YOUR_INSTANCE.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=...
NEO4J_DATABASE=neo4j
```

## AI

Render uses Gemini. Ollama is disabled in the Render blueprint because `127.0.0.1:11434` refers to the Render container, not your PC. The optional OpenRouter fallback is also disabled by default.

The blueprint uses `gemini-3.8-flash` with `gemini-3.7-flash` as a model fallback.

## Evidence processing

CIPHER uses FastAPI background tasks inside the single web service. There is **no Render background worker** in this Free deployment. Temporary processing files use `/tmp`; durable evidence is stored in Supabase Storage.

## Verify after deployment

Open:

```text
https://YOUR-SERVICE.onrender.com/
https://YOUR-SERVICE.onrender.com/api/health
https://YOUR-SERVICE.onrender.com/api/config
```

Then test:

1. Register/login.
2. Create a case.
3. Upload CSV/PDF/TXT evidence.
4. Process the evidence.
5. Open Review.
6. Verify Network/Graph data.
7. Verify GIS data.
8. Verify Timeline.
9. Run AI with Gemini.
10. Generate a report.

## Important Free-tier behavior

A Free Render service may take about a minute to wake after idle. Local files are lost when the service restarts or spins down, so production data must remain in PostgreSQL/Storage/Neo4j.

The Free plan is intended for testing, hobby projects, and previews rather than production workloads.
