# CIPHER Final QA — Evidence + Vision Integration

Date: 2026-09-25

## Automated checks

- Python `compileall`: PASS
- Frontend `node --check frontend/script.js`: PASS
- Frontend/backend route contract: PASS
- Fresh SQLite schema initialization: PASS
- Generic TXT evidence upload + processing: PASS
- Generic CSV evidence upload + processing: PASS
- PDF evidence upload + processing: PASS
- RAG TXT/CSV indexing + search: PASS
- Face Reference Dataset ZIP ingestion: PASS
- Canonical entity association from dataset folder: PASS
- Unknown Vision image persisted as evidence: PASS
- Case-scoped face gallery search: PASS (deterministic face-engine integration test)
- Candidate review ACCEPT: PASS
- Candidate review REJECT: PASS
- Canonical Person verification propagation: PASS
- Verified relationship propagation: PASS
- Verified GIS location propagation: PASS
- Verified timeline propagation: PASS
- Evidence observation/provenance recording: PASS
- Network node intelligence after accepted identity: PASS
- Gemini -> OpenRouter fallback: PASS
- Gemini -> OpenRouter -> Ollama fallback: PASS
- All AI providers unavailable path: PASS
- Existing full-stack regression test: PASS

## Model-runtime limitation

The packaging/QA environment does not have the InsightFace Python package installed. Therefore,
real ArcFace inference against a photograph could not be executed in this environment. CIPHER
reports this as an unavailable face runtime and never substitutes a fake identity result.
The actual Windows runtime should install `python_backend/requirements-ai.txt` and run the existing
face preflight/model bootstrap before using production Vision matching.
