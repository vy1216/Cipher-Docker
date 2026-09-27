# CIPHER RAG — Complete Implementation

This build adds the evidence-grounded RAG layer without replacing the existing CIPHER Vision, Network, GIS, Timeline, Review, or ML systems.

## RAG capabilities
- Case-isolated PDF, TXT, CSV and DOCX ingestion.
- Optional image OCR through Tesseract; image evidence remains in the existing Vision/InsightFace pipeline.
- Paragraph-aware chunking with configurable chunk size/overlap.
- SentenceTransformers `all-MiniLM-L6-v2` embeddings when installed.
- FAISS case-local vector indexes when the embedding runtime is available.
- Deterministic TF-IDF fallback when SentenceTransformers/FAISS are unavailable.
- Hybrid retrieval: semantic + BM25 lexical retrieval + exact identifier/entity signals.
- Query-aware verified entity/location/relationship/timeline context for the LLM.
- Case-isolated source metadata and evidence/page/chunk references.
- Incremental per-document indexing and safe replacement on reindex.
- Existing stale upload paths can be recovered by filename during reindex.
- RAG health and direct RAG query APIs.
- Existing CIPHER AI Investigator endpoint continues to use the unified evidence-fusion engine.
- LLM source references are constrained to retrieved CIPHER evidence references.
- Pending review, face candidates and ML predictions remain explicitly non-verified.

## APIs
- `GET /api/cases/{case_id}/rag/health`
- `GET /api/cases/{case_id}/rag/search?q=...&limit=...`
- `POST /api/cases/{case_id}/rag/reindex`
- `POST /api/cases/{case_id}/rag/query`
- Existing `POST /api/cases/{case_id}/investigation/query` and `POST /api/cases/{case_id}/ai/query` remain supported.

## Existing systems intentionally preserved
- InsightFace + ArcFace face detection/matching code was not changed.
- Existing face gallery/review flow was not replaced.
- Existing Network/GIS/Timeline UI was not changed.
- Existing ML/link-prediction implementation was not replaced.
- Existing frontend files are byte-for-byte unchanged by the RAG implementation.

## Verification performed
- Deep RAG regression suite: PASS.
- Full-stack backend suite: PASS.
- Existing complete QA suite: PASS.
- Python compilation: PASS.
- Frontend JavaScript contract/syntax: PASS.
- Existing database migration compatibility check: PASS.
- Case-isolation retrieval test: PASS.
- DOCX ingestion test: PASS.
- OCR ingestion test: PASS where Tesseract is available.
- SentenceTransformers/FAISS execution path was exercised with deterministic test doubles because those packages are not available in the isolated build environment.
- Ollama was not available inside the isolated build environment; the existing provider contract was tested with the project's QA harness. The user's local Ollama configuration remains unchanged.
