"""Offline regression checks for the PostgreSQL compatibility adapter.
No external database or credentials are required.
"""
from python_backend.db import PGCursor

class FakeCursor:
    def __init__(self, row):
        self.row = row
        self.executed = None
        self.params = None
    def execute(self, sql, params):
        self.executed = sql
        self.params = params
    def fetchone(self):
        return self.row
    def executemany(self, sql, seq):
        self.executed = sql
        self.params = list(seq)

# RealDictCursor-like row
f = FakeCursor({"id": 42})
p = PGCursor(f)
p.execute("INSERT INTO cases (case_number, title) VALUES (?, ?)", ("C-TEST", "Test Case"))
assert p.lastrowid == 42
assert "%s" in f.executed and "?" not in f.executed

# Tuple-like row fallback
f2 = FakeCursor((99,))
p2 = PGCursor(f2)
p2.execute("INSERT INTO cases (case_number, title) VALUES (?, ?)", ("C-TEST2", "Test Case 2"))
assert p2.lastrowid == 99
assert "RETURNING ID" in f2.executed.upper()

print("POSTGRES COMPATIBILITY REGRESSION TEST: PASS")
