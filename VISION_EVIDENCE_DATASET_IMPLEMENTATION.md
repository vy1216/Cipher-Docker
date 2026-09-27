# CIPHER — Evidence + Vision Reference Dataset Integration

## Implemented workflow

```text
Evidence
  ├─ PDF / TXT / CSV  -> canonical evidence pipeline -> RAG / extraction
  ├─ JPG / PNG / WEBP -> canonical evidence -> Vision face candidate search
  └─ Face Reference Dataset (.zip)
       -> safe ZIP validation
       -> entity resolution by entity ID / external ID / label / folder
       -> ArcFace enrollment
       -> case-scoped face gallery
       -> review for newly created unresolved persons

CIPHER Vision unknown photo
  -> persist query image as case evidence
  -> detect face / ArcFace embedding
  -> search only current case gallery
  -> candidate + similarity
  -> investigator ACCEPT / REJECT
       ACCEPT -> canonical Person verified
              -> verified relationships available to Network
              -> verified locations available to GIS
              -> verified timeline observations available
              -> evidence/provenance observation recorded
       REJECT -> candidate remains rejected and does not enter trusted identity path
```

## Dataset ZIP format

Preferred:

```text
face_dataset.zip
├── 101/
│   ├── 01.jpg
│   └── 02.jpg
├── 205/
│   └── 01.jpg
└── manifest.csv   # optional
```

Folder names may be canonical entity IDs, entity external IDs, or exact person labels.
An optional `manifest.csv` can use `entity_id`, `display_name`/`name`/`label`, and
`image`/`path`/`filename` columns.

If a label cannot be resolved, CIPHER creates a **pending PERSON** record and a review item;
it is not silently treated as a verified identity.

## Safety and provenance

- Dataset ZIP extraction rejects absolute paths and `..` traversal.
- Dataset is capped at 500 images and 250 MB.
- Normal evidence remains capped by `MAX_UPLOAD_BYTES` (default 10 MB).
- Vision query images are persisted as `VISION_QUERY` evidence with SHA-256 custody metadata.
- Candidate similarity is explicitly a candidate signal, not identity proof.
- Only investigator acceptance promotes the candidate into the verified identity path.
- Accepted face observations are recorded in `evidence_observations`.
- Network/GIS/Timeline consume the same canonical entity ID; no frontend-only identity is created.

## Main implementation files

- `python_backend/main.py` — evidence upload, Vision match, face review/propagation APIs.
- `python_backend/evidence_pipeline.py` — PDF/TXT/CSV/image/face-dataset processing routing.
- `python_backend/face_dataset.py` — safe ZIP parsing and case gallery enrollment.
- `python_backend/face_intelligence.py` — ArcFace gallery matching and pending review creation.
- `python_backend/schema_extensions.py` — canonical Vision/RAG schema and migrations.
- `frontend/index.html` — Evidence upload and Face Dataset controls.
- `frontend/script.js` — Evidence upload processing and Vision review/cross-view propagation.

## Important runtime requirement

Actual face detection/enrollment/matching requires the configured InsightFace + ONNX Runtime +
model pack. The packaging environment used for this build does not contain the InsightFace runtime,
so the real model inference was not claimed as a live test. The end-to-end API/database/review/
propagation paths were tested with deterministic face-engine mocks, while the existing backend
health endpoint correctly reports the missing runtime instead of fabricating a match.
