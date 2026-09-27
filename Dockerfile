# CIPHER production image: full feature stack except Ollama/Qwen3.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=10000 \
    CIPHER_UPLOADS_DIR=/tmp/cipher-uploads \
    CIPHER_RAG_DIR=/tmp/cipher-rag \
    CIPHER_FRONTEND_DIR=/app/frontend \
    CIPHER_FACE_MODEL_ROOT=/tmp/cipher-models \
    CIPHER_FACE_PROVIDERS=CPUExecutionProvider \
    LLM_PROVIDER=gemini \
    LLM_FALLBACK_ORDER=gemini \
    GEMINI_ENABLED=true \
    OPENROUTER_ENABLED=false \
    OLLAMA_ENABLED=false

# Runtime libraries required by OpenCV/InsightFace and Tesseract OCR.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       tesseract-ocr \
       libgl1 \
       libglib2.0-0 \
       libgomp1 \
       libsm6 \
       libxext6 \
       libxrender1 \
       ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install the complete production dependency set:
# core CIPHER + RAG/FAISS + InsightFace/ONNX/OpenCV.
COPY requirements-production.txt /app/requirements-production.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install -r /app/requirements-production.txt

# Copy only application/runtime files. Documentation, local QA scripts,
# databases, caches and local setup scripts are excluded from the image.
COPY app.py pyproject.toml sitecustomize.py /app/
COPY frontend /app/frontend
COPY python_backend /app/python_backend
COPY supabase /app/supabase
COPY samples /app/samples
COPY neo4j_schema.cypher /app/neo4j_schema.cypher

# Writable runtime directories. Render's filesystem is ephemeral; permanent
# evidence belongs in Supabase Storage and DB-backed RAG metadata.
RUN useradd --create-home --shell /usr/sbin/nologin cipher \
    && mkdir -p /tmp/cipher-uploads /tmp/cipher-rag /tmp/cipher-models \
    && chown -R cipher:cipher /app /tmp/cipher-uploads /tmp/cipher-rag /tmp/cipher-models

USER cipher

EXPOSE 10000

CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-10000}"]
