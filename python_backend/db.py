import os, sqlite3, json, re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
def _resolve_path(value: str, default: Path) -> str:
    raw = (value or '').strip()
    path = Path(raw) if raw else default
    if not path.is_absolute():
        path = BASE_DIR / path
    return str(path.resolve())


DB_FILE = _resolve_path(os.getenv('CIPHER_DB_FILE'), BASE_DIR / 'cipher.db')
DATABASE_URL = os.getenv('DATABASE_URL','').strip()
SEED_DEMO_DATA = os.getenv('SEED_DEMO_DATA','false').lower() == 'true'

class PGCursor:
    def __init__(self, cursor): self._c=cursor; self.lastrowid=None
    @property
    def rowcount(self): return self._c.rowcount
    def _sql(self, sql):
        sql=re.sub(r"datetime\('now'\)", 'CURRENT_TIMESTAMP', sql, flags=re.I)
        sql=sql.replace('date(\'now\')','CURRENT_DATE')
        sql=re.sub(r'\bINSERT\s+OR\s+IGNORE\s+INTO\s+', 'INSERT INTO ', sql, flags=re.I)
        sql=re.sub(r'\bINSERT\s+OR\s+REPLACE\s+INTO\s+', 'INSERT INTO ', sql, flags=re.I)
        sql=sql.replace('?', '%s')
        return sql
    def execute(self, sql, params=None):
        sql2=self._sql(sql)
        up=sql2.lstrip().upper()
        if up.startswith('INSERT') and ' RETURNING ' not in up:
            # CIPHER inserts use identity PKs; RETURNING lets legacy lastrowid calls keep working.
            if re.match(r'INSERT\s+INTO\s+\w+\s*\(', up):
                sql2 = sql2.rstrip().rstrip(';') + ' RETURNING id'
        try:
            self._c.execute(sql2, params or ())
            if up.startswith('INSERT') and 'RETURNING ID' in sql2.upper():
                row=self._c.fetchone()
                if row is None:
                    self.lastrowid = None
                else:
                    try:
                        self.lastrowid = row["id"]
                    except (TypeError, KeyError):
                        self.lastrowid = row[0]
        except Exception:
            raise
        return self
    def executemany(self, sql, seq): self._c.executemany(self._sql(sql), seq); return self
    def fetchone(self): return self._c.fetchone()
    def fetchall(self): return self._c.fetchall()
    def __iter__(self): return iter(self._c)
    def close(self): self._c.close()

class PGConnection:
    is_postgres=True
    def __init__(self, conn): self._conn=conn
    def execute(self, sql, params=None):
        cur=self._conn.cursor()
        return PGCursor(cur).execute(sql, params)
    def executemany(self, sql, seq):
        cur=self._conn.cursor(); return PGCursor(cur).executemany(sql, seq)
    def commit(self): self._conn.commit()
    def rollback(self): self._conn.rollback()
    def close(self): self._conn.close()
    def cursor(self): return PGCursor(self._conn.cursor())


def get_db():
    if DATABASE_URL:
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
        except ImportError as e:
            raise RuntimeError('DATABASE_URL is set but psycopg2-binary is not installed. Run: pip install -r requirements.txt') from e
        conn=psycopg2.connect(DATABASE_URL, sslmode='require')
        # Keep dict-like row access used throughout the existing backend.
        # Wrap connection cursors so the existing backend receives dict-like rows.
        class Wrapped(PGConnection):
            def cursor(self_inner):
                return PGCursor(conn.cursor(cursor_factory=RealDictCursor))
            def execute(self_inner, sql, params=None):
                return self_inner.cursor().execute(sql, params)
            def executemany(self_inner, sql, seq):
                c=self_inner.cursor(); return c.executemany(sql, seq)
        return Wrapped(conn)
    conn=sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory=sqlite3.Row
    return conn

SQLITE_SCHEMA = '''
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'INVESTIGATOR', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS cases (id INTEGER PRIMARY KEY AUTOINCREMENT, case_number TEXT UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'OPEN', priority TEXT NOT NULL DEFAULT 'MEDIUM', created_by INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), case_type TEXT, incident_date TEXT, incident_end TEXT, primary_location TEXT, assigned_officer TEXT, jurisdiction TEXT, tags TEXT, external_id TEXT);
CREATE TABLE IF NOT EXISTS documents (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL, filename TEXT NOT NULL, file_type TEXT NOT NULL, file_path TEXT NOT NULL, processing_status TEXT NOT NULL DEFAULT 'UPLOADED', uploaded_by INTEGER NOT NULL, uploaded_at TEXT DEFAULT (datetime('now')), external_id TEXT, sha256 TEXT, source_type TEXT, description TEXT, processed_at TEXT);
CREATE TABLE IF NOT EXISTS location_nodes (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL, name TEXT NOT NULL, location_type TEXT NOT NULL DEFAULT 'CRIME_SCENE', latitude REAL NOT NULL, longitude REAL NOT NULL, address TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS spatial_events (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL, entity_name TEXT NOT NULL, entity_type TEXT NOT NULL DEFAULT 'PERSON', location_id INTEGER NOT NULL, timestamp TEXT NOT NULL, confidence_score REAL NOT NULL DEFAULT 1.0, source_document TEXT);
CREATE TABLE IF NOT EXISTS review_items (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'entity', suggestion_type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, entity_id INTEGER, relationship_id INTEGER, location_id INTEGER, event_id INTEGER, evidence_id INTEGER, source_document TEXT, source_reference TEXT, extracted_context TEXT, ai_output TEXT, confidence_score REAL NOT NULL DEFAULT 0.85, confidence REAL DEFAULT 0.85, reason TEXT, status TEXT NOT NULL DEFAULT 'PENDING', priority TEXT DEFAULT 'MEDIUM', reviewed_at TEXT, reviewed_by TEXT, review_note TEXT, created_at TEXT DEFAULT (datetime('now')), external_id TEXT, source_type TEXT);
CREATE TABLE IF NOT EXISTS review_actions (id INTEGER PRIMARY KEY AUTOINCREMENT, review_item_id INTEGER NOT NULL, case_id INTEGER NOT NULL, action TEXT NOT NULL, old_value_json TEXT, new_value_json TEXT, reason TEXT, reviewer_id TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS ai_conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL, user_id INTEGER, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS ai_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, role TEXT NOT NULL, message TEXT NOT NULL, answer_type TEXT, payload_json TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS ai_tool_calls (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, tool_name TEXT NOT NULL, input_json TEXT, output_json TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS ai_suggestions (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL, type TEXT NOT NULL, payload_json TEXT NOT NULL, confidence REAL DEFAULT 0.85, source_evidence_id TEXT, status TEXT DEFAULT 'PENDING', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS chain_of_custody_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL, document_id INTEGER, action TEXT NOT NULL, sha256_hash TEXT NOT NULL, actor_name TEXT NOT NULL, timestamp TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS entities (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL, entity_type TEXT NOT NULL, label TEXT NOT NULL, aliases TEXT, source_document_id INTEGER, extraction_method TEXT DEFAULT 'AI_EXTRACTION', confidence_score REAL DEFAULT 0.95, verification_status TEXT DEFAULT 'verified', latitude REAL, longitude REAL, created_at TEXT DEFAULT (datetime('now')), external_id TEXT, source_type TEXT, status_reason TEXT, source_reference TEXT, evidence_id_text TEXT);
CREATE TABLE IF NOT EXISTS relationships (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL, source_entity_id INTEGER NOT NULL, target_entity_id INTEGER NOT NULL, relationship_type TEXT NOT NULL, evidence_sentence TEXT, source_document_id INTEGER, confidence_score REAL DEFAULT 0.90, verification_status TEXT DEFAULT 'verified', created_at TEXT DEFAULT (datetime('now')), external_id TEXT, source_reference TEXT, source_external_id TEXT, target_external_id TEXT, source_type TEXT);
CREATE TABLE IF NOT EXISTS locations (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL, entity_id INTEGER, label TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, location_type TEXT DEFAULT 'sighting', address_text TEXT, source_document_id INTEGER, verification_status TEXT DEFAULT 'verified', event_timestamp TEXT DEFAULT (datetime('now')), created_at TEXT DEFAULT (datetime('now')), external_id TEXT, accuracy_m REAL, primary_evidence_id INTEGER, source_id TEXT, observed_at TEXT, source_reference TEXT);
CREATE TABLE IF NOT EXISTS review_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id INTEGER NOT NULL, item_type TEXT NOT NULL, item_id INTEGER NOT NULL, confidence_score REAL DEFAULT 0.85, status TEXT DEFAULT 'PENDING', reviewed_by INTEGER, reviewed_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS timeline_events (id INTEGER PRIMARY KEY AUTOINCREMENT, external_id TEXT, case_id INTEGER NOT NULL, event_type TEXT NOT NULL, event_time TEXT, description TEXT, entity_id INTEGER, location_id INTEGER, evidence_id INTEGER, confidence_score REAL DEFAULT 1.0, verification_status TEXT DEFAULT 'pending', source_reference TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, external_id TEXT, case_id INTEGER, action TEXT NOT NULL, target_type TEXT, target_id TEXT, actor TEXT, timestamp TEXT DEFAULT (datetime('now')), details TEXT, status TEXT);
CREATE TABLE IF NOT EXISTS ai_test_issues (id INTEGER PRIMARY KEY AUTOINCREMENT, issue_id TEXT, case_id INTEGER, issue_type TEXT, description TEXT, related_entity_id TEXT, related_evidence_id TEXT, status TEXT, details TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS test_cases (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id TEXT, case_id INTEGER, test_area TEXT, test_action TEXT, expected_result TEXT, status TEXT DEFAULT 'NOT_RUN', created_at TEXT DEFAULT (datetime('now')));
'''

PG_SCHEMA = '''
CREATE TABLE IF NOT EXISTS users (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'INVESTIGATOR', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS cases (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, case_number TEXT UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'OPEN', priority TEXT NOT NULL DEFAULT 'MEDIUM', created_by BIGINT NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, case_type TEXT, incident_date TEXT, incident_end TEXT, primary_location TEXT, assigned_officer TEXT, jurisdiction TEXT, tags TEXT, external_id TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS documents (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, filename TEXT NOT NULL, file_type TEXT NOT NULL, file_path TEXT NOT NULL, processing_status TEXT NOT NULL DEFAULT 'UPLOADED', uploaded_by BIGINT NOT NULL REFERENCES users(id), uploaded_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, external_id TEXT, sha256 TEXT, source_type TEXT, description TEXT, processed_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS location_nodes (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, name TEXT NOT NULL, location_type TEXT NOT NULL DEFAULT 'CRIME_SCENE', latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL, address TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS spatial_events (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, entity_name TEXT NOT NULL, entity_type TEXT NOT NULL DEFAULT 'PERSON', location_id BIGINT NOT NULL, timestamp TIMESTAMPTZ NOT NULL, confidence_score DOUBLE PRECISION NOT NULL DEFAULT 1.0, source_document TEXT);
CREATE TABLE IF NOT EXISTS entities (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, entity_type TEXT NOT NULL, label TEXT NOT NULL, aliases TEXT, source_document_id BIGINT, extraction_method TEXT DEFAULT 'AI_EXTRACTION', confidence_score DOUBLE PRECISION DEFAULT 0.95, verification_status TEXT DEFAULT 'verified', latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, external_id TEXT, source_type TEXT, status_reason TEXT, source_reference TEXT, evidence_id_text TEXT);
CREATE TABLE IF NOT EXISTS relationships (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, source_entity_id BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE, target_entity_id BIGINT NOT NULL REFERENCES entities(id) ON DELETE CASCADE, relationship_type TEXT NOT NULL, evidence_sentence TEXT, source_document_id BIGINT, confidence_score DOUBLE PRECISION DEFAULT 0.90, verification_status TEXT DEFAULT 'verified', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, external_id TEXT, source_reference TEXT, source_external_id TEXT, target_external_id TEXT, source_type TEXT);
CREATE TABLE IF NOT EXISTS locations (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, entity_id BIGINT, label TEXT NOT NULL, latitude DOUBLE PRECISION NOT NULL, longitude DOUBLE PRECISION NOT NULL, location_type TEXT DEFAULT 'sighting', address_text TEXT, source_document_id BIGINT, verification_status TEXT DEFAULT 'verified', event_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, external_id TEXT, accuracy_m DOUBLE PRECISION, primary_evidence_id BIGINT, source_id TEXT, observed_at TEXT, source_reference TEXT);
CREATE TABLE IF NOT EXISTS review_items (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, type TEXT NOT NULL DEFAULT 'entity', suggestion_type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, entity_id BIGINT, relationship_id BIGINT, location_id BIGINT, event_id BIGINT, evidence_id BIGINT, source_document TEXT, source_reference TEXT, extracted_context TEXT, ai_output TEXT, confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0.85, confidence DOUBLE PRECISION DEFAULT 0.85, reason TEXT, status TEXT NOT NULL DEFAULT 'PENDING', priority TEXT DEFAULT 'MEDIUM', reviewed_at TIMESTAMPTZ, reviewed_by TEXT, review_note TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, external_id TEXT, source_type TEXT);
CREATE TABLE IF NOT EXISTS review_actions (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, review_item_id BIGINT NOT NULL, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, action TEXT NOT NULL, old_value_json TEXT, new_value_json TEXT, reason TEXT, reviewer_id TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS review_queue (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, item_type TEXT NOT NULL, item_id BIGINT NOT NULL, confidence_score DOUBLE PRECISION DEFAULT 0.85, status TEXT DEFAULT 'PENDING', reviewed_by BIGINT, reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ai_conversations (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, user_id BIGINT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ai_messages (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, conversation_id BIGINT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE, role TEXT NOT NULL, message TEXT NOT NULL, answer_type TEXT, payload_json TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ai_tool_calls (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, conversation_id BIGINT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE, tool_name TEXT NOT NULL, input_json TEXT, output_json TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS ai_suggestions (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, type TEXT NOT NULL, payload_json TEXT NOT NULL, confidence DOUBLE PRECISION DEFAULT 0.85, source_evidence_id TEXT, status TEXT DEFAULT 'PENDING', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS chain_of_custody_logs (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, document_id BIGINT, action TEXT NOT NULL, sha256_hash TEXT NOT NULL, actor_name TEXT NOT NULL, timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS timeline_events (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, external_id TEXT, case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE, event_type TEXT NOT NULL, event_time TIMESTAMPTZ, description TEXT, entity_id BIGINT, location_id BIGINT, evidence_id BIGINT, confidence_score DOUBLE PRECISION DEFAULT 1.0, verification_status TEXT DEFAULT 'pending', source_reference TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_log (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, external_id TEXT, case_id BIGINT, action TEXT NOT NULL, target_type TEXT, target_id TEXT, actor TEXT, timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, details TEXT, status TEXT);
CREATE TABLE IF NOT EXISTS ai_test_issues (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, issue_id TEXT, case_id BIGINT, issue_type TEXT, description TEXT, related_entity_id TEXT, related_evidence_id TEXT, status TEXT, details TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS test_cases (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, test_id TEXT, case_id BIGINT, test_area TEXT, test_action TEXT, expected_result TEXT, status TEXT DEFAULT 'NOT_RUN', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_review_items_case_status ON review_items(case_id,status);
CREATE INDEX IF NOT EXISTS idx_review_actions_review_item ON review_actions(review_item_id,case_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_case_status ON ai_suggestions(case_id,status);
CREATE INDEX IF NOT EXISTS idx_entities_case_external ON entities(case_id,external_id);
CREATE INDEX IF NOT EXISTS idx_relationships_case_external ON relationships(case_id,external_id);
CREATE INDEX IF NOT EXISTS idx_locations_case_external ON locations(case_id,external_id);
CREATE INDEX IF NOT EXISTS idx_timeline_case_time ON timeline_events(case_id,event_time);
CREATE INDEX IF NOT EXISTS idx_audit_case_time ON audit_log(case_id,timestamp);
'''


def _seed(conn):
    if not SEED_DEMO_DATA: return
    if conn.execute('SELECT COUNT(*) AS cnt FROM users').fetchone()['cnt']==0:
        h='pbkdf2_sha256$310000$Y2lwaGVyLWxvY2FsLXNlZWQtMTY$9p5BrOTjlv2PhSivmoemKFsO6Ue05DED_-cTTrwpb2E'
        conn.execute('INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,?)',('Insp. R. Sharma','investigator@cipher.local',h,'INVESTIGATOR')); conn.commit()
    if conn.execute('SELECT COUNT(*) AS cnt FROM cases').fetchone()['cnt']==0:
        conn.execute('INSERT INTO cases (id,case_number,title,description,status,priority,created_by) VALUES (1,?,?,?,?,?,?)',('CN-2026-0143','Falcon-77 Smuggling Ring','Cross-border contraband and illegal communication transit analysis','OPEN','HIGH',1))
        conn.commit()
        if DATABASE_URL:
            conn.execute("SELECT setval(pg_get_serial_sequence('cases','id'), GREATEST(COALESCE((SELECT MAX(id) FROM cases),1),1), true)")
            conn.commit()
    try:
        if conn.execute('SELECT COUNT(*) AS c FROM ai_suggestions WHERE case_id=1').fetchone()['c']==0:
            rows=[
              (1,'entity_resolution',json.dumps({'primary_entity':'Mohd. Rafiq @ Rafiq B...','candidate_entity':'Rafiq Bhai (Hawala Broker)','similarity':'93%','reason':'Matching phone number and overlapping evidence references.','action':'MERGE_CANDIDATE'}),.93,'CDR_0812.csv','PENDING'),
              (1,'entity_resolution',json.dumps({'primary_entity':'Vikram "Vicky" Malhotra','candidate_entity':'V. Malhotra (Vicky)','similarity':'89%','reason':'Co-occurring in accounting notes with matching bank conduit references.','action':'MERGE_CANDIDATE'}),.89,'Hawala_Ledger_Extract.csv','PENDING'),
              (1,'evidence_conflict',json.dumps({'entity':'Burner MSISDN +91 9876...','status':'Requires investigator review. No automatic conclusion made.'}),.88,'CDR_0812.csv','PENDING'),
              (1,'pattern_flag',json.dumps({'entity':'Mohd. Rafiq','pattern':'Bridge Connector','description':'Structural observation, not an accusation.'}),.95,'Graph_Topology_Analysis','PENDING')]
            conn.executemany('INSERT INTO ai_suggestions (case_id,type,payload_json,confidence,source_evidence_id,status) VALUES (?,?,?,?,?,?)',rows); conn.commit()
    except Exception: pass



# PostgreSQL schema reconciliation for projects upgraded across older CIPHER ZIPs.
# CREATE TABLE IF NOT EXISTS does not add columns to an already-existing Supabase table,
# so every startup performs a safe additive reconciliation before the API starts.
POSTGRES_COLUMN_PATCHES = {
    "users": {
        "full_name": "TEXT",
        "email": "TEXT",
        "password_hash": "TEXT",
        "role": "TEXT DEFAULT 'INVESTIGATOR'",
        "created_at": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
    },
    "cases": {
        "case_number": "TEXT",
        "title": "TEXT",
        "description": "TEXT",
        "status": "TEXT DEFAULT 'OPEN'",
        "priority": "TEXT DEFAULT 'MEDIUM'",
        "created_by": "BIGINT",
        "created_at": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
        "updated_at": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
        "case_type": "TEXT",
        "incident_date": "TEXT",
        "incident_end": "TEXT",
        "primary_location": "TEXT",
        "assigned_officer": "TEXT",
        "jurisdiction": "TEXT",
        "tags": "TEXT",
        "external_id": "TEXT",
    },
    "documents": {
        "case_id": "BIGINT",
        "filename": "TEXT",
        "file_type": "TEXT",
        "file_path": "TEXT",
        "processing_status": "TEXT DEFAULT 'UPLOADED'",
        "uploaded_by": "BIGINT",
        "uploaded_at": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
        "external_id": "TEXT",
        "sha256": "TEXT",
        "source_type": "TEXT",
        "description": "TEXT",
        "processed_at": "TIMESTAMPTZ",
    },
    "location_nodes": {
        "case_id": "BIGINT",
        "name": "TEXT",
        "location_type": "TEXT DEFAULT 'CRIME_SCENE'",
        "latitude": "DOUBLE PRECISION",
        "longitude": "DOUBLE PRECISION",
        "address": "TEXT",
        "created_at": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
    },
    "spatial_events": {
        "case_id": "BIGINT",
        "entity_name": "TEXT",
        "entity_type": "TEXT DEFAULT 'PERSON'",
        "location_id": "BIGINT",
        "timestamp": "TIMESTAMPTZ",
        "confidence_score": "DOUBLE PRECISION DEFAULT 1.0",
        "source_document": "TEXT",
    },
    "entities": {
        "case_id": "BIGINT",
        "entity_type": "TEXT",
        "label": "TEXT",
        "aliases": "TEXT",
        "source_document_id": "BIGINT",
        "extraction_method": "TEXT DEFAULT 'AI_EXTRACTION'",
        "confidence_score": "DOUBLE PRECISION DEFAULT 0.95",
        "verification_status": "TEXT DEFAULT 'verified'",
        "latitude": "DOUBLE PRECISION",
        "longitude": "DOUBLE PRECISION",
        "created_at": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
        "external_id": "TEXT",
        "source_type": "TEXT",
        "status_reason": "TEXT",
        "source_reference": "TEXT",
        "evidence_id_text": "TEXT",
    },
    "relationships": {
        "case_id": "BIGINT",
        "source_entity_id": "BIGINT",
        "target_entity_id": "BIGINT",
        "relationship_type": "TEXT",
        "evidence_sentence": "TEXT",
        "source_document_id": "BIGINT",
        "confidence_score": "DOUBLE PRECISION DEFAULT 0.90",
        "verification_status": "TEXT DEFAULT 'verified'",
        "created_at": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
        "external_id": "TEXT",
        "source_reference": "TEXT",
        "source_external_id": "TEXT",
        "target_external_id": "TEXT",
        "source_type": "TEXT",
    },
    "locations": {
        "case_id": "BIGINT",
        "entity_id": "BIGINT",
        "label": "TEXT",
        "latitude": "DOUBLE PRECISION",
        "longitude": "DOUBLE PRECISION",
        "location_type": "TEXT DEFAULT 'sighting'",
        "address_text": "TEXT",
        "source_document_id": "BIGINT",
        "verification_status": "TEXT DEFAULT 'verified'",
        "event_timestamp": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
        "created_at": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
        "external_id": "TEXT",
        "accuracy_m": "DOUBLE PRECISION",
        "primary_evidence_id": "BIGINT",
        "source_id": "TEXT",
        "observed_at": "TEXT",
        "source_reference": "TEXT",
    },
    "review_items": {
        "case_id": "BIGINT", "type": "TEXT DEFAULT 'entity'", "suggestion_type": "TEXT", "title": "TEXT", "description": "TEXT",
        "entity_id": "BIGINT", "relationship_id": "BIGINT", "location_id": "BIGINT", "event_id": "BIGINT", "evidence_id": "BIGINT",
        "source_document": "TEXT", "source_reference": "TEXT", "extracted_context": "TEXT", "ai_output": "TEXT",
        "confidence_score": "DOUBLE PRECISION DEFAULT 0.85", "confidence": "DOUBLE PRECISION DEFAULT 0.85", "reason": "TEXT",
        "status": "TEXT DEFAULT 'PENDING'", "priority": "TEXT DEFAULT 'MEDIUM'", "reviewed_at": "TIMESTAMPTZ",
        "reviewed_by": "TEXT", "review_note": "TEXT", "created_at": "TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP", "external_id": "TEXT", "source_type": "TEXT",
    },
    "review_actions": {"review_item_id":"BIGINT","case_id":"BIGINT","action":"TEXT","old_value_json":"TEXT","new_value_json":"TEXT","reason":"TEXT","reviewer_id":"TEXT","created_at":"TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"},
    "review_queue": {"case_id":"BIGINT","item_type":"TEXT","item_id":"BIGINT","confidence_score":"DOUBLE PRECISION DEFAULT 0.85","status":"TEXT DEFAULT 'PENDING'","reviewed_by":"BIGINT","reviewed_at":"TIMESTAMPTZ","created_at":"TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"},
    "ai_conversations": {"case_id":"BIGINT","user_id":"BIGINT","created_at":"TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP","updated_at":"TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"},
    "ai_messages": {"conversation_id":"BIGINT","role":"TEXT","message":"TEXT","answer_type":"TEXT","payload_json":"TEXT","created_at":"TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"},
    "ai_tool_calls": {"conversation_id":"BIGINT","tool_name":"TEXT","input_json":"TEXT","output_json":"TEXT","created_at":"TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"},
    "ai_suggestions": {"case_id":"BIGINT","type":"TEXT","payload_json":"TEXT","confidence":"DOUBLE PRECISION DEFAULT 0.85","source_evidence_id":"TEXT","status":"TEXT DEFAULT 'PENDING'","created_at":"TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"},
    "chain_of_custody_logs": {"case_id":"BIGINT","document_id":"BIGINT","action":"TEXT","sha256_hash":"TEXT","actor_name":"TEXT","timestamp":"TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"},
    "timeline_events": {"external_id":"TEXT","case_id":"BIGINT","event_type":"TEXT","event_time":"TIMESTAMPTZ","description":"TEXT","entity_id":"BIGINT","location_id":"BIGINT","evidence_id":"BIGINT","confidence_score":"DOUBLE PRECISION DEFAULT 1.0","verification_status":"TEXT DEFAULT 'pending'","source_reference":"TEXT","created_at":"TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"},
    "audit_log": {"external_id":"TEXT","case_id":"BIGINT","action":"TEXT","target_type":"TEXT","target_id":"TEXT","actor":"TEXT","timestamp":"TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP","details":"TEXT","status":"TEXT"},
    "ai_test_issues": {"issue_id":"TEXT","case_id":"BIGINT","issue_type":"TEXT","description":"TEXT","related_entity_id":"TEXT","related_evidence_id":"TEXT","status":"TEXT","details":"TEXT","created_at":"TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"},
    "test_cases": {"test_id":"TEXT","case_id":"BIGINT","test_area":"TEXT","test_action":"TEXT","expected_result":"TEXT","status":"TEXT DEFAULT 'NOT_RUN'","created_at":"TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP"},
}


def _postgres_schema_repair(conn):
    """Create missing tables/columns and resynchronise identity sequences.

    This is deliberately additive: it never deletes data and fixes the common
    situation where an older CIPHER migration already created the table with a
    smaller column set.
    """
    # Re-run the canonical schema first so missing tables/indexes are created.
    for stmt in PG_SCHEMA.split(';'):
        stmt = stmt.strip()
        if stmt:
            conn.execute(stmt)

    for table, columns in POSTGRES_COLUMN_PATCHES.items():
        existing_rows = conn.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=?",
            (table,),
        ).fetchall()
        existing = {str(r['column_name']).lower() for r in existing_rows}
        for column, ddl in columns.items():
            if column.lower() not in existing:
                conn.execute(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {ddl}')

    # Keep identity/serial sequences ahead of manually imported IDs.
    for table in ('users','cases','documents','location_nodes','spatial_events','review_items','review_actions','ai_conversations','ai_messages','ai_tool_calls','ai_suggestions','chain_of_custody_logs','entities','relationships','locations','review_queue','timeline_events','audit_log','ai_test_issues','test_cases'):
        try:
            seq_row = conn.execute("SELECT pg_get_serial_sequence(?, 'id') AS seq", (table,)).fetchone()
            seq = seq_row['seq'] if seq_row else None
            if seq:
                conn.execute(f"SELECT setval(%s, COALESCE((SELECT MAX(id) FROM \"{table}\"), 1), EXISTS (SELECT 1 FROM \"{table}\"))", (seq,))
        except Exception:
            # Not every installation uses a serial sequence; identity columns are
            # already safe, so sequence reconciliation is best-effort.
            pass


def validate_postgres_schema(conn):
    required = list(POSTGRES_COLUMN_PATCHES.keys())
    missing = []
    for table in required:
        ok = conn.execute("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=?", (table,)).fetchone()
        if not ok:
            missing.append(table)
    return missing

def init_database():
    if DATABASE_URL:
        conn=get_db()
        try:
            _postgres_schema_repair(conn)
            conn.commit()
            _seed(conn)
            conn.commit()
        finally:
            conn.close()
        return
    conn=get_db()
    for stmt in SQLITE_SCHEMA.split(';'):
        stmt=stmt.strip()
        if stmt: conn.execute(stmt)
    conn.commit(); _seed(conn)
    conn.close()
