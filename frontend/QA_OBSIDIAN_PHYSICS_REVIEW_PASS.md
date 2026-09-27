# Cipher — Obsidian Physics + Review Typography QA

## Scope
- Reworked the workspace Network graph from a one-shot Cytoscape COSE layout into a custom Obsidian-inspired spring/repulsion relaxation engine.
- Added a clear primary hub hierarchy: the highest-degree entity is rendered slightly larger; its direct neighbours are smaller but visually related.
- Added softer edge-flow particles and reduced their speed for a calmer, more fluid relationship-map feel.
- Preserved node dragging, selection, inspector updates, GIS sync, API graph loading, and local position persistence.
- Versioned saved graph positions to `cipher-network-positions-v3-*` so the new layout is actually used once instead of inheriting the previous physics positions.
- Reduced Review Queue heading/body/card typography so the page no longer feels vertically cramped.

## Validation
- `node --check frontend/script.js` — PASS
- HTML parse — PASS
- Duplicate IDs — NONE FOUND
- CSS brace balance — PASS
- Required network/review selectors present — PASS
- Non-frontend file changes — 0
- ZIP integrity (`unzip -t`) — PASS

## Backend
No backend files were modified.
