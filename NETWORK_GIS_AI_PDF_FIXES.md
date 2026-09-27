# CIPHER Network / GIS / AI / PDF Fixes

Updated from the previous `CIPHER_POSTGRES_NEO4J_AURA_FREE_FULLY_CORRECTED` project.

## Network
- Normalized Neo4j / relational graph payloads before Cytoscape rendering.
- Prefixed relationship edge IDs (`edge-<id>`) so edge IDs cannot collide with entity node IDs.
- Verified relationships render as actual Cytoscape edges with visible labels/arrows.
- Clicking an edge opens a relationship inspector showing relationship type, confidence, status, and evidence.
- Empty verified-edge states now explain that Review must approve relationships before they enter the trusted graph.

## GIS
- Relationship corridors continue to derive from verified source/target entity coordinates.
- Existing Network -> GIS synchronization is preserved.
- Add Waypoint now prompts for a waypoint name/address, saves to the active case, reloads the GIS data, and shows a confirmation.
- Waypoint mode button state is visible while active.

## AI Investigator
- Gemini model is configurable with `GEMINI_MODEL`; default is `gemini-3.6-flash`.
- Removed hard-coded `gemini-2.5-flash` / `gemini-2.0-flash` calls.
- `/api/ai/health` is public and reports provider/model configuration and reachability.
- AI query failures now return a clear backend error instead of silently falling back to a misleading deterministic answer when no fallback provider is configured.

## Evidence PDF export
- Case Report PRINT / EXPORT PDF now calls the authenticated backend endpoint:
  `GET /api/cases/{case_id}/report.pdf`
- The backend generates a real PDF containing case metadata, verified evidence, verified entities, verified relationships, verified locations, and verified timeline events.
- PDF output is case-specific and excludes pending/rejected findings from verified sections.

## Verification performed
- Python syntax check: PASS
- Frontend JavaScript syntax check: PASS
- Frontend/backend route contract check: PASS
- Local Python backend smoke test: PASS
- Manual relationship create -> graph payload: PASS
- Local report PDF generation: PASS (`%PDF` output)
