CREATE CONSTRAINT cipher_entity_key IF NOT EXISTS
FOR (n:Entity) REQUIRE (n.case_id, n.entity_id) IS UNIQUE;

CREATE INDEX cipher_entity_label IF NOT EXISTS
FOR (n:Entity) ON (n.label);

CREATE INDEX cipher_entity_type IF NOT EXISTS
FOR (n:Entity) ON (n.entity_type);

// CIPHER graph projection:
// (:Entity)-[:CONNECTED {relationship_type, relationship_id, evidence, confidence}]->(:Entity)
