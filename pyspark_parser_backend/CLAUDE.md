# Project: PySpark to Graph Parser

## Overview
This backend parses PySpark code into a JSON graph structure (nodes + edges)
consumed by a React/ReactFlow frontend.

## Current File
- `parasing_pyspark.py` — existing AST-based parser, keep all existing logic intact

## Task
Refactor into a LangGraph pipeline with Gemini as AI fallback.
DO NOT rewrite the existing `pyspark_to_flow()` and helper functions.
Only wrap them and add new nodes around them.

## Target File Structure
```
backend/
├── parser/
│   ├── __init__.py
│   ├── ast_parser.py        # move existing parasing_pyspark.py logic here
│   ├── ai_parser.py         # Gemini API fallback logic
│   ├── graph_pipeline.py    # LangGraph pipeline
│   └── supported_ops.py     # all supported PySpark ops list
├── main.py                  # FastAPI entry point
├── requirements.txt
└── CLAUDE.md
```

## Rules
- Keep all existing functions: lit(), src(), dfs_calls(), parse_agg_arg(),
  parse_agg_function_call(), pyspark_to_flow()
- Add these missing ops to ast_parser.py:
  dropDuplicates, distinct, drop, orderBy/sort, limit,
  fillna, dropna, cache/persist, pivot, repartition/coalesce, spark.sql()
- Use Google Gemini API (gemini-2.0-flash) for AI fallback, NOT OpenAI or Anthropic
- Gemini SDK: google-genai
- LangGraph state must include: raw_code, nodes, edges, failed_stmts,
  retry_count, errors, edited_node_id, regenerated_code
- All AI responses must be parsed as JSON — strip markdown fences before parsing
- Each node in output must have parsed_by field: "ast" | "ai" | "ai_retry" | "failed"
- FastAPI endpoint: POST /parse  body: {"code": "pyspark string"}
                    POST /regenerate  body: {"node": {...}, "base_df": "..."}

## Gemini Setup
- API key from env var: GEMINI_API_KEY
- Model: gemini-2.0-flash
- Use google.genai client
- Generation config: temperature=0.1 (low, we want deterministic JSON output)

## LangGraph Pipeline Flow
ast_parse → (if failed_stmts) → ai_parse → (if still failing) → ai_retry → END

## JSON Output Schema (must match frontend exactly)
{
  "nodes": [
    {
      "id": "0",
      "variable": "df_name",
      "type": "custom",
      "position": {"x": 300, "y": 300},
      "data": {
        "base_df": "source_df",
        "operation": ["join", "select"],
        "inputs": ["df1", "df2"],
        "code": "raw pyspark string",
        "metadata": [...],
        "parsed_by": "ast"
      }
    }
  ],
  "edges": [
    {"id": "e_df1_to_df2", "source": "0", "target": "1"}
  ]
}

## Metadata Types (frontend renders these — do not change structure)
select:           {"type": "select", "columns": ["col1", "col2"]}
filter/where:     {"type": "filter", "conditions": ["expr"]}
withColumn:       {"type": "withColumn", "columns": [{"column": "x", "expression": "..."}]}
withColumnRenamed:{"type": "withColumnRenamed", "columns": [{"from": "a", "to": "b"}]}
join:             {"type": "join", "joinType": "left", "table1": "df1", "table1Alias": "a",
                   "table2": "df2", "table2Alias": "b", "condition": "..."}
union:            {"type": "union", "unions": [{"unionWith": "df2", "byName": false}]}
groupby:          {"type": "groupby", "columns": ["col1"]}
agg:              {"type": "agg", "expressions": [{"exp": "max(col('x'))", "alias": "x_max"}]}
orderBy:          {"type": "orderBy", "columns": ["col1 desc"]}
drop:             {"type": "drop", "columns": ["col1"]}
limit:            {"type": "limit", "value": 100}
dropDuplicates:   {"type": "dropDuplicates", "columns": ["col1"]}
distinct:         {"type": "distinct"}
sql:              {"type": "sql", "query": "SELECT ..."}
pivot:            {"type": "pivot", "column": "col1", "values": ["a","b"]}
repartition:      {"type": "repartition", "value": "200"}
cache:            {"type": "cache"}

## Needs AI Fallback Conditions (for _needs_ai_fallback function)
- metadata list is empty
- operation list is empty  
- any operation type is "unknown"
- parsed_by is missing

## Do Not
- Do not change any frontend code
- Do not change existing JSON field names
- Do not use LangChain, only langgraph package directly
- Do not use streaming for Gemini responses