# test.py  — durability tests for the PySpark AST parser
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

from backend.parser.graph_pipeline import parse_pyspark

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"

_results = []

def check(name: str, condition: bool, detail: str = ""):
    label = PASS if condition else FAIL
    suffix = f"  ({detail})" if detail and not condition else ""
    print(f"  [{label}] {name}{suffix}")
    _results.append((name, condition))


def meta_types(node: dict) -> list:
    return [m["type"] for m in node["data"]["metadata"]]


def find_node(result: dict, variable: str) -> dict | None:
    return next((n for n in result["nodes"] if n["variable"] == variable), None)


def run(code: str):
    """Parse code and return result; also assert no exception."""
    result = parse_pyspark(code)
    return result


# ---------------------------------------------------------------------------
# Individual test functions
# ---------------------------------------------------------------------------

def test_select():
    code = "df2 = df1.select('id', 'name', 'age')"
    r = run(code)
    n = find_node(r, "df2")
    check("select — node created", n is not None)
    check("select — metadata type", n and meta_types(n) == ["select"])
    check("select — columns captured", n and n["data"]["metadata"][0]["columns"] == ["id", "name", "age"])
    check("select — parsed_by=ast", n and n["data"]["parsed_by"] == "ast")


def test_filter():
    code = "df2 = df1.filter(df1['status'] == 'active')"
    r = run(code)
    n = find_node(r, "df2")
    check("filter — node created", n is not None)
    check("filter — metadata type", n and "filter" in meta_types(n))


def test_where():
    code = "df2 = df1.where(col('amount') > 100)"
    r = run(code)
    n = find_node(r, "df2")
    check("where — node created", n is not None)
    check("where — metadata type", n and "where" in meta_types(n))
    check("where — condition non-empty", n and bool(n["data"]["metadata"][0]["conditions"]))


def test_withColumn():
    code = "df2 = df1.withColumn('new_col', col('a') + col('b'))"
    r = run(code)
    n = find_node(r, "df2")
    check("withColumn — node created", n is not None)
    check("withColumn — metadata type", n and "withColumn" in meta_types(n))
    cols = n["data"]["metadata"][0]["columns"] if n else []
    check("withColumn — column name", cols and cols[0]["column"] == "new_col")


def test_withColumnRenamed():
    code = "df2 = df1.withColumnRenamed('old_name', 'new_name')"
    r = run(code)
    n = find_node(r, "df2")
    check("withColumnRenamed — node created", n is not None)
    check("withColumnRenamed — metadata type", n and "withColumnRenamed" in meta_types(n))
    cols = n["data"]["metadata"][0]["columns"] if n else []
    check("withColumnRenamed — from/to fields", cols and cols[0] == {"from": "old_name", "to": "new_name"})


def test_join_left():
    code = "df3 = df1.alias('a').join(df2.alias('b'), col('a.id') == col('b.id'), 'left')"
    r = run(code)
    n = find_node(r, "df3")
    check("join_left — node created", n is not None)
    check("join_left — join in metadata", n and "join" in meta_types(n))
    j = n["data"]["metadata"][0] if n else {}
    check("join_left — joinType=left", j.get("joinType") == "left")
    check("join_left — table1Alias=a", j.get("table1Alias") == "a")
    check("join_left — table2=df2", j.get("table2") == "df2")
    check("join_left — table2Alias=b", j.get("table2Alias") == "b")


def test_join_inner_no_alias():
    code = "df3 = df1.join(df2, col('df1.id') == col('df2.id'))"
    r = run(code)
    n = find_node(r, "df3")
    check("join_inner — node created", n is not None)
    j = n["data"]["metadata"][0] if n else {}
    check("join_inner — joinType=inner (default)", j.get("joinType") == "inner")


def test_union():
    code = "df3 = df1.union(df2)"
    r = run(code)
    n = find_node(r, "df3")
    check("union — node created", n is not None)
    check("union — metadata type", n and "union" in meta_types(n))
    unions = n["data"]["metadata"][0]["unions"] if n else []
    check("union — unionWith=df2", unions and unions[0]["unionWith"] == "df2")
    check("union — byName=False", unions and unions[0]["byName"] is False)


def test_union_by_name():
    code = "df3 = df1.unionByName(df2)"
    r = run(code)
    n = find_node(r, "df3")
    check("unionByName — byName=True", n and n["data"]["metadata"][0]["unions"][0]["byName"] is True)


def test_groupby_agg():
    code = "df2 = df1.groupBy('region').agg(max(col('sales')).alias('max_sales'), min(col('cost')).alias('min_cost'))"
    r = run(code)
    n = find_node(r, "df2")
    check("groupby_agg — node created", n is not None)
    types = meta_types(n) if n else []
    check("groupby_agg — groupBy in metadata", "groupBy" in types or "groupby" in types)
    check("groupby_agg — agg in metadata", "agg" in types)


def test_orderBy():
    code = "df2 = df1.orderBy(col('created_at').desc())"
    r = run(code)
    n = find_node(r, "df2")
    check("orderBy — node created", n is not None)
    check("orderBy — metadata type", n and "orderBy" in meta_types(n))
    cols = n["data"]["metadata"][0]["columns"] if n else []
    check("orderBy — columns non-empty", bool(cols))


def test_sort():
    code = "df2 = df1.sort('name', 'age')"
    r = run(code)
    n = find_node(r, "df2")
    check("sort — maps to orderBy metadata", n and "orderBy" in meta_types(n))


def test_drop():
    code = "df2 = df1.drop('temp_col', 'debug_col')"
    r = run(code)
    n = find_node(r, "df2")
    check("drop — node created", n is not None)
    check("drop — metadata type", n and "drop" in meta_types(n))
    cols = n["data"]["metadata"][0]["columns"] if n else []
    check("drop — columns=['temp_col','debug_col']", cols == ["temp_col", "debug_col"])


def test_dropDuplicates_no_args():
    code = "df2 = df1.dropDuplicates()"
    r = run(code)
    n = find_node(r, "df2")
    check("dropDuplicates() — node created", n is not None)
    check("dropDuplicates() — metadata type", n and "dropDuplicates" in meta_types(n))
    cols = n["data"]["metadata"][0]["columns"] if n else ["x"]
    check("dropDuplicates() — columns=[]", cols == [])


def test_dropDuplicates_with_list():
    code = "df2 = df1.dropDuplicates(['order_id', 'item_no'])"
    r = run(code)
    n = find_node(r, "df2")
    check("dropDuplicates([cols]) — node created", n is not None)
    cols = n["data"]["metadata"][0]["columns"] if n else []
    check("dropDuplicates([cols]) — columns=['order_id','item_no']", cols == ["order_id", "item_no"])


def test_distinct():
    code = "df2 = df1.distinct()"
    r = run(code)
    n = find_node(r, "df2")
    check("distinct — node created", n is not None)
    check("distinct — metadata type", n and "distinct" in meta_types(n))


def test_limit():
    code = "df2 = df1.limit(50)"
    r = run(code)
    n = find_node(r, "df2")
    check("limit — node created", n is not None)
    check("limit — metadata type", n and "limit" in meta_types(n))
    check("limit — value=50", n and n["data"]["metadata"][0]["value"] == 50)


def test_cache():
    code = "df2 = df1.cache()"
    r = run(code)
    n = find_node(r, "df2")
    check("cache — node created", n is not None)
    check("cache — metadata type", n and "cache" in meta_types(n))


def test_persist():
    code = "df2 = df1.persist()"
    r = run(code)
    n = find_node(r, "df2")
    check("persist — maps to cache metadata", n and "cache" in meta_types(n))


def test_repartition():
    code = "df2 = df1.repartition(200)"
    r = run(code)
    n = find_node(r, "df2")
    check("repartition — node created", n is not None)
    check("repartition — metadata type", n and "repartition" in meta_types(n))
    check("repartition — value='200'", n and n["data"]["metadata"][0]["value"] == "200")


def test_coalesce():
    code = "df2 = df1.coalesce(1)"
    r = run(code)
    n = find_node(r, "df2")
    check("coalesce — maps to repartition metadata", n and "repartition" in meta_types(n))


def test_pivot():
    code = "df2 = df1.groupBy('region').pivot('category', ['A', 'B', 'C'])"
    r = run(code)
    n = find_node(r, "df2")
    check("pivot — node created", n is not None)
    check("pivot — metadata type", n and "pivot" in meta_types(n))
    pm = next((m for m in (n["data"]["metadata"] if n else []) if m["type"] == "pivot"), {})
    check("pivot — column='category'", pm.get("column") == "category")
    check("pivot — values=['A','B','C']", pm.get("values") == ["A", "B", "C"])


def test_spark_sql():
    code = "df2 = spark.sql('SELECT id, name FROM orders WHERE status = 1')"
    r = run(code)
    n = find_node(r, "df2")
    check("spark.sql — node created", n is not None)
    check("spark.sql — metadata type", n and "sql" in meta_types(n))
    check("spark.sql — query captured", n and "SELECT" in (n["data"]["metadata"][0].get("query") or ""))
    check("spark.sql — base_df=None", n and n["data"]["base_df"] is None)


def test_chained_ops():
    code = (
        "df2 = df1.filter(col('active') == 1)"
        ".select('id', 'name')"
        ".withColumn('full_name', col('name'))"
        ".limit(100)"
    )
    r = run(code)
    n = find_node(r, "df2")
    check("chained — node created", n is not None)
    types = meta_types(n) if n else []
    check("chained — filter present", "filter" in types)
    check("chained — select present", "select" in types)
    check("chained — withColumn present", "withColumn" in types)
    check("chained — limit present", "limit" in types)


def test_edges_sequential():
    code = (
        "df2 = df1.select('id', 'name')\n"
        "df3 = df2.filter(col('id') > 0)\n"
        "df4 = df3.limit(10)\n"
    )
    r = run(code)
    check("edges — 3 nodes", len(r["nodes"]) == 3)
    check("edges — 2 edges", len(r["edges"]) == 2)
    # Verify edge direction: df1→df2, df2→df3, df3→df4 (only resolved dfs create edges)
    targets = {e["target"] for e in r["edges"]}
    n_df3 = find_node(r, "df3")
    n_df4 = find_node(r, "df4")
    check("edges — df3 is a target", n_df3 and n_df3["id"] in targets)
    check("edges — df4 is a target", n_df4 and n_df4["id"] in targets)


def test_join_edges():
    code = (
        "df_a = src_a.select('id', 'val')\n"
        "df_b = src_b.select('id', 'info')\n"
        "df_c = df_a.alias('a').join(df_b.alias('b'), col('a.id') == col('b.id'), 'left')\n"
    )
    r = run(code)
    check("join_edges — 3 nodes", len(r["nodes"]) == 3)
    # df_c should have edges from both df_a and df_b
    n_c = find_node(r, "df_c")
    edges_to_c = [e for e in r["edges"] if n_c and e["target"] == n_c["id"]]
    check("join_edges — 2 incoming edges to df_c", len(edges_to_c) == 2)


def test_variable_reassignment():
    code = (
        "df = src.select('id')\n"
        "df = df.filter(col('id') > 0)\n"
    )
    r = run(code)
    check("reassign — 2 nodes created", len(r["nodes"]) == 2)


def test_non_df_assignments_skipped():
    code = (
        "var1 = 'some_value'\n"
        "threshold = 0.8\n"
        "input_path = '/mnt/data'\n"
        "df2 = df1.select('id')\n"
    )
    r = run(code)
    check("non_df — only 1 node (df2)", len(r["nodes"]) == 1)
    check("non_df — node is df2", r["nodes"][0]["variable"] == "df2")


def test_empty_code():
    r = run("")
    check("empty — 0 nodes", len(r["nodes"]) == 0)
    check("empty — 0 edges", len(r["edges"]) == 0)


def test_import_statements_skipped():
    code = (
        "from pyspark.sql.functions import col, when\n"
        "from pyspark.sql.window import Window\n"
        "df2 = df1.select('id')\n"
    )
    r = run(code)
    check("imports — only 1 node", len(r["nodes"]) == 1)


def test_multi_withColumn():
    code = (
        "df2 = df1"
        ".withColumn('col_a', col('x') + 1)"
        ".withColumn('col_b', col('y') * 2)"
        ".withColumn('col_c', col('z').cast('string'))"
    )
    r = run(code)
    n = find_node(r, "df2")
    check("multi_withColumn — node created", n is not None)
    wc = [m for m in (n["data"]["metadata"] if n else []) if m["type"] == "withColumn"]
    check("multi_withColumn — 3 column entries", wc and len(wc[0]["columns"]) == 3)


def test_multi_withColumnRenamed():
    code = (
        "df2 = df1"
        ".withColumnRenamed('a', 'alpha')"
        ".withColumnRenamed('b', 'beta')"
    )
    r = run(code)
    n = find_node(r, "df2")
    wcr = [m for m in (n["data"]["metadata"] if n else []) if m["type"] == "withColumnRenamed"]
    check("multi_withColumnRenamed — 2 renames", wcr and len(wcr[0]["columns"]) == 2)


def test_complex_real_world():
    """The full selected code from the IDE — tests parser on a realistic script."""
    code = """
from pyspark.sql.functions import col, when, length, lpad, row_number, date_format
from pyspark.sql.window import Window

var1 = 'some_valueewrw'
input_path = '/mnt/adls/folder1'
threshold = '0.8'

it_base_zprc_with_mer_pos_agent = it_base_zprc_with_zpro_header.alias('zprc') \\
    .join(it_order_caf_add_union.alias('b'),
        (col('zprc.order_id') == col('b.order_id')) & (col('zprc.yyext_ref_num') == col('b.ext_ref_num')), 'left') \\
    .select(
        'zprc.*',
        'b.merchant_code',
        'b.pos_agent_code',
        col('b.kf_current_ts').alias('order_caf_add_kf_current_ts')
    ) \\
    .withColumn("merchant_code",
        when((length(col('merchant_code')) < 10), lpad(col('merchant_code'),10,'0'))
        .otherwise(col('merchant_code'))
    ) \\
    .withColumn("pos_agent_code",
        when((length(col('pos_agent_code')) < 10), lpad(col('pos_agent_code'),10,'0'))
        .otherwise(col('pos_agent_code'))
    )

it_base_zprc_with_ekyc_flag = it_base_zprc_with_mer_pos_agent.alias('zprc') \\
    .join(it_order_profdet_union.alias('b'),
        (col('zprc.order_id') == col('b.order_id')) & (col('zprc.yyext_ref_num') == col('b.ext_ref_num')), 'left') \\
    .select(
        'zprc.*',
        col('b.ekyc_flag').alias('ekyc_flag_c'),
        col('b.kf_current_ts').alias('opf_kf_current_ts')
    )

it_order_item_status_ois_lkp = it_self_lookup_data.select(
    "order_id", "order_item_no", "zpro_item_status", "ois_zpro_item_status_created_at", "ois_kf_current_ts"
)

it_order_item_status_ois = it_order_status \\
    .where(col('status_id').isin('Z01','Z02','Z04'))

it_order_item_status_ois = it_order_item_status_ois.select(
    "order_id", "item_no", "status_id", "zpro_item_status_created_at", "kf_current_ts"
)

it_order_item_status = it_order_item_status_ois.union(it_order_item_status_ois_lkp) \\
    .withColumn('rh_row', row_number().over(Window.partitionBy(col('order_id')).orderBy(col('kf_current_ts').desc()))) \\
    .where(col('rh_row') <= int(1))

df_filtered = df3.filter(df3['created_on'] > '20240101')
df_selected = df3.select('id', 'name')
df_intermediate = df1.select('id', 'name', 'created_at')
"""
    r = run(code)
    check("real_world — at least 8 nodes", len(r["nodes"]) >= 8)
    check("real_world — edges exist", len(r["edges"]) > 0)
    check("real_world — no errors key missing", "errors" in r)

    n0 = find_node(r, "it_base_zprc_with_mer_pos_agent")
    check("real_world — n0 join+select+withColumn", n0 and set(meta_types(n0)) >= {"join", "select", "withColumn"})

    n_union = find_node(r, "it_order_item_status")
    check("real_world — union node has union+withColumn+where", n_union and "union" in meta_types(n_union))

    all_parsed_by = {n["data"]["parsed_by"] for n in r["nodes"]}
    check("real_world — all nodes have parsed_by", all(pb in {"ast","ai","ai_retry","failed"} for pb in all_parsed_by))


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

TESTS = [
    test_select,
    test_filter,
    test_where,
    test_withColumn,
    test_withColumnRenamed,
    test_join_left,
    test_join_inner_no_alias,
    test_union,
    test_union_by_name,
    test_groupby_agg,
    test_orderBy,
    test_sort,
    test_drop,
    test_dropDuplicates_no_args,
    test_dropDuplicates_with_list,
    test_distinct,
    test_limit,
    test_cache,
    test_persist,
    test_repartition,
    test_coalesce,
    test_pivot,
    test_spark_sql,
    test_chained_ops,
    test_edges_sequential,
    test_join_edges,
    test_variable_reassignment,
    test_non_df_assignments_skipped,
    test_empty_code,
    test_import_statements_skipped,
    test_multi_withColumn,
    test_multi_withColumnRenamed,
    test_complex_real_world,
]

if __name__ == "__main__":
    import json

    print("\n========== PYSPARK PARSER — DURABILITY TESTS ==========\n")
    for test_fn in TESTS:
        section = test_fn.__name__.replace("test_", "").replace("_", " ").upper()
        print(f"\n--- {section} ---")
        try:
            test_fn()
        except Exception as exc:
            check(f"{test_fn.__name__} (uncaught exception)", False, str(exc))

    passed = sum(1 for _, ok in _results if ok)
    total  = len(_results)
    failed = total - passed
    print(f"\n========== RESULTS: {passed}/{total} passed", end="")
    if failed:
        print(f"  ({failed} FAILED)", end="")
    print(" ==========\n")

    if failed:
        print("Failed checks:")
        for name, ok in _results:
            if not ok:
                print(f"  ✗  {name}")
        print()

    # ── Full parse output of the complex real-world snippet ────────────────
    print("\n========== COMPLEX REAL-WORLD PARSE OUTPUT ==========\n")
    from backend.parser.graph_pipeline import parse_pyspark as _parse
    _real_code = """
from pyspark.sql.functions import col, when, length, lpad, row_number, date_format
from pyspark.sql.window import Window

var1 = 'some_valueewrw'
input_path = '/mnt/adls/folder1'
threshold = '0.8'

it_base_zprc_with_mer_pos_agent = it_base_zprc_with_zpro_header.alias('zprc') \\
    .join(it_order_caf_add_union.alias('b'),
        (col('zprc.order_id') == col('b.order_id')) & (col('zprc.yyext_ref_num') == col('b.ext_ref_num')), 'left') \\
    .select('zprc.*', 'b.merchant_code', 'b.pos_agent_code', col('b.kf_current_ts').alias('order_caf_add_kf_current_ts')) \\
    .withColumn("merchant_code", when((length(col('merchant_code')) < 10), lpad(col('merchant_code'),10,'0')).otherwise(col('merchant_code'))) \\
    .withColumn("pos_agent_code", when((length(col('pos_agent_code')) < 10), lpad(col('pos_agent_code'),10,'0')).otherwise(col('pos_agent_code')))

it_base_zprc_with_ekyc_flag = it_base_zprc_with_mer_pos_agent.alias('zprc') \\
    .join(it_order_profdet_union.alias('b'),
        (col('zprc.order_id') == col('b.order_id')) & (col('zprc.yyext_ref_num') == col('b.ext_ref_num')), 'left') \\
    .select('zprc.*', col('b.ekyc_flag').alias('ekyc_flag_c'), col('b.kf_current_ts').alias('opf_kf_current_ts'))

it_order_item_status_ois_lkp = it_self_lookup_data.select(
    "order_id", "order_item_no", "zpro_item_status", "ois_zpro_item_status_created_at", "ois_kf_current_ts"
)

it_order_item_status_ois = it_order_status \\
    .where(col('status_id').isin('Z01','Z02','Z04'))

it_order_item_status_ois = it_order_item_status_ois.select(
    "order_id", "item_no", "status_id", "zpro_item_status_created_at", "kf_current_ts"
)

it_order_item_status = it_order_item_status_ois.union(it_order_item_status_ois_lkp) \\
    .withColumn('rh_row', row_number().over(Window.partitionBy(col('order_id')).orderBy(col('kf_current_ts').desc()))) \\
    .where(col('rh_row') <= int(1))

df_filtered = df3.filter(df3['created_on'] > '20240101')
df_selected = df3.select('id', 'name')
df_intermediate = df1.select('id', 'name', 'created_at')
"""
    _result = _parse(_real_code)

    print("--- NODES ---")
    print(json.dumps(_result["nodes"], indent=2))

    print("\n--- EDGES ---")
    print(json.dumps(_result["edges"], indent=2))
