# CIPHER — Vision + Evidence Dataset V10 Final QA

## Implemented workflow

Evidence remains the central case source. The Evidence workspace now supports PDF, TXT, CSV, JPG, JPEG, PNG and WEBP. The dedicated **FACE DATASET** action supports selecting multiple reference images in one operation and also retains the existing ZIP dataset workflow.

For multiple selected reference images:

```text
Evidence / FACE DATASET
        ↓
multiple JPG/PNG/WEBP
        ↓
case evidence + chain of custody
        ↓
canonical case face gallery
        ↓
entity resolution from filename convention
        ↓
InsightFace / ArcFace embedding
```

Supported filename conventions include `P101__01.jpg`, `P101_02.jpg`, `Arjun_Mehta_01.jpg`, etc. A filename/label is only an entity-resolution hint; it does not independently verify identity. Unresolved people receive a pending review item.

CIPHER Vision then performs:

```text
unknown image
 → ArcFace embedding
 → case-scoped gallery search
 → matched reference image
 → candidate Person/entity
 → related case evidence + RAG text hits
 → verified locations
 → verified relationships
 → timeline events
 → investigator ACCEPT/REJECT
 → canonical Person propagation to Network/GIS/Timeline
```

Identity remains unverified until investigator acceptance.

## Regression protection

The existing visual design files were preserved byte-for-byte:

- `frontend/style.css`
- `frontend/runtime.js`
- `frontend/config.js`

No UI redesign was performed.

## Tests completed

### Static/runtime tests

- Python compilation: PASS
- Frontend JavaScript syntax: PASS
- Backend import: PASS
- Route count/import contract: PASS
- Frontend/backend route contract: PASS
- ZIP integrity: PASS

### Evidence tests

- TXT upload/process: PASS
- CSV upload/process: PASS
- PDF upload/process: PASS
- JPG upload/process: PASS
- Evidence SHA-256/custody record: PASS
- Existing RAG indexing: PASS
- Existing evidence reindex: PASS

### Face dataset tests

- Multiple reference images in one multipart request: PASS
- Individual reference evidence records: PASS
- SHA-256/custody for reference images: PASS
- Face gallery enrollment: PASS
- Filename-to-entity resolution: PASS
- Existing ZIP face dataset regression: PASS
- Gallery image retrieval contract: PASS

### Vision tests

- Case-scoped gallery search: PASS
- Matched reference image returned: PASS
- Similarity candidate returned: PASS
- Related verified relationships returned: PASS
- Related verified GIS locations returned: PASS
- Related timeline events returned: PASS
- Related evidence documents returned: PASS
- RAG evidence hits returned when matching text exists: PASS
- ACCEPT review: PASS
- REJECT review: PASS
- Accepted identity creates verified evidence observation: PASS
- Canonical Person ID propagation: PASS

### Existing system regression

- Full sequential QA suite: PASS
- Full-stack integration suite: PASS
- Ollama/Qwen contract: PASS
- RAG contract: PASS
- ML evidence-fusion contract: PASS
- Entity-resolution contract: PASS

## Environment limitation

The packaging environment does not contain the optional InsightFace/ONNX Runtime model runtime, so physical ArcFace inference on a real photograph could not be executed in this environment. The production code does not fabricate a match when that runtime is missing. The complete Vision gallery/matching/review/propagation contract was tested with a deterministic test-only embedding engine.

On Windows, install the project's AI requirements and run:

```powershell
python -m python_backend.face_preflight
```

The preflight must report `READY` before using real photographs.
