"""Local Python trust-store bootstrap for CIPHER.

Python automatically imports sitecustomize when the project root is on sys.path.
This keeps the Neo4j Aura TLS CA bundle consistent for uvicorn and for simple
python -c connectivity checks on Windows.
"""
import os
try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
except Exception:
    pass
