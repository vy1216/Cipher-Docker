"""Case-scoped link prediction for CIPHER.

This module intentionally trains an ephemeral, case-scoped model from the graph
currently available in the case. It does not overwrite the research temporal model.
It is designed for CSV-imported case graphs and returns explainable graph features.
"""
from __future__ import annotations

import math
import random
from typing import Any, Dict, Iterable, List, Tuple

import networkx as nx

FEATURE_COLUMNS = [
    "degree_a", "degree_b", "common_neighbors", "jaccard_similarity",
    "preferential_attachment", "shortest_path_length", "same_community",
    "pagerank_a", "pagerank_b", "node_type_match",
]


def _pair(a: Any, b: Any) -> Tuple[str, str]:
    a, b = str(a), str(b)
    return (a, b) if a <= b else (b, a)


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        value = float(value)
        return value if math.isfinite(value) else default
    except (TypeError, ValueError):
        return default


def build_case_graph(entities: Iterable[Dict[str, Any]], relationships: Iterable[Dict[str, Any]]) -> nx.Graph:
    graph = nx.Graph()
    for entity in entities:
        entity_id = entity.get("id")
        if entity_id is not None:
            graph.add_node(str(entity_id), node_type=str(entity.get("entity_type") or entity.get("type") or "UNKNOWN"))
    for rel in relationships:
        source = rel.get("source_entity_id", rel.get("source"))
        target = rel.get("target_entity_id", rel.get("target"))
        if source is None or target is None or str(source) == str(target):
            continue
        graph.add_edge(str(source), str(target), relationship_type=rel.get("relationship_type"), status=rel.get("verification_status"))
    return graph


def _communities(graph: nx.Graph) -> Dict[str, int]:
    if graph.number_of_nodes() == 0:
        return {}
    try:
        groups = list(nx.community.greedy_modularity_communities(graph))
    except Exception:
        groups = [set(c) for c in nx.connected_components(graph)]
    result: Dict[str, int] = {}
    for index, group in enumerate(groups):
        for node in group:
            result[str(node)] = index
    return result


def graph_statistics(graph: nx.Graph) -> Dict[str, Any]:
    if graph.number_of_nodes():
        try:
            pagerank = nx.pagerank(graph, alpha=0.85)
        except Exception:
            pagerank = {node: 0.0 for node in graph.nodes}
    else:
        pagerank = {}
    return {
        "degree": dict(graph.degree()),
        "pagerank": pagerank,
        "communities": _communities(graph),
    }


def pair_features(graph: nx.Graph, source: Any, target: Any, stats: Dict[str, Any]) -> Dict[str, float]:
    source, target = str(source), str(target)
    a_neighbors = set(graph.neighbors(source)) if source in graph else set()
    b_neighbors = set(graph.neighbors(target)) if target in graph else set()
    common = a_neighbors & b_neighbors
    union = a_neighbors | b_neighbors
    jaccard = len(common) / len(union) if union else 0.0
    try:
        distance = float(nx.shortest_path_length(graph, source, target))
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        distance = -1.0
    type_a = str(graph.nodes[source].get("node_type", "UNKNOWN")) if source in graph else "UNKNOWN"
    type_b = str(graph.nodes[target].get("node_type", "UNKNOWN")) if target in graph else "UNKNOWN"
    return {
        "degree_a": float(stats["degree"].get(source, 0)),
        "degree_b": float(stats["degree"].get(target, 0)),
        "common_neighbors": float(len(common)),
        "jaccard_similarity": float(jaccard),
        "preferential_attachment": float(stats["degree"].get(source, 0) * stats["degree"].get(target, 0)),
        "shortest_path_length": distance,
        "same_community": float(int(stats["communities"].get(source, -1) == stats["communities"].get(target, -2))),
        "pagerank_a": float(stats["pagerank"].get(source, 0.0)),
        "pagerank_b": float(stats["pagerank"].get(target, 0.0)),
        "node_type_match": float(int(type_a == type_b)),
    }


def _candidate_pairs(graph: nx.Graph, limit: int = 5000) -> List[Tuple[str, str]]:
    nodes = list(graph.nodes())
    candidates: List[Tuple[str, str]] = []
    for index, source in enumerate(nodes):
        for target in nodes[index + 1:]:
            if not graph.has_edge(source, target):
                candidates.append((source, target))
                if len(candidates) >= limit:
                    return candidates
    return candidates


def _train_case_model(graph: nx.Graph, stats: Dict[str, Any]):
    """Fit one case-scoped model so candidate ranking does not retrain per pair."""
    try:
        from sklearn.ensemble import RandomForestClassifier
        import numpy as np
        positives=[tuple(edge) for edge in graph.edges()]
        negatives=_candidate_pairs(graph, limit=max(100, len(positives)))
        if len(positives)<4 or len(negatives)<4:
            return None, "graph_score_fallback"
        negatives=negatives[:len(positives)]
        samples=positives+negatives
        X=np.array([[pair_features(graph,a,b,stats)[c] for c in FEATURE_COLUMNS] for a,b in samples],dtype=float)
        y=np.array([1]*len(positives)+[0]*len(negatives),dtype=int)
        model=RandomForestClassifier(n_estimators=120,random_state=42,class_weight="balanced",n_jobs=1)
        model.fit(X,y)
        return model,"case_scoped_random_forest"
    except Exception:
        return None,"graph_score_fallback"

def _score_with_model(graph, features, model, model_name):
    if model is not None:
        import numpy as np
        x=np.array([[features[column] for column in FEATURE_COLUMNS]],dtype=float)
        return float(model.predict_proba(x)[0][list(model.classes_).index(1)]),model_name
    degree_max=max(1.0,float(max(dict(graph.degree()).values(),default=1)))
    degree_score=min(1.0,((features["degree_a"]+features["degree_b"])/(2.0*degree_max)))
    proximity_score=1.0 if features["shortest_path_length"] in (1.0,2.0) else 0.0
    probability=max(0.0,min(1.0,0.45*features["jaccard_similarity"]+0.25*degree_score+0.20*proximity_score+0.10*features["same_community"]))
    return probability,model_name

def predict_pair(graph: nx.Graph, source: Any, target: Any, threshold: float = 0.20, _stats=None, _model=None, _model_name=None) -> Dict[str, Any]:
    source,target=str(source),str(target)
    if source==target: raise ValueError("Source and target must be different entities")
    if source not in graph or target not in graph:
        missing=source if source not in graph else target
        raise KeyError(f"Entity {missing} is not present in the case graph")
    stats=_stats or graph_statistics(graph)
    features=pair_features(graph,source,target,stats)
    existing=graph.has_edge(source,target)
    model=_model
    model_name=_model_name
    if model_name is None:
        model,model_name=_train_case_model(graph,stats)
    probability,model_name=_score_with_model(graph,features,model,model_name or "graph_score_fallback")
    candidate=bool(not existing and probability>=threshold)
    return {
        "source":int(source) if source.isdigit() else source,
        "target":int(target) if target.isdigit() else target,
        "model":model_name,
        "probability":round(probability,6),
        "threshold":float(threshold),
        "predicted_relationship":candidate,
        "prediction_status":"EXISTING_RELATIONSHIP" if existing else ("MODEL_CANDIDATE" if candidate else "NO_CANDIDATE"),
        "existing_relationship":bool(existing),
        "requires_review":candidate,
        "features":{key:round(float(features[key]),8) for key in FEATURE_COLUMNS},
        "feature_columns":FEATURE_COLUMNS,
        "graph":{"nodes":graph.number_of_nodes(),"edges":graph.number_of_edges()},
        "label":"MODEL ESTIMATE - NOT AN AI CONCLUSION",
    }

def rank_candidates(graph: nx.Graph, limit: int = 25, threshold: float = 0.20) -> List[Dict[str, Any]]:
    stats=graph_statistics(graph)
    model,model_name=_train_case_model(graph,stats)
    candidates=_candidate_pairs(graph,limit=max(limit*10,limit))
    results=[]
    for source,target in candidates:
        try:
            result=predict_pair(graph,source,target,threshold,stats,model,model_name)
            if result["requires_review"]:
                results.append(result)
        except Exception:
            continue
    results.sort(key=lambda item:item["probability"],reverse=True)
    return results[:limit]
