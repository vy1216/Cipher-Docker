# CIPHER V12 — Face Dataset / Vision / Evidence / Graph Validation

## Fixes included

- Added globally accessible `escapeHtml()` and `showNetworkToast()` for the Face Dataset module, eliminating the frontend `ReferenceError` failures.
- Fixed `face_profiles` schema reconciliation so `source_evidence_id` and all other canonical gallery columns are added independently even when `display_name` already exists.
- Face Dataset multi-image upload now refreshes the Evidence register from authoritative backend state after the bulk API completes.
- Evidence register now distinguishes Face Dataset enrollment state from generic evidence processing state.
- Added retry enrollment for historical Face Reference uploads that were stored as evidence but failed to create a face profile.
- CIPHER Vision continues to use the canonical case-scoped `face_profiles` gallery and human review boundary.
- Graph loading now falls back to the verified relational graph when Neo4j is not configured or temporarily unavailable instead of returning an unexplained 503.
- Preserved the existing UI structure and existing API compatibility.

## Validation performed

1. `node --check frontend/script.js` — PASS
2. `node --check frontend/runtime.js` — PASS
3. `python -m compileall -q python_backend` — PASS
4. Canonical face schema migration against a legacy `face_profiles` table — PASS; missing `source_evidence_id` and other required columns are added.
5. Existing `python_backend/full_stack_test.py` — PASS
6. `python_backend/qa_complete.py` — PASS (all listed phases)
7. Mocked end-to-end Face Dataset → face profile → Cipher Vision candidate → ACCEPT review → verified entity → graph fallback — PASS
8. Historical Face Dataset evidence retry endpoint — PASS
9. Frontend duplicate-function check — PASS: one `uploadFaceDatasetImages()` implementation remains.

## Runtime limitation of this build environment

The packaging/test container does not have the InsightFace Python package or its model pack installed. Therefore the generic full-stack QA reports the expected optional face-runtime-unavailable state in this container. The user's Windows environment previously reported `insightface-arcface:buffalo_l` as READY, so actual model inference should be verified there after installing this ZIP.

## Expected user flow after deployment

Evidence → Face Dataset (multiple images) → evidence record + ArcFace profile → Cipher Vision query → candidate + reference image + similarity → investigator Accept/Reject → canonical entity propagation to Network/GIS/Timeline/Evidence.
