# CIPHER One-Click Start

1. Install **Python 3.12.x** and ensure the Python Launcher (`py`) is available.
2. Install **Ollama** on Windows.
3. Double-click **`OneClick_Start.bat`**.

The launcher will:
- create `.venv` with Python 3.12;
- install core dependencies;
- attempt the RAG/Face/AI dependency set;
- create/update `.env` with Ollama/Qwen settings;
- start Ollama when it is installed but not running;
- pull `qwen3:8b` when it is missing;
- rebuild all case-isolated RAG indexes;
- start the FastAPI backend and the existing CIPHER frontend.

Open `http://127.0.0.1:8000` after startup.

If optional InsightFace installation fails on a machine, CIPHER remains runnable and the Face Health endpoint reports the exact unavailable dependency. No identity is auto-verified.
