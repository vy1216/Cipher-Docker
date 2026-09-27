# Neo4j Graph API Tests

After login, obtain a bearer token from `/api/auth/login`.

## 1. Health

`GET /api/health/neo4j`

Expected: `status=healthy`.

## 2. Graph

`GET /api/cases/{case_id}/graph`

Expected JSON contains:

- `graph_store: "neo4j"`
- `nodes[]` for verified entities
- `edges[]` for verified relationships

## 3. Node

`GET /api/cases/{case_id}/graph/nodes/{entity_id}`

Expected: node metadata, verified relationships, and linked locations.

## 4. Neighbors

`GET /api/cases/{case_id}/graph/nodes/{entity_id}/neighbors`

Expected: only verified graph neighbors.

## 5. Relationship

`GET /api/cases/{case_id}/graph/relationships/{relationship_id}`

Expected: source, target, relationship type, evidence and confidence.

## 6. Degree centrality

`POST /api/cases/{case_id}/graph/analytics/centrality`

Expected: deterministic degree counts from Neo4j.

## 7. Communities

`POST /api/cases/{case_id}/graph/analytics/communities`

Expected: deterministic connected-component grouping over the verified graph fetched from Neo4j.

## 8. Shortest path

`POST /api/cases/{case_id}/graph/path`

Example body:

```json
{"start_entity_id":1,"end_entity_id":2,"max_hops":6}
```

Expected: path nodes and relationship edges when connected.


## AI model
Use `GEMINI_MODEL=gemini-3.6-flash`. Google currently lists Gemini 3.6 Flash with Free Tier input/output pricing.

## Case report PDF
Authenticated endpoint: `GET /api/cases/{case_id}/report.pdf`
