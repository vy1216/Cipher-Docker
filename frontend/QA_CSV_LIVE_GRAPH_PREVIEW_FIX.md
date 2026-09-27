# CIPHER — CSV Live Graph Preview Fix

## Problem
The CSV upload endpoint intentionally returns `status: queued` because evidence is sent to the background verification/extraction pipeline. The frontend previously handled only `status: success`, then attempted to load the verified graph. Because queued CSV findings are not yet verified, the graph endpoint correctly returned no verified nodes/relationships, leaving the network canvas empty.

## Frontend-only fix
- Added a local CSV graph parser in `frontend/script.js`.
- Supports the compact CIPHER investigation CSV format with separate entity rows plus `source,target,relationship,evidence` relationship rows.
- Supports CIPHER master CSV rows using `record_type=nodes` and `record_type=relationships`.
- When the backend responds `status: queued`, the frontend immediately builds a clearly marked **CSV PREVIEW / PENDING REVIEW** graph from the uploaded CSV and switches to Network.
- The preview is never presented as verified evidence. The UI explicitly reports that review/acceptance is still required.
- If the verified graph later contains authoritative nodes, the temporary preview is cleared and the backend graph becomes authoritative.
- If the graph endpoint is temporarily unavailable while a pending CSV preview exists, the preview remains available locally.
- Added a visual pending-preview node treatment while retaining the Cipher/Obsidian-style force layout.

## Validation against supplied CSV
`cipher_import_sample.csv`
- 13 data rows
- 7 entity rows
- 6 relationship rows
- Farhan Merchant: degree 5
- No missing source/target relationships in the six relationship rows

## Backend
No backend source files were modified in this pass.
