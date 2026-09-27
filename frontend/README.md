# CIPHER frontend — Vercel

Deploy this `frontend/` directory as a standalone Vercel project.

Before deploying, edit `config.js`:

```javascript
window.CIPHER_API_BASE = "https://YOUR-BACKEND.onrender.com";
```

The backend must allow that Vercel origin through `CIPHER_CORS_ORIGINS`.
