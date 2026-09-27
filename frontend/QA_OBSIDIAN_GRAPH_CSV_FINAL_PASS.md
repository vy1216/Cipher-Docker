# CIPHER — Obsidian-style Network / CSV Final QA

## Scope

Frontend-only network graph pass based on the documented interaction model of Obsidian Graph view: force-directed nodes, link springs, repulsion, soft center force, connectivity-driven node sizing, hover connection emphasis, drag persistence, and smooth zoom/pan.

Reference checked during implementation: Obsidian Graph view documentation.

## Changes

- Reworked `frontend/script.js` network physics into a continuously relaxed force system.
- Added many-body repulsion, spring links, soft center gravity, collision spacing, damping, low-frequency ambient motion, and velocity limiting.
- Main hub is only slightly larger than immediate neighbors; satellites progressively shrink with connectivity.
- Added hover connection emphasis and label reveal for low-degree nodes.
- Dragged nodes become pinned and retain their position through refresh/save.
- Replaced DOM particle elements with a canvas flow layer to reduce layout/reflow overhead.
- Added soft hub halo/pulse and continuous relationship particles.
- Updated Cytoscape renderer options for motion blur and smoother viewport movement.
- Kept all backend/API source files untouched.

## CSV test

Input: `cipher_import_sample.csv`

Parsed result:
- 13 non-empty data rows
- 7 entity nodes
- 6 relationship edges
- Highest-degree hub: `Farhan Merchant` (5 connections)

The CSV was uploaded through the existing frontend import path during QA. For isolated graph rendering, the same parsed entities/relationships were loaded into a test database without modifying backend source files.

Physics QA simulation using the same tuned force parameters:
- no node overlap detected
- minimum center-to-center node spacing after relaxation: ~122.83 world units
- hub remained centered without hard-lock jitter
- linked nodes stayed in a coherent web

## Validation

- `node --check frontend/script.js`: PASS
- HTML parse: PASS
- Duplicate IDs: NONE
- CSS brace balance: PASS
- CSV parse: PASS (7 nodes / 6 links)
- Physics QA: PASS
- Backend/non-frontend source hash comparison: 0 changed files
- ZIP integrity: PASS

## Browser-render limitation

The execution environment blocks Chromium navigation to local HTTP/file origins and the external Cytoscape CDN cannot be fetched from the container. Therefore the supplied visual preview is a standalone canvas render using the same CSV topology and tuned physics parameters; it is not represented as a successful live-browser render of the application itself.
