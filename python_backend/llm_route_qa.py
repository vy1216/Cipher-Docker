"""API-level QA for /api/cases/{case_id}/ai/query using mocked provider chain."""
from __future__ import annotations
import os, json, threading, tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
os.environ['CIPHER_DB_FILE']=tempfile.mktemp(suffix='.db'); os.environ['DATABASE_URL']=''; os.environ['SEED_DEMO_DATA']='false'; os.environ['CIPHER_USE_BACKGROUND_TASKS']='false'; os.environ['NEO4J_REQUIRED_FOR_GRAPH']='false'
state={'gemini':True,'openrouter':True,'ollama':True}
class H(BaseHTTPRequestHandler):
    def _s(self,c,b):
        r=json.dumps(b).encode(); self.send_response(c); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(r))); self.end_headers(); self.wfile.write(r)
    def do_POST(self):
        if 'generateContent' in self.path:
            if not state['gemini']: return self._s(503,{'error':'down'})
            p={'answer':'Gemini route answer','evidence':[],'inferences':[],'uncertainties':[],'sources':[]}
            return self._s(200,{'candidates':[{'content':{'parts':[{'text':json.dumps(p)}]}}]})
        if self.path.endswith('/chat/completions'):
            if not state['openrouter']: return self._s(503,{'error':'down'})
            p={'answer':'OpenRouter route answer','evidence':[],'inferences':[],'uncertainties':[],'sources':[]}
            return self._s(200,{'model':'openrouter/free','choices':[{'message':{'content':json.dumps(p)}}]})
        if self.path.endswith('/api/chat'):
            if not state['ollama']: return self._s(503,{'error':'down'})
            p={'answer':'Ollama route answer','evidence':[],'inferences':[],'uncertainties':[],'sources':[]}
            return self._s(200,{'model':'qwen3:8b','message':{'content':json.dumps(p)}})
        return self._s(404,{})
    def do_GET(self): self._s(200,{'models':[{'name':'qwen3:8b'}]})
    def log_message(self,*a): pass
srv=HTTPServer(('127.0.0.1',0),H); threading.Thread(target=srv.serve_forever,daemon=True).start(); port=srv.server_port
os.environ.update({'LLM_PROVIDER':'auto','LLM_FALLBACK_ORDER':'gemini,openrouter,ollama','GEMINI_ENABLED':'true','GEMINI_API_KEY':'qa','GEMINI_BASE_URL':f'http://127.0.0.1:{port}','GEMINI_MODEL':'mock','OPENROUTER_ENABLED':'true','OPENROUTER_API_KEY':'qa','OPENROUTER_BASE_URL':f'http://127.0.0.1:{port}','OPENROUTER_MODEL':'openrouter/free','OLLAMA_ENABLED':'true','OLLAMA_BASE_URL':f'http://127.0.0.1:{port}','OLLAMA_MODEL':'qwen3:8b'})
from python_backend.db import get_db, init_database
from python_backend.schema_extensions import init_extensions
init_database(); init_extensions()
c=get_db(); c.execute("INSERT INTO users(full_name,email,password_hash,role) VALUES (?,?,?,?)",('QA','route@test','x','INVESTIGATOR')); uid=c.execute("SELECT id FROM users WHERE email='route@test'").fetchone()['id']; c.execute("INSERT INTO cases(case_number,title,status,priority,created_by) VALUES (?,?,?,?,?)",('ROUTE-QA','Route QA','OPEN','HIGH',uid)); cid=c.execute("SELECT id FROM cases WHERE case_number='ROUTE-QA'").fetchone()['id']; c.commit(); c.close()
from python_backend.main import app, create_access_token
from fastapi.testclient import TestClient
client=TestClient(app); headers={'Authorization':'Bearer '+create_access_token({'sub':str(uid)})}
checks=[]
for name, expected, flags in [('Gemini route','gemini',(1,1,1)),('OpenRouter fallback','openrouter',(0,1,1)),('Ollama fallback','ollama',(0,0,1))]:
    state['gemini'],state['openrouter'],state['ollama']=map(bool,flags)
    r=client.post(f'/api/cases/{cid}/ai/query',headers=headers,json={'query':'QA provider test'})
    body=r.json(); ok=r.status_code==200 and body.get('provider')==expected
    checks.append((name,ok,body.get('provider'),body.get('llm_status')))
# all down
state['gemini']=state['openrouter']=state['ollama']=False
r=client.post(f'/api/cases/{cid}/ai/query',headers=headers,json={'query':'QA unavailable test'}); body=r.json(); checks.append(('Unavailable route',r.status_code==200 and body.get('provider')=='llm-unavailable',body.get('provider'),body.get('llm_status')))
srv.shutdown(); print(json.dumps({'status':'PASS' if all(x[1] for x in checks) else 'FAIL','checks':[{'name':x[0],'pass':x[1],'provider':x[2],'llm_status':x[3]} for x in checks]},indent=2)); raise SystemExit(0 if all(x[1] for x in checks) else 1)
