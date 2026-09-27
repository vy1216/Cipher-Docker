# CIPHER V15.2 — Network Links Inspector UI QA

## Scope
Frontend-only refinement. Backend source and API contracts were not changed.

## Network LINKS tab
- Keeps the existing backend node-intelligence endpoint: `/api/cases/{case_id}/graph/nodes/{entity_id}/intel?include=pending`.
- Renders graph-local connected edges immediately after node selection so the LINKS tab is not visually empty while the backend request is in flight.
- Replaces the temporary/local relationship cards with authoritative backend relationship records when the response arrives.
- Relationship cards now use readable typography, larger line-height, explicit direction, relationship type, source → target path, connected entity, and evidence text.
- Long entity names and evidence wrap instead of colliding with controls.
- No Confidence or Verification-status fields were added to the LINKS panel.
- Responsive inspector width was increased so the relationship text has usable reading space.

## QA performed
- `node --check frontend/script.js` — PASS
- CSS/HTML are static frontend changes only.
- Backend source was not edited by this pass.
