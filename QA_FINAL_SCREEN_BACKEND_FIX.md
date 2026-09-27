# CIPHER Final Screen/Backend QA

## Scope
This build is based on the last known-good `FIXED_REVIEW_NETWORK_CLEAN_UI` baseline. No Case Orbital redesign or unrelated screen redesign was applied.

## Review
- Bulk controls are now normal-flow, full-width stacked controls.
- Inspector Accept / Save Edit / Reject controls are always stacked vertically.
- Review page has `overflow-x:hidden`; no horizontal page overflow.
- Right inspector remains an ordinary scrollable column; decision controls are not sticky/absolute.
- Existing bulk Accept/Reject event handlers remain wired to backend review endpoints.

## Network
- Network loader requires explicit `CipherCaseState.caseSelected`.
- No fallback to case ID 1 when no case has been selected.
- Local CSV graph preview is not rendered by Network.
- Network graph is read from `/api/cases/{case_id}/graph?include=pending` only.
- Packaged SQLite database has zero entities/relationships/locations/timeline/review/document records, so no seeded sample graph appears before evidence ingestion.
- `clearNetworkGraph()` clears the Cytoscape canvas when no case is selected.
- CSV ingestion validates the CSV locally but waits for backend persistence before showing nodes.

## Timeline
- Timeline requires an explicitly selected case.
- Timeline reads `/api/cases/{case_id}/timeline?status=ALL` from the backend.
- Local CSV timeline fallback removed.
- Timeline does not auto-refresh on a timer.
- Render signature prevents rebuilding the event DOM when backend data is unchanged.
- Workspace timeline animations are disabled to prevent blinking/replay appearance.
- Reload Case remains the explicit refresh action.

## Backend QA
- `/api/health` -> 200 healthy.
- `python_backend/verify_frontend_contract.py` -> PASS: 165 backend route shapes / 24 frontend fetch paths.
- `python_backend/smoke_test.py` -> PASS.
- Empty packaged DB graph checks: cases 1/2/3 each return 0 nodes, 0 edges and 0 timeline events.
- Python compilation -> PASS.
- JavaScript syntax (`script.js`, `runtime.js`) -> PASS.

## Data model after packaging
Case definitions are preserved. Investigation data is intentionally empty until the investigator selects a case and uploads/imports evidence CSV data. This prevents demo/sample nodes from appearing in Network automatically.
