"""Fail-fast diagnostic/bootstrap for CIPHER InsightFace + ArcFace."""
from .face_engine import preflight
import json
if __name__ == "__main__":
    result=preflight(); print(json.dumps(result,indent=2)); raise SystemExit(0 if result.get("status")=="READY" else 1)
