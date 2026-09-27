# CIPHER V15.15 QA — Node Click/Drag Static Interaction

## Scope
Frontend-only interaction refinement based on V15.14.

## Changes
- Removed custom `grab` / `_grabStart` / `_dragMoved` interaction state.
- Removed custom post-grab movement behavior.
- Node click/tap remains the inspection/selection action.
- Native Cytoscape drag is used for repositioning.
- Static graph remains physics-free; release keeps the node at its new position.
- Drag remains bounded to the Network workspace.
- Position is saved on `dragfree` for case persistence.

## Verification
- `node --check frontend/script.js`: PASS
- Python backend `compileall`: PASS
- Compared against V15.14: only `frontend/script.js` changed; no backend source files changed.

## Interaction contract
`CLICK/TAP -> SELECT + INSPECT`
`DRAG -> MOVE`
`RELEASE -> STAY`

No force simulation or drag momentum is introduced.
