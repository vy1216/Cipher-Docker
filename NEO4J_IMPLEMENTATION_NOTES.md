# Neo4j implementation

This build keeps PostgreSQL/SQLite as the relational source of truth and adds Neo4j as the graph datastore for verified entities and relationships. The graph is rebuilt idempotently from verified relational records whenever graph endpoints are requested, preventing stale or unreviewed graph data.

Neo4j AuraDB Free is supported through the official Python driver. The Free tier does not include Neo4j Graph Data Science, so degree and shortest-path use Neo4j/Cypher and community grouping uses deterministic NetworkX over the verified Neo4j graph projection.

Required environment variables:
NEO4J_URI
NEO4J_USERNAME
NEO4J_PASSWORD
NEO4J_DATABASE
NEO4J_REQUIRED_FOR_GRAPH=true
