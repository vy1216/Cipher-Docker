import os
import tempfile
import urllib.parse
import requests
from pathlib import Path

SUPABASE_URL = (os.getenv('SUPABASE_URL') or '').rstrip('/')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or ''
SUPABASE_STORAGE_BUCKET = (os.getenv('SUPABASE_STORAGE_BUCKET') or 'cipher-evidence').strip('/')


def configured() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET)


def _headers(content_type=None):
    h = {
        'Authorization': f'Bearer {SUPABASE_SERVICE_ROLE_KEY}',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
    }
    if content_type:
        h['Content-Type'] = content_type
    return h


def health_check() -> dict:
    if not configured():
        return {
            'configured': False,
            'ok': True,
            'bucket': SUPABASE_STORAGE_BUCKET,
            'status': 'local_storage_mode',
        }
    url = f'{SUPABASE_URL}/storage/v1/bucket/{urllib.parse.quote(SUPABASE_STORAGE_BUCKET, safe="")}'
    try:
        r = requests.get(url, headers=_headers(), timeout=8)
        if r.status_code < 300:
            return {
                'configured': True,
                'ok': True,
                'bucket': SUPABASE_STORAGE_BUCKET,
                'status_code': r.status_code,
            }
        return {
            'configured': True,
            'ok': False,
            'bucket': SUPABASE_STORAGE_BUCKET,
            'status_code': r.status_code,
            'error': (r.text or '')[:500],
        }
    except Exception as exc:
        return {
            'configured': True,
            'ok': False,
            'bucket': SUPABASE_STORAGE_BUCKET,
            'error': f'{type(exc).__name__}: {str(exc)[:500]}',
        }


def upload_bytes(object_path: str, content: bytes, content_type: str) -> str:
    if not configured():
        raise RuntimeError('Supabase Storage is not configured')
    safe = '/'.join(urllib.parse.quote(part, safe='') for part in object_path.split('/'))
    url = f'{SUPABASE_URL}/storage/v1/object/{urllib.parse.quote(SUPABASE_STORAGE_BUCKET, safe="")}/{safe}'
    r = requests.post(
        url,
        headers={**_headers(content_type), 'x-upsert': 'false'},
        data=content,
        timeout=30,
    )
    if r.status_code >= 400:
        # Retry with upsert for idempotent deployment retries.
        r = requests.post(
            url,
            headers={**_headers(content_type), 'x-upsert': 'true'},
            data=content,
            timeout=30,
        )
    if r.status_code >= 400:
        body = (r.text or '').strip().replace('\n', ' ')[:700]
        raise RuntimeError(f'Supabase Storage upload failed (HTTP {r.status_code}): {body}')
    return f'supabase://{SUPABASE_STORAGE_BUCKET}/{object_path}'


def download_uri(uri: str) -> bytes:
    if not uri.startswith('supabase://'):
        return Path(uri).read_bytes()
    raw = uri[len('supabase://'):]
    bucket, _, object_path = raw.partition('/')
    if not bucket or not object_path:
        raise ValueError('Invalid Supabase storage URI')
    safe = '/'.join(urllib.parse.quote(part, safe='') for part in object_path.split('/'))
    url = f'{SUPABASE_URL}/storage/v1/object/{urllib.parse.quote(bucket, safe="")}/{safe}'
    r = requests.get(url, headers=_headers(), timeout=30)
    if r.status_code >= 400:
        body = (r.text or '').strip().replace('\n', ' ')[:700]
        raise RuntimeError(f'Supabase Storage download failed (HTTP {r.status_code}): {body}')
    return r.content


def temporary_local_copy(uri: str, suffix: str = '') -> str:
    raw = download_uri(uri)
    fd, path = tempfile.mkstemp(prefix='cipher-evidence-', suffix=suffix)
    os.close(fd)
    Path(path).write_bytes(raw)
    return path
