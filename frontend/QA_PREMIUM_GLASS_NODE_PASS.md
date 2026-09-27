# CIPHER Premium Glass Node Pass

## Scope
Frontend-only Network visualization redesign. No backend/API/storage/schema files were modified.

## Preserved
- `/api/cases/{caseId}/graph` graph loading contract
- Entity IDs and relationship source/target IDs
- CSV preview/local graph flow
- Node inspector and GIS cross-view selection events
- Saved node positions in localStorage
- Add/delete node workflows
- Existing Cytoscape renderer and layout hooks

## Visual changes
- Replaced rectangular tactical node cards with a unified circular glass-bubble renderer.
- Importance is represented by rendered diameter and connectivity rather than different node shapes.
- Added subtle glass highlight, inner core, thin rim, and restrained emerald halo.
- Main graph hub is larger; direct neighbors are medium; satellites are smaller.
- Selected nodes receive a restrained animated halo.
- Relationships receive an occasional subtle premium pulse.
- Node labels remain interaction-driven rather than permanently cluttering the graph.

## Validation
- `node --check frontend/script.js` passes.
- The project still uses the existing Cytoscape CDN dependency.
- A live browser/Cytoscape render was not executed in this build environment, so visual browser rendering should be checked locally after extraction.

## Next pass
Physics/layout can be tuned separately without changing this node visual system.
