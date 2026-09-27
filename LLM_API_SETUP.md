# CIPHER LLM API Setup

CIPHER now uses an automatic LLM fallback chain:

1. Gemini API (default: `gemini-3.1-flash-lite`)
2. OpenRouter free router (`openrouter/free`)
3. Local Ollama (`qwen3:8b`)

The frontend does not change. RAG, SQLite/PostgreSQL, Neo4j, GIS, timeline, ML, and Face AI remain in the CIPHER backend. Only final grounded language generation uses the provider chain.

## Configure `.env`

```env
LLM_PROVIDER=auto
LLM_FALLBACK_ORDER=gemini,openrouter,ollama

GEMINI_ENABLED=true
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_MODEL_FALLBACKS=

OPENROUTER_ENABLED=true
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
OPENROUTER_MODEL=openrouter/free

OLLAMA_ENABLED=true
OLLAMA_MODEL=qwen3:8b
```

A key is required for each cloud provider you want to use. If a provider is not configured or returns an error/rate limit, CIPHER automatically tries the next provider.

## Health check

Open:

`http://127.0.0.1:8000/api/health/ai`

The response reports configured providers, the fallback order, Ollama reachability, and available configured providers.

## AI query behavior

`POST /api/cases/{case_id}/ai/query` returns `provider`, `model`, `llm_status`, fallback attempts, and latency in addition to the existing response fields.

## Data handling

Only the grounded evidence package assembled by CIPHER is sent to a cloud LLM. Do not put real sensitive investigation data into a free-tier provider unless your organization's policy permits it.
