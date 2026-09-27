# CIPHER Python Backend

FastAPI backend for the CIPHER application.

## Database modes

- Local/default: SQLite (`CIPHER_DB_FILE`)
- PostgreSQL/Supabase: set `DATABASE_URL`

The API layer stays the same in both modes. The database adapter translates the existing parameterized SQL interface so the current frontend does not need a database-specific rewrite.

## Run

```powershell
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

For frontend/API compatibility verification:

```powershell
python python_backend/verify_frontend_contract.py
```
