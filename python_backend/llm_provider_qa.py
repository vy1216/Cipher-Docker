"""Offline contract tests for CIPHER's automatic Gemini -> OpenRouter -> Ollama LLM fallback."""
from __future__ import annotations
import json, os, socket, threading, tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP_DB = tempfile.mktemp(suffix='.db')
os.environ['CIPHER_DB_FILE'] = TMP_DB
os.environ['DATABASE_URL'] = ''
os.environ['SEED_DEMO_DATA'] = 'false'
os.environ['CIPHER_USE_BACKGROUND_TASKS'] = 'false'
os.environ['NEO4J_REQUIRED_FOR_GRAPH'] = 'false'
os.environ['LLM_PROVIDER'] = 'auto'
os.environ['LLM_FALLBACK_ORDER'] = 'gemini,openrouter,ollama'
os.environ['GEMINI_API_KEY'] = 'qa-gemini-key'
os.environ['OPENROUTER_API_KEY'] = 'qa-openrouter-key'
os.environ['OLLAMA_ENABLED'] = 'true'

state = {'gemini_ok': True, 'openrouter_ok': True, 'ollama_ok': True, 'hits': []}

def payload_for(provider, question):
    return {
        'answer': f'{provider} answer for {question}',
        'evidence': [{'source': 'qa.csv', 'page': 1}],
        'inferences': [],
        'uncertainties': [],
        'sources': [{'source_reference': 'qa.csv#page=1#chunk=0'}],
    }

class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        raw = json.dumps(body).encode(); self.send_response(code)
        self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); self.wfile.write(raw)
    def do_POST(self):
        n=int(self.headers.get('content-length','0')); body=json.loads(self.rfile.read(n) or '{}')
        if 'generateContent' in self.path:
            state['hits'].append('gemini')
            if not state['gemini_ok']: return self._send(503, {'error': 'mock gemini down'})
            p=payload_for('gemini','qa'); text=json.dumps(p)
            return self._send(200, {'candidates':[{'content':{'parts':[{'text':text}]}}]})
        if self.path.endswith('/chat/completions'):
            state['hits'].append('openrouter')
            if not state['openrouter_ok']: return self._send(503, {'error': 'mock openrouter down'})
            p=payload_for('openrouter','qa'); return self._send(200, {'model':'openrouter/free','choices':[{'message':{'content':json.dumps(p)}}]})
        if self.path.endswith('/api/chat'):
            state['hits'].append('ollama')
            if not state['ollama_ok']: return self._send(503, {'error': 'mock ollama down'})
            p=payload_for('ollama','qa'); return self._send(200, {'model':'qwen3:8b','message':{'content':json.dumps(p)},'done':True})
        self._send(404, {'error':'unknown'})
    def do_GET(self):
        if self.path.endswith('/api/tags'):
            self._send(200, {'models':[{'name':'qwen3:8b'}]}); return
        self._send(404, {'error':'unknown'})
    def log_message(self,*args): pass

s=HTTPServer(('127.0.0.1',0),Handler); threading.Thread(target=s.serve_forever,daemon=True).start(); port=s.server_port
os.environ['GEMINI_API_KEY']='qa-gemini-key'; os.environ['GEMINI_BASE_URL']=f'http://127.0.0.1:{port}'; os.environ['GEMINI_MODEL']='mock-model'; os.environ['GEMINI_MODEL_FALLBACKS']=''
os.environ['GEMINI_TIMEOUT']='3'; os.environ['OPENROUTER_API_KEY']='qa-openrouter-key'; os.environ['OPENROUTER_BASE_URL']=f'http://127.0.0.1:{port}/openrouter'; os.environ['OPENROUTER_MODEL']='openrouter/free'; os.environ['OPENROUTER_TIMEOUT']='3'; os.environ['OLLAMA_BASE_URL']=f'http://127.0.0.1:{port}'; os.environ['OLLAMA_TIMEOUT']='3'

from python_backend.db import get_db, init_database
from python_backend.schema_extensions import init_extensions
init_database(); init_extensions()
from python_backend.investigation_engine import answer

conn=get_db(); cur=conn.execute("INSERT INTO cases(case_number,title,status,priority,created_by) VALUES (?,?,?,?,?)",('LLM-QA','LLM Provider QA','OPEN','HIGH',1)); case_id=cur.lastrowid; conn.commit(); conn.close()

results=[]
def run(name, expected, g, o, l):
    state.update(gemini_ok=g, openrouter_ok=o, ollama_ok=l, hits=[])
    out,_=answer(case_id,'qa')
    ok=out.get('provider')==expected
    results.append({'test':name,'status':'PASS' if ok else 'FAIL','provider':out.get('provider'),'attempts':out.get('llm_status',{}).get('attempts'), 'hits':list(state['hits'])})

run('Gemini primary', 'gemini', True, True, True)
run('Gemini -> OpenRouter fallback', 'openrouter', False, True, True)
run('Gemini + OpenRouter -> Ollama fallback', 'ollama', False, False, True)
run('All providers unavailable', 'llm-unavailable', False, False, False)

s.shutdown()
try: os.remove(TMP_DB)
except OSError: pass
failed=[x for x in results if x['status']!='PASS']
print(json.dumps({'status':'PASS' if not failed else 'FAIL','results':results},indent=2))
raise SystemExit(0 if not failed else 1)
