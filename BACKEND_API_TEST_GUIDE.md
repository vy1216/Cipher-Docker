# CIPHER Python Backend API Test Guide

The API is the source of truth for the investigation flow:

`CASE -> EVIDENCE -> PROCESSING -> REVIEW -> VERIFIED NETWORK -> GIS -> TIMELINE -> REPORT/AUDIT`

Base URL for local development:

`http://127.0.0.1:8000`

## 1. Start the backend

Ensure `.env` contains `CIPHER_UPLOADS_DIR=./uploads` and `CIPHER_FRONTEND_DIR=./frontend`.

```powershell
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

## 2. Public health checks

```powershell
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/config
curl http://127.0.0.1:8000/api/status
curl http://127.0.0.1:8000/api/db-test
curl http://127.0.0.1:8000/api/capabilities
curl http://127.0.0.1:8000/api/health/ai
```

`/api/health` only proves the API process is alive. `/api/db-test` checks the configured database connection. `/api/config` reports whether Gemini/Groq/database are configured without returning secrets.

## 3. Authentication

Seeded local account when `SEED_DEMO_DATA=true`:

- email: `investigator@cipher.local`
- password: `cipher`

```powershell
curl -X POST http://127.0.0.1:8000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"investigator@cipher.local","password":"cipher"}'
```

Copy the returned `access_token` and set it in PowerShell:

```powershell
$TOKEN="PASTE_TOKEN_HERE"
$H=@{ Authorization = "Bearer $TOKEN" }
```

Unauthenticated protected requests should return `401`.

## 4. Cases

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/cases -Headers $H
```

Create:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/cases -Method POST -Headers $H -ContentType 'application/json' -Body '{"title":"Test Investigation","case_type":"Communication Network","priority":"HIGH","description":"API test case","incident_date":"2026-09-16"}'
```

## 5. Evidence

Upload only TXT, CSV or PDF for this MVP.

```powershell
curl -X POST http://127.0.0.1:8000/api/cases/1/documents `
  -H "Authorization: Bearer $TOKEN" `
  -F "file=@samples/CIPHER_complete_case_master_single_CSV.csv"
```

Process the uploaded evidence:

```powershell
curl -X POST http://127.0.0.1:8000/api/cases/1/evidence/DOCUMENT_ID/process `
  -H "Authorization: Bearer $TOKEN"
```

Open the actual saved file:

```text
GET /api/cases/1/evidence/DOCUMENT_ID
```

Read metadata:

```text
GET /api/cases/1/evidence/DOCUMENT_ID/metadata
```

## 6. Entities and relationships

List entities:

```text
GET /api/cases/1/entities
```

Create a node:

```json
POST /api/cases/1/entities
{
  "label": "Test Person",
  "entity_type": "person",
  "aliases": "Test Alias",
  "verification_status": "verified"
}
```

Create a relationship:

```json
POST /api/cases/1/relationships
{
  "source_entity_id": 1,
  "target_entity_id": 2,
  "relationship_type": "USES_PHONE",
  "verification_status": "verified"
}
```

The backend verifies both entities belong to the same case.

## 7. Master CSV

Single-file import:

```text
POST /api/cases/{case_id}/import-master-csv
```

The unified CSV is dependency-ordered internally:

1. case
2. evidence
3. nodes
4. locations
5. relationships
6. observations
7. events
8. review_queue
9. audit_log
10. ai_test_issues
11. test_cases

The included test file should import with zero skipped rows and zero errors on a clean seeded database.

## 8. Review

```text
GET  /api/cases/1/review
GET  /api/review/REVIEW_ID
POST /api/review/REVIEW_ID/accept
POST /api/review/REVIEW_ID/edit
POST /api/review/REVIEW_ID/reject
POST /api/review/REVIEW_ID/merge
POST /api/review/bulk-accept
GET  /api/cases/1/review/history
```

Accept/edit promotes the attached entity, relationship, location or event to `verified`. Reject keeps it out of the trusted graph.

## 9. Network

```text
GET  /api/cases/1/graph
GET  /api/cases/1/graph/nodes/ENTITY_ID
GET  /api/cases/1/graph/nodes/ENTITY_ID/neighbors
GET  /api/cases/1/graph/relationships/RELATIONSHIP_ID
POST /api/cases/1/graph/path
POST /api/cases/1/graph/analytics/centrality
POST /api/cases/1/graph/analytics/communities
POST /api/cases/1/graph/analytics/patterns
```

The normal graph contains only verified entities and verified relationships.

## 10. GIS

```text
GET  /api/cases/1/gis-data
GET  /api/cases/1/gis/locations
GET  /api/cases/1/gis/nearby
GET  /api/cases/1/gis/corridors
POST /api/cases/1/gis/waypoints
POST /api/cases/1/locations
```

`gis-data` derives point features from verified entity coordinates and saved locations. Relationship lines are derived from verified network relationships whose endpoints have coordinates.

## 11. Timeline

```text
GET  /api/cases/1/timeline?status=verified
POST /api/cases/1/timeline
```

Only verified timeline events should be treated as trusted case timeline entries in the normal workflow.

## 12. AI Investigator

Available case list:

```text
GET /api/ai/cases
```

Case-scoped AI endpoints include:

```text
POST /api/cases/1/ai/query
GET  /api/cases/1/ai/activity
GET  /api/cases/1/ai/suggestions
POST /api/cases/1/ai/review-action
POST /api/cases/1/ai/draft-report
POST /api/cases/1/ai/approve-report
```

Gemini/Groq keys are never returned by health/config endpoints.

## 13. Audit / custody

```text
GET /api/cases/1/audit
GET /api/cases/1/blockchain-custody
GET /api/health/deep
GET /api/cases/1/diagnostics
```

The custody endpoint is a hash-based audit ledger. It should not be presented as a live public blockchain unless actual blockchain anchoring is enabled.

## 13. No-provider fallback behavior

If neither `GEMINI_API_KEY` nor `GROQ_API_KEY` is configured, the application remains usable for local testing:

- TXT/PDF evidence uses deterministic, source-bound extraction for explicit identifiers, numbered incident locations, relationship verbs, coordinates, and date candidates.
- Extracted findings enter `PENDING` review and do not enter the trusted graph until accepted/edited.
- AI Investigator returns a database-backed deterministic response instead of a provider error.

This mode is intended for development/testing; configure Gemini and Neo4j for the full external-AI/graph deployment.
