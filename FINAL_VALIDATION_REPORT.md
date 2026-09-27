# CIPHER Final Validation Report — Cloud LLM Fallback Edition

## Implementation

The Investigation Co-Pilot now uses this automatic provider chain:

1. Gemini API — `gemini-3.1-flash-lite` (free-tier configuration)
2. OpenRouter — `openrouter/free` (free-model router)
3. Ollama — `qwen3:8b` local fallback

Configuration is controlled by `.env`:

```env
LLM_PROVIDER=auto
LLM_FALLBACK_ORDER=gemini,openrouter,ollama
```

Cloud providers are optional. Missing API keys are skipped. Provider failures/rate limits/timeouts are recorded and the next provider is attempted.

## Grounding

The LLM receives a case-isolated evidence package assembled by CIPHER. Verified entities/relationships/locations/timeline records remain trusted facts; pending review items, face matches and ML findings remain candidates/model findings. The LLM cannot write directly to the verified graph.

## Validation Results

- Python compilation: PASS
- Frontend JavaScript syntax: PASS
- Frontend/backend route contract: PASS — 185 backend route shapes, 24 frontend fetch paths
- Full-stack evidence/RAG regression: PASS
- Existing evidence reindex regression: PASS
- Ollama/Qwen compatibility contract: PASS
- Gemini provider contract: PASS (mocked)
- Gemini -> OpenRouter automatic fallback: PASS (mocked)
- Gemini + OpenRouter -> Ollama fallback: PASS (mocked)
- All-provider-unavailable handling: PASS (mocked)
- `/api/cases/{case_id}/ai/query` provider routing: PASS (mocked)
- Face API graceful degradation: PASS in the packaging environment
- Entity resolution review contract: PASS
- ML evidence-fusion contract: PASS
- ZIP packaging/integrity: PASS

## External-provider limitation

No real Gemini or OpenRouter API keys are bundled or available in the build environment, so real external inference was not executed during packaging. The HTTP contracts, JSON parsing, provider selection, fallback behavior, route response, and failure handling were tested with deterministic local mocks. A user must place their own API keys in `.env` to exercise the real cloud providers.

## Face runtime limitation

The packaging environment does not contain the optional InsightFace runtime, so the full-stack test reports Face AI unavailable there. The ZIP pins `insightface==2.0`, `onnxruntime>=1.18,<2`, `opencv-python-headless>=4.10,<6`, and NumPy `<3`. InsightFace 2.0 publishes a `py3-none-any` wheel and documents that the optional face3d extension is not compiled during ordinary installation. The Windows one-click setup verifies the installed face runtime and model preflight before startup.

## Frontend preservation

The polished frontend files remain byte-for-byte unchanged from the previous polished baseline:

- `frontend/index.html`
- `frontend/script.js`
- `frontend/style.css`
- `frontend/runtime.js`
- `frontend/config.js`
