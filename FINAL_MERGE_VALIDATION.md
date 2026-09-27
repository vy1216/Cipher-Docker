# CIPHER Final Merge Validation

The polished UI is preserved byte-for-byte. The backend contains the corrected evidence/RAG/graph/face/ML stack plus the cloud-first LLM provider chain.

LLM chain:

`Gemini (gemini-3.1-flash-lite) -> OpenRouter (openrouter/free) -> Ollama (qwen3:8b)`

All provider contracts and the actual `/api/cases/{case_id}/ai/query` route were tested with local deterministic provider mocks. Real cloud credentials are intentionally not included in the ZIP.

Regression suites completed successfully:

- `python_backend/qa_complete.py`
- `python_backend/full_stack_test.py`
- `python_backend/llm_provider_qa.py`
- `python_backend/llm_route_qa.py`
- `python_backend.verify_frontend_contract`
- `node --check frontend/script.js`
- `python -m compileall python_backend`
