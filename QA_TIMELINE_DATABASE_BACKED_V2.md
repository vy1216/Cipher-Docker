# CIPHER Timeline — Database-Backed Investigation Feed QA

## Architecture

`CSV -> /api/cases/{case_id}/import-master-csv -> timeline_events -> /api/cases/{case_id}/timeline?status=ALL -> Timeline UI`

The Timeline workspace contains no fixed case events. Event narrative, timestamp, status, confidence, source reference, entity, location and evidence are populated from the active case response.

## Validation performed

- Python compileall: PASS
- Frontend JavaScript `node --check`: PASS
- Existing hardcoded workspace event cards removed: PASS
- Backend timeline endpoint returns linked entity/location/evidence context: PASS
- Master CSV import tested against a clean copied SQLite database: PASS
- Test CSV imported: 26 nodes, 33 relationships, 6 evidence records, 5 locations, 9 timeline events, 8 review items
- Timeline API returned 9 events after import: PASS
- First returned events matched source CSV descriptions and timestamps: PASS
- No OSIRIS code was added by this Timeline change.

## Runtime behavior

1. Opening Timeline fetches the active case from the backend.
2. `ALL / VERIFIED / PENDING` filters operate on backend event status.
3. Search operates across event narrative, type, linked entity, location, evidence and source reference.
4. Selecting an event opens its investigation inspector.
5. Inspector actions can open Network, GIS, or Evidence when the event has the required linkage.
6. If the backend is still processing an uploaded CSV, the exact selected CSV can temporarily appear as `CSV PREVIEW`; this is a derived preview, not hardcoded case data.
7. Once backend records exist, the case database is the authoritative Timeline source.
