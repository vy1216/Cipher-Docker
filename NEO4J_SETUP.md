# CIPHER Neo4j Setup — AuraDB Free

CIPHER is now a hybrid datastore:

- PostgreSQL/Supabase (or SQLite locally): cases, evidence, users, review, audit, locations, timeline, AI conversations.
- Neo4j AuraDB: the graph projection of **verified** entities and relationships.

## Create the free database

1. Create a Neo4j account.
2. Create one **AuraDB Free** instance.
3. Save the generated database password when Neo4j shows it.
4. Copy the connection URI from the Aura console. It normally looks like `neo4j+s://<instance>.databases.neo4j.io`.
5. Keep the default database as `neo4j` unless your Aura console shows another database name.

Neo4j currently lists AuraDB Free as a $0 tier and says one Free instance can be created per account. The Free tier has usage limits and does not include the Graph Data Science library. CIPHER therefore uses Cypher/Neo4j for graph storage and path/degree queries and uses deterministic NetworkX for community grouping.

## Configure `.env`

```env
NEO4J_URI=neo4j+s://YOUR-INSTANCE.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=YOUR_AURA_PASSWORD
NEO4J_DATABASE=neo4j
NEO4J_REQUIRED_FOR_GRAPH=true
```

Do not commit the `.env` file or the Neo4j password.

## Verify

Start CIPHER and open:

`http://127.0.0.1:8000/api/health/neo4j`

A healthy response should report:

```json
{"configured": true, "status": "healthy", "database": "neo4j"}
```

## Data flow

`Evidence -> extraction -> PENDING review -> Accept/Edit -> VERIFIED relational records -> Neo4j sync -> Network -> GIS relationship lines`

Rejected and pending records are not written into the verified graph projection.
