# CIPHER Review + Network Backend Fix QA

## Review fixes
- Review page uses one page-level vertical scroll surface.
- Horizontal page overflow is disabled; category tabs wrap instead of creating a horizontal scrollbar.
- Inspector decision area remains accessible with sticky action controls.
- `ACCEPT SELECTED` fixed: removed undefined `selectedReviewItemIds` reference and uses `selectedItemIds`.
- Added `REJECT SELECTED` bulk action.
- Added backend `/api/review/bulk-reject` endpoint with audit/review-state updates.
- Single Accept/Reject continue using authenticated backend endpoints.
- Inspector close state is correctly reset.

## Network / CSV backend flow
- Network requests `/api/cases/{case_id}/graph?include=pending`.
- Backend returns case entities/relationships with `pending` and `verified` states for this request.
- Normal graph endpoint remains verified-only.
- CSV evidence is still uploaded through the existing Evidence CSV flow and stored as a backend document.
- Local browser CSV graph is only an immediate bridge while the evidence worker is processing.
- Once the worker creates database entities/relationships, the frontend polls for that exact document and switches to backend graph data.
- Review Accept promotes linked entities/relationships/locations/events to `verified`, making them part of the normal verified graph.
- Review Reject marks linked records rejected.

## Evidence worker startup
- `START_CIPHER.bat` now starts both the API and `python_backend.worker`.
- `STOP_CIPHER.bat` stops both processes.

## Validation performed
- `node --check frontend/script.js` — PASS
- `python3 -m compileall -q app.py python_backend` — PASS
- Bulk Accept endpoint isolated test — HTTP 200, `accepted_count=1`
- Bulk Reject endpoint isolated test — HTTP 200, `rejected_count=1`
- Master CSV import isolated test — HTTP 200; 26 nodes, 33 relationships, 6 evidence, 5 locations, 7 observations, 9 events, 8 review items imported
- Pending-inclusive graph after master CSV import — HTTP 200; 28 nodes, 33 edges; pending + verified states returned
- Review pending API — HTTP 200
- No remaining `selectedReviewItemIds` reference
