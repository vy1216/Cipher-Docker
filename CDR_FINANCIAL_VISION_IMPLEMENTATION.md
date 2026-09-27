# CIPHER Vision — CDR + Financial Evidence Integration

This update keeps the existing Evidence, Face/ArcFace, Network, GIS, Timeline and RAG paths intact and adds source-driven CDR/financial retrieval to the existing Cipher Vision controls.

## Behavior

- `FETCH CASE CDR` retrieves the complete case CDR dataset available in uploaded CSV evidence.
- `FETCH STATEMENTS` retrieves the complete case financial/statement dataset available in uploaded CSV evidence.
- CSV schemas are detected dynamically; common CDR and financial header variants are normalized.
- When an investigator accepts a Cipher Vision face match, the canonical entity ID is used to highlight connected CDR and financial records while leaving unrelated records visible.
- Highlighting uses the person's canonical entity plus verified connected phone/account/entity identifiers. It does not fabricate records.
- Every structured record retains its source evidence ID and source filename.
- Audio evidence can be uploaded and preserved as communication evidence. No synthetic CDR metadata is generated from audio without a speech-to-text/transcript runtime.

## Validation

- Python compilation: PASS
- Frontend JavaScript syntax: PASS
- Backend/frontend route contract: PASS
- Existing CIPHER smoke test: PASS
- Existing full-stack test: PASS
- Existing QA suite: PASS
- Existing RAG complete test: PASS
- Dedicated CDR/financial parser test: PASS
- API retrieval/highlight test with case-scoped CDR and financial CSV fixtures: PASS

Browser automation was not used as a release gate because the available environment can block Chromium by administrator policy.
