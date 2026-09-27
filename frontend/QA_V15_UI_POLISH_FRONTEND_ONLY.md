# CIPHER V15 — UI Polish QA

## Scope
This pass is **frontend-only**. The backend, API implementation, database layer, RAG engine, face/vision services, LLM routing, and server configuration were not edited.

## UI work
- Refined the global Cipher AI assistant into a compact floating intelligence layer rather than a shrunken copy of the AI Investigator workspace.
- Preserved the existing AI DOM IDs and event wiring (`aiQueryInput`, `aiSubmitBtn`, `aiResponseContainer`, source/action controls, conversation handling).
- Added restrained glass, layered lighting, subtle depth, better typography hierarchy, focused composer, compact context pills, improved loading state, and cleaner response/source presentation.
- Refined landing-page navigation, hero hierarchy, CTA buttons, hero relationship-map surface, ticker, problem rows, capability cards, and final authentication CTA.
- Improved hover/focus/active motion while keeping Cipher's black/graphite + `#D9FF55` visual identity.
- Added responsive refinements for landing and AI drawer.

## Source/API integrity
- Only these project source files differ from the supplied base ZIP:
  - `frontend/index.html`
  - `frontend/style.css`
  - `frontend/QA_V15_UI_POLISH_FRONTEND_ONLY.md`
- No files under `python_backend/` were changed.
- No API routes were added, removed, or rewritten.
- No LLM provider code was changed.

## Static QA
- `node --check frontend/*.js` — PASS
- `python -m py_compile python_backend/*.py` — PASS
- HTML duplicate-ID scan — PASS
- Local HTML asset-reference scan — PASS
- Cipher AI orb asset — PASS
- Backend source hash comparison against supplied ZIP — PASS (source files unchanged)

## Runtime API smoke QA
Backend started locally from the supplied build with Uvicorn.

- `/health` — HTTP 200
- `/api/health` — HTTP 200
- `/api/health/ai` — HTTP 200
- `/api/ai/health` — HTTP 200
- `/api/health/storage` — HTTP 200
- `/api/cases` without auth — HTTP 401 (expected RBAC behavior)
- `/api/ai/cases` without auth — HTTP 401 (expected RBAC behavior)
- `/api/health/deep` without auth — HTTP 401 (expected RBAC behavior)
- OpenAPI route inventory — 190 routes exposed by the supplied backend
- `/api/cases/{case_id}/ai/query` — present in OpenAPI
- `/api/cases/{case_id}/timeline` — present in OpenAPI
- `/api/cases/{case_id}/graph` — present in OpenAPI
- `/api/cases/{case_id}/vision/evidence` — present in OpenAPI
- RAG health/search/query routes — present in OpenAPI
- face/vision routes — present in OpenAPI

## LLM status
The supplied backend reports the existing fallback order as:
`gemini -> openrouter -> ollama`.

This environment does not contain live Gemini/OpenRouter credentials and does not have a running Ollama service, so this QA pass does **not** claim live external-model inference. The frontend does not alter or bypass that server-side routing.

## Important boundary
This build intentionally does not modify backend behavior. The package should therefore be used as a frontend polish replacement over the supplied V15 backend-connected build.
