# CIPHER Network + GIS Fixes

This build corrects the case data flow for evidence/CSV -> extraction -> review -> verified network -> GIS.

## Important behavior

1. Uploading TXT/CSV/PDF evidence or using the Network CSV importer creates extracted entities, relationships, locations and events as **PENDING** findings.
2. Imported evidence now sends the user to **Review**, not directly to Network.
3. Only entities and relationships whose review decision is ACCEPT/EDIT/MERGE (stored as `verified`) appear in the trusted Network graph.
4. Network edges display the relationship type (`CALLS`, `USES_PHONE`, `TRANSFERS_TO`, etc.).
5. GIS reads the same verified entities, linked verified locations, and verified relationships as Network.
6. GIS relationship lines are built from actual verified relationships, never from a synthetic sequential corridor.
7. Add Waypoint now persists the waypoint in the active case and reloads GIS data from the backend.
8. CSV extraction recognizes common edge-column names including `connected_to`, `connects_to`, `linked_to`, `related_to`, `source`, `from`, `target`, `to`, `caller`, and `callee`.

## Validation completed

- Python compile: PASS
- Frontend JS syntax: PASS
- Generic CSV -> Review -> Network -> GIS -> Waypoint: PASS
- Existing backend smoke test: PASS
