"""Neo4j graph projection for CIPHER.

PostgreSQL/SQLite remains the relational source of truth for cases, evidence,
review, audit, and timeline records. Neo4j is the graph datastore for VERIFIED
entities and relationships. The graph is rebuilt idempotently per case from the
verified relational records so review decisions cannot leave stale graph data.
"""
from __future__ import annotations

import os

# Neo4j Aura commonly relies on the Python trust store. certifi gives Windows
# environments a deterministic CA bundle and avoids SSL_CERT_FILE setup being
# required manually in every terminal.
try:
    import certifi
    os.environ.setdefault('SSL_CERT_FILE', certifi.where())
except Exception:
    pass

from typing import Any, Dict, List, Optional

_DRIVER = None


def configured() -> bool:
    return bool(os.getenv("NEO4J_URI", "").strip() and os.getenv("NEO4J_USERNAME", "").strip() and os.getenv("NEO4J_PASSWORD", "").strip())


def database_name() -> str:
    return os.getenv("NEO4J_DATABASE", "neo4j").strip() or "neo4j"


def _driver():
    global _DRIVER
    if _DRIVER is not None:
        return _DRIVER
    if not configured():
        return None
    from neo4j import GraphDatabase
    _DRIVER = GraphDatabase.driver(
        os.environ["NEO4J_URI"].strip(),
        auth=(os.environ["NEO4J_USERNAME"].strip(), os.environ["NEO4J_PASSWORD"]),
    )
    return _DRIVER


def close():
    global _DRIVER
    if _DRIVER is not None:
        _DRIVER.close()
        _DRIVER = None


def verify_connectivity() -> Dict[str, Any]:
    if not configured():
        return {"configured": False, "status": "not_configured"}
    try:
        driver = _driver()
        driver.verify_connectivity()
        with driver.session(database=database_name()) as session:
            record = session.run("RETURN 1 AS ok").single()
        return {"configured": True, "status": "healthy" if record and record["ok"] == 1 else "degraded", "database": database_name()}
    except Exception as exc:
        return {"configured": True, "status": "error", "error": f"{type(exc).__name__}: {exc}"}


def ensure_schema() -> Dict[str, Any]:
    if not configured():
        return {"configured": False, "status": "not_configured"}
    driver = _driver()
    statements = [
        "CREATE CONSTRAINT cipher_entity_key IF NOT EXISTS FOR (n:Entity) REQUIRE (n.case_id, n.entity_id) IS UNIQUE",
        "CREATE INDEX cipher_entity_label IF NOT EXISTS FOR (n:Entity) ON (n.label)",
        "CREATE INDEX cipher_entity_type IF NOT EXISTS FOR (n:Entity) ON (n.entity_type)",
    ]
    with driver.session(database=database_name()) as session:
        for statement in statements:
            session.run(statement).consume()
    return {"configured": True, "status": "healthy"}


def sync_case(
    case_id: int,
    entities: List[Dict[str, Any]],
    relationships: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Replace a case's verified graph projection atomically inside Neo4j."""
    if not configured():
        return {"configured": False, "status": "not_configured", "nodes": 0, "edges": 0}
    driver = _driver()
    ensure_schema()
    node_rows = []
    for e in entities:
        node_rows.append({
            "case_id": int(case_id),
            "entity_id": int(e["id"]),
            "label": e.get("label") or "Unknown",
            "entity_type": e.get("entity_type") or "UNKNOWN",
            "aliases": e.get("aliases") or "",
            "confidence": float(e.get("confidence_score") or 0),
            "verification_status": "verified",
            "lat": e.get("latitude"),
            "lng": e.get("longitude"),
            "source_document_id": e.get("source_document_id"),
            "source_reference": e.get("source_reference") or "",
        })
    edge_rows = []
    for r in relationships:
        edge_rows.append({
            "case_id": int(case_id),
            "relationship_id": int(r["id"]),
            "source_entity_id": int(r["source_entity_id"]),
            "target_entity_id": int(r["target_entity_id"]),
            "relationship_type": r.get("relationship_type") or "ASSOCIATED_WITH",
            "evidence": r.get("evidence_sentence") or "",
            "confidence": float(r.get("confidence_score") or 0),
            "source_document_id": r.get("source_document_id"),
            "source_reference": r.get("source_reference") or "",
        })
    with driver.session(database=database_name()) as session:
        with session.begin_transaction() as tx:
            tx.run("MATCH (n:Entity {case_id:$case_id}) DETACH DELETE n", case_id=int(case_id))
            tx.run(
                """
                UNWIND $rows AS row
                CREATE (n:Entity)
                SET n += row
                """,
                rows=node_rows,
            )
            tx.run(
                """
                UNWIND $rows AS row
                MATCH (s:Entity {case_id: row.case_id, entity_id: row.source_entity_id})
                MATCH (t:Entity {case_id: row.case_id, entity_id: row.target_entity_id})
                CREATE (s)-[r:CONNECTED]->(t)
                SET r.case_id = row.case_id,
                    r.relationship_id = row.relationship_id,
                    r.relationship_type = row.relationship_type,
                    r.evidence = row.evidence,
                    r.confidence = row.confidence,
                    r.source_document_id = row.source_document_id,
                    r.source_reference = row.source_reference,
                    r.verification_status = 'verified'
                """,
                rows=edge_rows,
            )
            tx.commit()
    return {"configured": True, "status": "synced", "nodes": len(node_rows), "edges": len(edge_rows)}


def case_graph(case_id: int) -> Dict[str, List[Dict[str, Any]]]:
    if not configured():
        raise RuntimeError("Neo4j is not configured. Set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD.")
    driver = _driver()
    with driver.session(database=database_name()) as session:
        nodes = [dict(r) for r in session.run(
            """
            MATCH (n:Entity {case_id:$case_id})
            RETURN n.entity_id AS id, n.label AS label, n.entity_type AS type,
                   n.aliases AS aliases, n.confidence AS confidence,
                   n.verification_status AS status, n.lat AS lat, n.lng AS lng
            ORDER BY n.entity_id
            """, case_id=int(case_id))]
        edges = [dict(r) for r in session.run(
            """
            MATCH (s:Entity {case_id:$case_id})-[r:CONNECTED]->(t:Entity {case_id:$case_id})
            RETURN toString(r.relationship_id) AS id,
                   toString(s.entity_id) AS source,
                   toString(t.entity_id) AS target,
                   r.relationship_type AS label,
                   r.evidence AS evidence,
                   r.confidence AS confidence,
                   r.verification_status AS status
            ORDER BY r.relationship_id
            """, case_id=int(case_id))]
    return {"nodes": nodes, "edges": edges}


def node(case_id: int, entity_id: int) -> Optional[Dict[str, Any]]:
    g = case_graph(case_id)
    for n in g["nodes"]:
        if int(n["id"]) == int(entity_id):
            rels = [e for e in g["edges"] if int(e["source"]) == int(entity_id) or int(e["target"]) == int(entity_id)]
            return {"node": n, "relationships": rels}
    return None


def neighbors(case_id: int, entity_id: int) -> Dict[str, Any]:
    g = case_graph(case_id)
    node_ids = {str(n["id"]): n for n in g["nodes"]}
    rels = [e for e in g["edges"] if str(e["source"]) == str(entity_id) or str(e["target"]) == str(entity_id)]
    ids = set()
    for r in rels:
        ids.add(str(r["target"]) if str(r["source"]) == str(entity_id) else str(r["source"]))
    return {"nodes": [node_ids[i] for i in sorted(ids) if i in node_ids], "edges": rels}


def relationship(case_id: int, relationship_id: int) -> Optional[Dict[str, Any]]:
    if not configured():
        return None
    driver = _driver()
    with driver.session(database=database_name()) as session:
        rec = session.run(
            """
            MATCH (s:Entity {case_id:$case_id})-[r:CONNECTED {relationship_id:$relationship_id}]->(t:Entity {case_id:$case_id})
            RETURN r, s, t
            """, case_id=int(case_id), relationship_id=int(relationship_id)).single()
    if not rec:
        return None
    r = rec["r"]; s = rec["s"]; t = rec["t"]
    return {
        "relationship": dict(r),
        "from_entity": dict(s),
        "to_entity": dict(t),
    }


def degree_centrality(case_id: int) -> List[Dict[str, Any]]:
    if not configured():
        return []
    driver = _driver()
    with driver.session(database=database_name()) as session:
        rows = [dict(r) for r in session.run(
            """
            MATCH (n:Entity {case_id:$case_id})
            OPTIONAL MATCH (n)-[r:CONNECTED]-()
            RETURN n.entity_id AS id, n.label AS label, count(r) AS degree
            ORDER BY degree DESC, n.label
            """, case_id=int(case_id))]
    total = max(1, len(rows) - 1)
    for row in rows:
        row["centrality"] = round(float(row["degree"]) / total, 6)
    return rows


def shortest_path(case_id: int, start_id: int, end_id: int, max_hops: int = 6) -> Dict[str, Any]:
    if not configured():
        raise RuntimeError("Neo4j is not configured")
    driver = _driver()
    max_hops = max(1, min(int(max_hops), 12))
    with driver.session(database=database_name()) as session:
        rec = session.run(
            f"""
            MATCH (s:Entity {{case_id:$case_id, entity_id:$start_id}}),
                  (t:Entity {{case_id:$case_id, entity_id:$end_id}})
            OPTIONAL MATCH p = shortestPath((s)-[:CONNECTED*..{max_hops}]-(t))
            RETURN p
            """,
            case_id=int(case_id), start_id=int(start_id), end_id=int(end_id)
        ).single()
    if not rec or rec["p"] is None:
        return {"connected": False, "path_found": False}
    p = rec["p"]
    nodes = [{"id": n.get("entity_id"), "label": n.get("label"), "type": n.get("entity_type")} for n in p.nodes]
    edges = [{"id": r.get("relationship_id"), "source": r.start_node.get("entity_id"), "target": r.end_node.get("entity_id"), "type": r.get("relationship_type"), "evidence": r.get("evidence")} for r in p.relationships]
    return {"connected": True, "path_found": True, "hops": len(edges), "hop_count": len(edges), "path_nodes": nodes, "path_edges": edges}


def graph_records(case_id: int) -> Dict[str, List[Dict[str, Any]]]:
    return case_graph(case_id)
