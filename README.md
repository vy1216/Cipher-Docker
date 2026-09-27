# CIPHER — Criminal Intelligence & Pattern Heuristic Engine

This repository is packaged for a single **Render Free Web Service**. FastAPI serves the existing frontend directly.

## Deployment

See [`RENDER_DEPLOYMENT.md`](RENDER_DEPLOYMENT.md) for the complete Render/Supabase/Neo4j/Gemini setup.

The production architecture is: Render FastAPI + frontend → Supabase PostgreSQL/Storage → Neo4j Aura → Gemini.

The Free Render filesystem is ephemeral, so `cipher.db`, `uploads/`, and generated RAG indexes are intentionally excluded from the repository.

---

# CIPHER — Python-only Investigation Backend

This build keeps the existing CIPHER UI and uses a single FastAPI/Python backend.

## Data flow

`CASE -> EVIDENCE (TXT/CSV/PDF) -> PROCESSING/EXTRACTION -> REVIEW -> VERIFIED NETWORK -> GIS -> TIMELINE -> REPORT/AUDIT`

AI extraction does not directly become trusted graph data. Extracted entities, relationships, locations and events enter the review workflow first. Accepted/edited findings become verified and are then available to Network, GIS, Timeline and Reports.

## Included

- Existing CIPHER HTML/CSS/JS interface
- FastAPI backend
- Strict bearer-token authentication
- Cases and previous-case loading
- TXT/CSV/PDF evidence upload
- SHA-256 evidence hashing and custody logging
- CSV evidence processing
- Unified master CSV import
- Entity/node creation
- Entity linking/relationship creation
- Human review: accept, edit, reject, merge, bulk accept
- Verified network graph and deterministic graph analytics
- GIS derived from verified network/entity coordinates plus saved locations/waypoints
- Timeline derived from stored events
- AI Investigator endpoints
- Audit and diagnostics endpoints
- Local SQLite development mode
- PostgreSQL/Supabase mode through `DATABASE_URL`

## Local run

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

Open:

`http://127.0.0.1:8000`

API docs:

`http://127.0.0.1:8000/docs`

Seeded local account when `SEED_DEMO_DATA=true`:

`investigator@cipher.local` / `cipher`

## PostgreSQL/Supabase

Set `DATABASE_URL` to your Supabase PostgreSQL connection string. The Python database adapter selects PostgreSQL automatically when it is present. Apply `supabase/migrations/001_init_schema.sql` to a new database, then verify with `/api/db-test` and `/api/health/deep`.

Do not commit `.env`, passwords, API keys, production evidence or `cipher.db`.

## Test data

`samples/CIPHER_complete_case_master_single_CSV.csv` is synthetic end-to-end test data. It is intended for application testing and is not real investigative information.

## API test guide

See `BACKEND_API_TEST_GUIDE.md` for endpoint-by-endpoint testing.

## Deployment note

This package is prepared for the Python-first phase. Local SQLite is for development. For production, use PostgreSQL/Supabase and persistent private object storage for uploaded evidence before deploying to Vercel. The Vercel deployment layer is deliberately kept separate from this phase so database and workflow behavior can be validated first.


GIS/TIMELINE DATA FLOW FIX (local correction)
- Timeline UI now replaces legacy demo cards with verified events from /api/cases/{case_id}/timeline.
- GIS no longer falls back to hardcoded tactical locations. It renders verified case entities/locations and verified relationship lines from the backend.
- /gis/corridors now represents actual verified relationships rather than a synthetic sequential corridor.


## Neo4j graph database (AuraDB Free)

CIPHER uses PostgreSQL/SQLite for relational case/evidence/review data and Neo4j for the verified graph projection. Set `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, and `NEO4J_DATABASE` in `.env`. For the final graph architecture keep `NEO4J_REQUIRED_FOR_GRAPH=true`.

The Python service synchronizes only `VERIFIED` entities and relationships into Neo4j. Review decisions therefore control what enters the graph. Network graph, neighbor lookups, relationship details, degree centrality, and shortest-path requests use Neo4j when it is configured. Community grouping uses deterministic Python/NetworkX over graph data fetched from Neo4j because AuraDB Free does not include Neo4j Graph Data Science.

Run `GET /api/health/neo4j` after starting the backend to verify the graph connection.

## Windows startup and Neo4j test

1. Activate the virtual environment.
2. Ensure `.env` contains `CIPHER_UPLOADS_DIR=./uploads` and `CIPHER_FRONTEND_DIR=./frontend`.
3. Start with `python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload`.
4. Open `http://127.0.0.1:8000/` and `http://127.0.0.1:8000/docs`.
5. For Aura connectivity run `python verify_neo4j.py`. The included `sitecustomize.py` and `neo4j_graph.py` set the certifi trust store automatically when no explicit `SSL_CERT_FILE` is supplied.

## LLM provider chain

CIPHER now uses an automatic cloud-first LLM chain for the Investigation Co-Pilot:

1. Gemini API — `gemini-3.1-flash-lite`
2. OpenRouter — `openrouter/free`
3. Ollama — `qwen3:8b` local fallback

Set the provider keys in `.env` and leave `LLM_PROVIDER=auto`. CIPHER tries the providers in `LLM_FALLBACK_ORDER` and records the selected provider, model, attempts and latency in the AI query response. RAG, graph, GIS, timeline, ML and evidence provenance remain backend-controlled and grounded.

See `LLM_API_SETUP.md` for configuration.
