from __future__ import annotations

from typing import TypedDict, Annotated
import operator

from langgraph.graph import StateGraph, END

from .ast_parser import pyspark_to_flow, _needs_ai_fallback
from .ai_parser import ai_parse_node, ai_retry_node

# ---------------------------------------------------------------------------
# State schema
# ---------------------------------------------------------------------------

class ParseState(TypedDict):
    raw_code:         str
    nodes:            list[dict]
    edges:            list[dict]
    failed_stmts:     list[dict]          # node dicts that still need AI
    retry_count:      int
    errors:           Annotated[list[str], operator.add]
    edited_node_id:   str | None
    regenerated_code: str | None


# ---------------------------------------------------------------------------
# Graph nodes
# ---------------------------------------------------------------------------

def _ast_parse(state: ParseState) -> dict:
    """Run the AST parser; flag nodes that need AI fallback."""
    try:
        result = pyspark_to_flow(state["raw_code"])
    except SyntaxError as exc:
        return {"errors": [f"SyntaxError: {exc}"], "nodes": [], "edges": [], "failed_stmts": []}

    nodes = result["nodes"]
    edges = result["edges"]
    failed = [n for n in nodes if _needs_ai_fallback(n)]

    return {"nodes": nodes, "edges": edges, "failed_stmts": failed}


def _ai_parse(state: ParseState) -> dict:
    """First Gemini pass — runs on every node that AST couldn't handle."""
    updated_nodes = list(state["nodes"])
    still_failing: list[dict] = []

    for i, node in enumerate(updated_nodes):
        if not _needs_ai_fallback(node):
            continue
        updated = ai_parse_node(node)
        updated_nodes[i] = updated
        if _needs_ai_fallback(updated) or updated["data"].get("parsed_by") == "failed":
            still_failing.append(updated)

    return {"nodes": updated_nodes, "failed_stmts": still_failing}


def _ai_retry(state: ParseState) -> dict:
    """Second Gemini pass for nodes that still need help after _ai_parse."""
    updated_nodes = list(state["nodes"])
    errors: list[str] = []

    for i, node in enumerate(updated_nodes):
        if not _needs_ai_fallback(node):
            continue
        updated = ai_retry_node(node)
        updated_nodes[i] = updated
        if updated["data"].get("parsed_by") == "failed":
            errors.append(
                f"Node '{node.get('variable', node['id'])}' could not be parsed: "
                f"{updated['data'].get('error', 'unknown')}"
            )

    return {
        "nodes":       updated_nodes,
        "failed_stmts": [],
        "retry_count": state.get("retry_count", 0) + 1,
        "errors":      errors,
    }


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------

def _route_after_ast(state: ParseState) -> str:
    return "ai_parse" if state["failed_stmts"] else END


def _route_after_ai(state: ParseState) -> str:
    return "ai_retry" if state["failed_stmts"] else END


# ---------------------------------------------------------------------------
# Build & compile graph (once at import time)
# ---------------------------------------------------------------------------

def _build_graph():
    g = StateGraph(ParseState)

    g.add_node("ast_parse", _ast_parse)
    g.add_node("ai_parse",  _ai_parse)
    g.add_node("ai_retry",  _ai_retry)

    g.set_entry_point("ast_parse")

    g.add_conditional_edges("ast_parse", _route_after_ast, {"ai_parse": "ai_parse", END: END})
    g.add_conditional_edges("ai_parse",  _route_after_ai,  {"ai_retry": "ai_retry", END: END})
    g.add_edge("ai_retry", END)

    return g.compile()


_graph = _build_graph()


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def parse_pyspark(code: str) -> dict:
    """
    Parse PySpark code through the AST → AI → AI-retry pipeline.

    Returns:
        {
            "nodes":      list[dict],
            "edges":      list[dict],
            "unresolved": list[dict],   # nodes with parsed_by == "failed"
            "errors":     list[str],
        }
    """
    initial: ParseState = {
        "raw_code":         code,
        "nodes":            [],
        "edges":            [],
        "failed_stmts":     [],
        "retry_count":      0,
        "errors":           [],
        "edited_node_id":   None,
        "regenerated_code": None,
    }

    final = _graph.invoke(initial)

    unresolved = [n for n in final["nodes"] if n["data"].get("parsed_by") == "failed"]

    return {
        "nodes":      final["nodes"],
        "edges":      final["edges"],
        "unresolved": unresolved,
        "errors":     final["errors"],
    }
