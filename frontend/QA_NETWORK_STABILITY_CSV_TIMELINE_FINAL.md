# Cipher — Network Stability + CSV Timeline Final Pass

## Scope
Frontend-only refinement of the existing Cipher build.

### Network graph
- Added soft viewport containment and a final hard safety clamp so force physics cannot drive nodes outside the visible graph canvas.
- Reduced post-convergence motion so the existing organic physics remains alive without continuous drift.
- Dragging a node now moves its full connected component as one investigation cluster.
- The dragged cluster is constrained to the visible graph viewport.
- Dragged positions remain pinned/saved in the existing local position persistence flow.

### CSV timeline
- CSV uploads now produce a local pending timeline immediately from explicit date/time fields or dates embedded in evidence text.
- Relationship rows become chronological timeline cards.
- Existing flip-card timeline UI is reused; no backend schema or processing changes were made.
- Timeline displays `CSV TRACE / PENDING` until verified timeline data becomes available.
- When verified events exist, the existing backend timeline remains authoritative and the local preview is cleared.

## Test CSV
`cipher_import_sample.csv`

Expected local timeline: 6 events dated 2026-01-14 through 2026-01-18.

## Validation
- `node --check frontend/script.js` PASS
- `node --check frontend/runtime.js` PASS
- JavaScript/CSS brace counts balanced.
- Local timeline parser test: 6 events extracted from the supplied 7-node/6-link CSV.
- No backend source files modified.
