import json
import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load .env from the project root (two levels up from this file)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

# ---------------------------------------------------------------------------
# Client (initialised once at import time)
# ---------------------------------------------------------------------------

_client: genai.Client | None = None

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise EnvironmentError("GEMINI_API_KEY environment variable is not set")
        _client = genai.Client(api_key=api_key)
    return _client

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

_PARSE_SYSTEM = """\
You are a PySpark code analyser. Given a single PySpark assignment statement,
return ONLY a JSON object (no markdown fences, no explanation) that describes
the DataFrame transformation using this exact schema:

{
  "variable": "<assigned variable name>",
  "base_df": "<source dataframe name or null>",
  "operation": ["<op1>", "<op2>"],
  "inputs": ["<df1>", "<df2>"],
  "metadata": [
    // one object per operation, see types below
  ]
}

Metadata object types (use exactly these structures):
- select:            {"type": "select", "columns": ["col1"]}
- filter/where:      {"type": "filter", "conditions": ["expr"]}
- withColumn:        {"type": "withColumn", "columns": [{"column": "x", "expression": "expr"}]}
- withColumnRenamed: {"type": "withColumnRenamed", "columns": [{"from": "a", "to": "b"}]}
- join:              {"type": "join", "joinType": "left", "table1": "df1", "table1Alias": "a",
                      "table2": "df2", "table2Alias": "b", "condition": "expr"}
- union:             {"type": "union", "unions": [{"unionWith": "df2", "byName": false}]}
- groupby:           {"type": "groupby", "columns": ["col1"]}
- agg:               {"type": "agg", "expressions": [{"exp": "max(col('x'))", "alias": "x_max"}]}
- orderBy:           {"type": "orderBy", "columns": ["col1 desc"]}
- drop:              {"type": "drop", "columns": ["col1"]}
- limit:             {"type": "limit", "value": 100}
- dropDuplicates:    {"type": "dropDuplicates", "columns": ["col1"]}
- distinct:          {"type": "distinct"}
- sql:               {"type": "sql", "query": "SELECT ..."}
- pivot:             {"type": "pivot", "column": "col1", "values": ["a", "b"]}
- repartition:       {"type": "repartition", "value": "200"}
- cache:             {"type": "cache"}

Rules:
- Return valid JSON only — no markdown, no extra keys.
- If you cannot parse the statement, return {"error": "<reason>"}.
"""

_RETRY_SYSTEM = """\
You previously returned an incomplete or incorrect parse for a PySpark statement.
The original code and your prior (failed) attempt are provided.
Return ONLY corrected JSON using the same schema as before.
Do not include markdown fences or explanation.
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _strip_fences(text: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` fences if present."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # drop first line (```json or ```) and last line (```)
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
    return text.strip()


def _call_gemini(system_prompt: str, user_content: str) -> dict:
    """Call Gemini and return a parsed dict. Raises ValueError on bad JSON."""
    response = _get_client().models.generate_content(
        model="gemini-2.5-flash",
        contents=user_content,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )
    raw = response.text
    cleaned = _strip_fences(raw)
    parsed = json.loads(cleaned)
    # Gemini sometimes wraps the result in an array — unwrap it
    if isinstance(parsed, list):
        parsed = parsed[0] if parsed else {}
    if not isinstance(parsed, dict):
        raise ValueError(f"Unexpected Gemini response type: {type(parsed).__name__}")
    return parsed


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def ai_parse_node(node: dict) -> dict:
    """
    Use Gemini to parse a single node that the AST parser could not handle.
    Returns the node dict with updated data fields and parsed_by='ai'.
    """
    code_snippet = node["data"].get("code") or ""
    user_content = f"Parse this PySpark statement:\n\n```python\n{code_snippet}\n```"

    try:
        result = _call_gemini(_PARSE_SYSTEM, user_content)
    except Exception as exc:
        node["data"]["parsed_by"] = "failed"
        node["data"]["error"] = str(exc)
        return node

    if "error" in result:
        node["data"]["parsed_by"] = "failed"
        node["data"]["error"] = result["error"]
        return node

    node["data"]["base_df"]   = result.get("base_df", node["data"].get("base_df"))
    node["data"]["operation"] = result.get("operation", [])
    node["data"]["inputs"]    = result.get("inputs", [])
    node["data"]["metadata"]  = result.get("metadata", [])
    node["data"]["parsed_by"] = "ai"
    return node


def ai_retry_node(node: dict) -> dict:
    """
    Second Gemini attempt for nodes that still failed after ai_parse_node.
    Returns the node with parsed_by='ai_retry' or 'failed'.
    """
    code_snippet = node["data"].get("code") or ""
    prior_meta   = json.dumps(node["data"].get("metadata", []), indent=2)

    user_content = (
        f"Original PySpark statement:\n```python\n{code_snippet}\n```\n\n"
        f"Prior (incomplete) metadata:\n```json\n{prior_meta}\n```\n\n"
        "Return a corrected JSON parse."
    )

    try:
        result = _call_gemini(_RETRY_SYSTEM, user_content)
    except Exception as exc:
        node["data"]["parsed_by"] = "failed"
        node["data"]["error"] = str(exc)
        return node

    if "error" in result:
        node["data"]["parsed_by"] = "failed"
        node["data"]["error"] = result["error"]
        return node

    node["data"]["base_df"]   = result.get("base_df", node["data"].get("base_df"))
    node["data"]["operation"] = result.get("operation", [])
    node["data"]["inputs"]    = result.get("inputs", [])
    node["data"]["metadata"]  = result.get("metadata", [])
    node["data"]["parsed_by"] = "ai_retry"
    return node


def ai_regenerate(node: dict, base_df: str) -> dict:
    """
    POST /regenerate endpoint handler: user edited a node, regenerate its parse
    from the updated code string stored in node['data']['code'].
    Returns updated node or raises on unrecoverable error.
    """
    code_snippet = node["data"].get("code") or ""
    user_content = (
        f"The user edited this PySpark statement. base_df is '{base_df}'.\n\n"
        f"```python\n{code_snippet}\n```\n\n"
        "Return a fresh JSON parse."
    )

    result = _call_gemini(_PARSE_SYSTEM, user_content)

    if "error" in result:
        raise ValueError(result["error"])

    node["data"]["base_df"]   = result.get("base_df", base_df)
    node["data"]["operation"] = result.get("operation", [])
    node["data"]["inputs"]    = result.get("inputs", [])
    node["data"]["metadata"]  = result.get("metadata", [])
    node["data"]["parsed_by"] = "ai_retry"
    return node
