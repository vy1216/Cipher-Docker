# PostgreSQL + GIS + Console Fixes

This build fixes three production issues exposed after connecting Supabase PostgreSQL:

1. `PGCursor.lastrowid` now works with psycopg2 `RealDictCursor` by reading the returned `id` by key and falling back to positional access. This fixes inserts such as case creation.
2. `/api/cases/{case_id}/gis-data` no longer uses SQLite-style `GROUP BY e.id` / `GROUP BY r.id` with `SELECT e.*` in PostgreSQL. It selects the latest verified location per entity using a correlated subquery, so PostgreSQL accepts the query and GIS relationship corridors can be returned.
3. `showNetworkToast` is exported to `window` so independently-scoped graph modules can call it. Unsupported Cytoscape `shadow-*` style properties were removed to eliminate non-fatal console warnings.

The local SQLite fallback remains supported.
