"""Rebuild CIPHER's case-isolated RAG indexes for all existing evidence."""
from __future__ import annotations
import json
from .db import get_db, init_database
from .schema_extensions import init_extensions
from .rag_engine import reindex_case, rag_health

def main():
    # This script is intentionally runnable before FastAPI starts (the one-click
    # launcher calls it first).  Therefore it must perform the same additive
    # database/schema initialization that main.py performs at import time.
    init_database()
    init_extensions()
    conn=get_db()
    cases=[dict(r) for r in conn.execute('SELECT id,case_number FROM cases ORDER BY id').fetchall()]
    conn.close()
    report=[]
    for case in cases:
        result=reindex_case(int(case['id']))
        report.append({'case_id':case['id'],'case_number':case.get('case_number'),'results':result,'health':rag_health(int(case['id']))})
    print(json.dumps({'status':'PASS','cases':report},indent=2,default=str))
    if any(any(str(x.get('status','READY')).upper()=='FAILED' for x in r['results']) for r in report):
        raise SystemExit(2)

if __name__=='__main__': main()
