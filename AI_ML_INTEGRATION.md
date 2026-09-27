# CIPHER ML Link Prediction Integration

## What was added

- Case-scoped graph feature generation in `python_backend/ml_link_prediction.py`.
- Random Forest link prediction trained in memory from the current case graph, with a deterministic graph-score fallback when the graph is too small or ML dependencies are unavailable.
- Authenticated endpoints in the existing FastAPI application:
  - `GET /api/cases/{case_id}/ml/health`
  - `POST /api/cases/{case_id}/ml/predict`
  - `POST /api/cases/{case_id}/ml/candidates`
  - `POST /api/cases/{case_id}/ml/preview`
- Frontend AI Link Prediction controls in the existing Network tools panel.
- Predictions can run against the current uploaded CSV preview before the evidence workflow finishes, or against the case graph stored in the backend.
- Candidate links remain model estimates and are not automatically written as verified relationships.

## Run locally

From the project root:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r python_backend\requirements.txt
python -m uvicorn app:app --reload
```

Open the existing frontend through the project's normal startup flow.

## How to use

1. Open a case and upload a CSV using the existing UI.
2. Open the Network view.
3. Select a node; its ID is copied into the AI source field.
4. Enter a target entity ID and click **RUN PREDICTION**.
5. Click **FIND CANDIDATE LINKS** to rank possible new links.

## Important model note

The uploaded ZIP did not contain the previously trained temporal Joblib model or its training dataset. Therefore, this integration uses a case-scoped Random Forest trained from the current case graph at request time, with a safe deterministic fallback. It does not claim to reproduce the earlier temporal evaluation metrics. To use the previously trained temporal model, add the model artifact and its exact training feature contract, then wire it into the service after validating that the uploaded graph uses compatible node IDs and feature semantics.
