"""Conservative case-scoped entity resolution. It proposes merges; it never merges automatically."""
from __future__ import annotations
import json,re
from difflib import SequenceMatcher
from .db import get_db


def _norm(v): return re.sub(r'[^a-z0-9]+',' ',str(v or '').lower()).strip()
def _phone(v): return re.sub(r'\D','',str(v or ''))

def _similar(a,b,etype):
    if etype=='phone':
        pa,pb=_phone(a),_phone(b); return 1.0 if pa and pb and pa==pb else 0.0
    na,nb=_norm(a),_norm(b)
    if not na or not nb: return 0.0
    if na==nb: return 1.0
    return SequenceMatcher(None,na,nb).ratio()

def resolve_case(case_id:int, threshold:float=0.90):
    conn=get_db()
    rows=[dict(r) for r in conn.execute("SELECT id,label,entity_type,verification_status,source_document_id FROM entities WHERE case_id=? ORDER BY id",(case_id,)).fetchall()]
    created=[]
    try:
        for i,a in enumerate(rows):
            if str(a.get('verification_status','')).lower()=='rejected': continue
            for b in rows[i+1:]:
                if a['id']==b['id'] or a['entity_type']!=b['entity_type']: continue
                score=_similar(a['label'],b['label'],a['entity_type'])
                if score < threshold or _norm(a['label'])==_norm(b['label']): continue
                title=f"Possible duplicate: {a['label']} / {b['label']}"
                exists=conn.execute("SELECT id FROM review_items WHERE case_id=? AND suggestion_type='ENTITY_RESOLUTION' AND title=? AND status='PENDING'",(case_id,title)).fetchone()
                if exists: continue
                cur=conn.execute("""INSERT INTO review_items(case_id,type,suggestion_type,title,description,entity_id,source_document,source_reference,extracted_context,ai_output,confidence_score,confidence,status,priority,source_type)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",(case_id,'entity','ENTITY_RESOLUTION',title,"Two case-scoped entities have a high similarity and require investigator confirmation before merge.",a['id'],str(a.get('source_document_id') or ''),'entity-resolution',f"{a['label']} ↔ {b['label']}",json.dumps({'entity_a':a,'entity_b':b,'similarity':score}),score,score,'PENDING','MEDIUM','ENTITY_RESOLUTION'))
                # relationship_id is not a valid second entity slot in this schema; store candidate B in payload.
                created.append(cur.lastrowid)
        conn.commit()
    finally: conn.close()
    return {'case_id':case_id,'proposals_created':len(created),'review_ids':created}
