# CIPHER QA Validation Report

## Scope

The uploaded `CIPHER_ML_Integrated` project was reviewed across the frontend, FastAPI backend, SQLite data layer, graph API, GIS/timeline APIs, ML link-prediction APIs, CSV/master-CSV import paths, and static frontend/backend route contracts.

The existing UI/theme/layout were not redesigned or replaced.

## Corrections applied

1. Fixed a backend graph-neighbor crash in the relational fallback. SQLite `Row` objects were being accessed with `.get(...)`; the affected rows are now converted to dictionaries before optional-field access.
2. Hardened manual relationship creation:
   - accepts the existing `ent-`, `node-`, `rel-`, and `loc-` ID forms;
   - rejects self-links;
   - validates that both endpoints belong to the active case;
   - makes duplicate directed relationships of the same type idempotent, preventing accidental duplicate edges from double-clicks/retries;
   - returns explicit `created` / `already_exists` state;
   - preserves the existing verification workflow.
3. Improved relationship listing with source/target labels and entity types for reliable UI inspection.
4. Fixed the frontend manual-link workflow so a failed relationship request is surfaced instead of silently closing the modal as if the link had been saved.
5. Normalized the frontend relationship IDs before sending them to the API.
6. Removed the root `neo4j/` directory that shadowed the official Python `neo4j` package. Its schema file is now `neo4j_schema.cypher`. This is required for the Neo4j driver to import correctly when the project is run from its root directory.
7. Removed stale Python `__pycache__` artifacts from the deployment package.

## Validation performed

- Python compilation: PASS
- JavaScript syntax (`frontend/script.js`): PASS
- JavaScript syntax (`frontend/runtime.js`): PASS
- Frontend/backend static route contract: PASS — 153 backend route shapes, 20 detected frontend API paths, all detected paths mapped to a backend route.
- Backend smoke test: PASS
- Auth registration/login: PASS
- Case retrieval: PASS
- Entity creation: PASS
- Relationship creation: PASS
- Duplicate relationship retry/idempotency: PASS
- Relationship listing: PASS
- Graph retrieval: PASS
- Graph node retrieval: PASS
- Graph neighbors: PASS
- Relationship details: PASS
- Degree centrality: PASS
- Communities: PASS
- Patterns: PASS
- Shortest path: PASS
- ML health: PASS
- ML prediction: PASS
- GIS data: PASS
- Timeline: PASS
- Review API: PASS
- Sample CSV endpoint: PASS
- Self-relationship validation: PASS
- Unified master CSV import: PASS — 26 nodes, 33 relationships, 6 evidence records, 5 locations, 7 observations, 9 events, 8 review records imported with zero skipped/error records in the supplied sample.
- HTML duplicate-ID check: PASS — no duplicate DOM IDs detected.

## Neo4j note

The package contains the official `neo4j>=6,<7` dependency in its requirements. The execution environment used for this QA pass did not have that dependency installed and had no external package-network access, so a live AuraDB connection could not be performed here. The previous local `neo4j/` namespace-shadowing problem was removed, and the Neo4j integration remains configured through `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, and `NEO4J_DATABASE`.

For production, install dependencies from `python_backend/requirements.txt` and provide the Neo4j Aura credentials before starting the backend.
