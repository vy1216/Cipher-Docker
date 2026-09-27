"""CIPHER durable evidence worker for Render Background Worker."""
import os, time, datetime, traceback
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

from .db import get_db, init_database
from .evidence_pipeline import process_document

POLL_SECONDS = float(os.getenv('CIPHER_WORKER_POLL_SECONDS', '2'))
BATCH_SIZE = int(os.getenv('CIPHER_WORKER_BATCH_SIZE', '2'))


def claim_one():
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM documents WHERE processing_status='QUEUED' ORDER BY id LIMIT 1").fetchone()
        if not row:
            conn.close(); return None
        conn.execute("UPDATE documents SET processing_status='PROCESSING' WHERE id=? AND processing_status='QUEUED'", (row['id'],))
        conn.commit()
        # Re-read the row after claim for adapters returning different cursor snapshots.
        fresh = conn.execute("SELECT * FROM documents WHERE id=?", (row['id'],)).fetchone()
        return dict(fresh) if fresh else None
    finally:
        conn.close()


def process_one(doc):
    case_id = int(doc['case_id'])
    actor = {'id': doc.get('uploaded_by') or 0, 'full_name': 'CIPHER Worker'}
    try:
        process_document(case_id, int(doc['id']), actor)
    except Exception as exc:
        conn = get_db()
        try:
            conn.execute("UPDATE documents SET processing_status='FAILED' WHERE id=?", (doc['id'],))
            conn.execute("INSERT INTO audit_log (case_id,action,target_type,target_id,actor,details,status) VALUES (?,?,?,?,?,?,?)",
                         (case_id, 'EVIDENCE_PROCESSING_FAILED', 'document', str(doc['id']), 'CIPHER Worker', str(exc)[:2000], 'FAILED'))
            conn.commit()
        finally:
            conn.close()
        print(f'[worker] document {doc["id"]} failed: {exc}', flush=True)
        traceback.print_exc()


def main():
    init_database()
    print('[worker] CIPHER evidence worker started', flush=True)
    while True:
        did_work = False
        for _ in range(BATCH_SIZE):
            doc = claim_one()
            if not doc: break
            did_work = True
            print(f'[worker] processing evidence {doc["id"]} / case {doc["case_id"]}', flush=True)
            process_one(doc)
        if not did_work:
            time.sleep(POLL_SECONDS)


if __name__ == '__main__':
    main()
