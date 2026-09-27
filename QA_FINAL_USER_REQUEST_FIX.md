CIPHER FINAL QA — REVIEW / NETWORK / TIMELINE

Scope of this build
- Review bulk controls: normal document flow; vertical stacking; no page-level horizontal overflow.
- Review inspector decision controls: ordinary stacked buttons; no sticky/floating overlap.
- Network: no graph request/render without an explicitly selected case.
- Network: workspace graph is backend-only; local CSV preview is not rendered as Network nodes.
- CSV ingestion: upload is rejected until a case is explicitly selected.
- Timeline: backend case timeline only; no local CSV timeline fallback and no hardcoded investigation events.
- Timeline: runtime renderer delegates to the database-backed workspace timeline.
- Timeline: workspace animation/refresh effects that looked like blinking are disabled.
- Existing Cases / GIS / Network physics / glass node styling are not redesigned in this pass.

Validation performed
- node --check frontend/script.js: PASS
- node --check frontend/runtime.js: PASS
- python -m compileall -q app.py python_backend: PASS
- /api/health: PASS
- CSV evidence -> worker -> backend graph: PASS (7 nodes, 6 links from test CSV)
- Unified master CSV -> backend graph: PASS (5 nodes, 4 relationships, 1 timeline event)
- Unified master CSV -> backend timeline: PASS (1 event returned from /timeline)
- Review bulk accept endpoint: PASS (200, accepted_count=2)
- Review bulk reject endpoint: PASS (200, rejected_count=2)
- Final packaged SQLite database: 3 cases, 0 entities, 0 relationships, 0 timeline events, 0 review items
  (clean graph state; no seeded/sample workspace nodes)
