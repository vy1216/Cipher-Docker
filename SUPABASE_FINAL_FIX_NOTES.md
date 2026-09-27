# CIPHER Supabase/PostgreSQL Final Fixes

This build addresses the recurring 500s seen after switching from SQLite to Supabase PostgreSQL.

1. Startup performs additive PostgreSQL schema reconciliation for older Supabase tables, using ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
2. Identity/serial sequences are resynchronised best-effort after reconciliation.
3. Case creation on PostgreSQL uses `INSERT ... RETURNING *` and does not depend on the compatibility `lastrowid` path.
4. Document uploads use `RETURNING *` on PostgreSQL and report storage failures distinctly.
5. `/api/health` now verifies the actual DB connection and reports Supabase Storage health.
6. `/api/health/storage` reports the private `cipher-evidence` bucket status.
7. Frontend case creation now waits for backend confirmation before showing “CASE CREATED”; the real numeric database case id is stored in `CipherCaseState`.
8. Evidence upload can no longer race a not-yet-persisted case.
9. Supabase Storage failures return a descriptive 502 rather than an opaque 500.
10. Existing UI/theme remains unchanged.

## Local validation
- Python compilation performed after patching.
- Frontend files are checked for obvious syntax regressions.
- SQLite create-case path remains supported.
- PostgreSQL-specific paths are statically audited; live Supabase credentials are required for an external DB/Storage integration test.
