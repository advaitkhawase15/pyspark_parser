import re
import libcst as cst
from ast import literal_eval
from collections import defaultdict

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AGGREGATION_METHODS = {'count', 'max', 'min', 'avg', 'sum', 'mean'}
_SKIP_OPS = {'alias'}   # ops that appear in chains but carry no data-op meaning


# ---------------------------------------------------------------------------
# Literal / source helpers
# ---------------------------------------------------------------------------

def _lit(node):
    """Extract a Python scalar from a libcst literal node."""
    if isinstance(node, cst.SimpleString):
        try:
            return literal_eval(node.value)
        except Exception:
            return None
    if isinstance(node, cst.Integer):
        try:
            return int(node.value, 0)
        except Exception:
            return None
    if isinstance(node, cst.Float):
        try:
            return float(node.value)
        except Exception:
            return None
    if isinstance(node, cst.UnaryOperation) and isinstance(node.operator, cst.Minus):
        inner = _lit(node.expression)
        return -inner if inner is not None else None
    return None


def _src(node, module):
    """Render a libcst node back to its source string."""
    try:
        return module.code_for_node(node)
    except Exception:
        return None


def _dfs_calls(call):
    """Return chained calls from base (leftmost) to top (outermost)."""
    stack = []
    cur = call
    while isinstance(cur, cst.Call):
        stack.append(cur)
        f = cur.func
        if isinstance(f, cst.Attribute):
            cur = f.value
        else:
            break
    return list(reversed(stack))


def _parse_agg_arg(arg_val, module):
    """Parse one argument of .agg() — returns {exp, alias}."""
    if (isinstance(arg_val, cst.Call)
            and isinstance(arg_val.func, cst.Attribute)
            and arg_val.func.attr.value == 'alias'):
        alias = _lit(arg_val.args[0].value) if arg_val.args else None
        exp = _src(arg_val.func.value, module)
        return {'exp': exp, 'alias': alias}
    return {'exp': _src(arg_val, module), 'alias': None}


# ---------------------------------------------------------------------------
# Phase 1 — Identify all df / variable assignments
# ---------------------------------------------------------------------------

def _collect_assignments(module):
    """
    Walk module body and return a list of
    (target_name: str, stmt_line: SimpleStatementLine, assign: Assign)
    for every assignment whose RHS is a Call.
    """
    result = []
    for stmt_line in module.body:
        if not isinstance(stmt_line, cst.SimpleStatementLine):
            continue
        for stmt in stmt_line.body:
            if not isinstance(stmt, cst.Assign):
                continue
            if len(stmt.targets) != 1:
                continue
            target_node = stmt.targets[0].target
            if not isinstance(target_node, cst.Name):
                continue
            if not isinstance(stmt.value, cst.Call):
                continue
            result.append((target_node.value, stmt_line, stmt))
    return result


# ---------------------------------------------------------------------------
# Phase 2 — Build node JSON for one df / variable assignment
# ---------------------------------------------------------------------------

def _build_node(target, stmt_line, stmt, module):
    """
    Parse a single assignment and return a node dict (without 'id').
    All operation details are collected into 'metadata'.
    """
    rhs = stmt.value
    node_code = _src(stmt_line, module)

    # ---- spark.sql("SELECT ...") ----------------------------------------
    if (isinstance(rhs.func, cst.Attribute)
            and rhs.func.attr.value == 'sql'
            and isinstance(rhs.func.value, cst.Name)
            and rhs.func.value.value == 'spark'):
        query = _lit(rhs.args[0].value) if rhs.args else None
        return {
            'variable': target,
            'type': 'custom',
            'position': {'x': 300, 'y': 300},
            'data': {
                'base_df': None,
                'operation': ['sql'],
                'inputs': [],
                'code': node_code,
                'metadata': [{'type': 'sql', 'query': query}],
                'parsed_by': 'ast',
            },
        }

    # ---- General chained-call case --------------------------------------
    chain = _dfs_calls(rhs)
    base_df = None
    bucket = defaultdict(list)
    joins = []
    op_sequence = []   # first-seen order, excluding 'join'
    input_dfs = set()

    for idx, call in enumerate(chain):
        f = call.func
        if not isinstance(f, cst.Attribute):
            continue
        op = f.attr.value

        # Always track base_df from leftmost Name — must happen before any skip
        if isinstance(f.value, cst.Name):
            base_df = f.value.value
            input_dfs.add(base_df)

        if op in _SKIP_OPS:
            continue

        if op not in op_sequence and op != 'join':
            op_sequence.append(op)

        args = call.args   # sequence of libcst.Arg

        def _get(i):          # positional helper
            return args[i].value if i < len(args) else None

        # ---- per-operation argument extraction --------------------------

        if op == 'select':
            bucket['select'].extend(
                _lit(a.value) or _src(a.value, module) for a in args
            )

        elif op == 'withColumn':
            if len(args) >= 2:
                bucket['withColumn'].append({
                    'column': _lit(_get(0)),
                    'expression': _src(_get(1), module),
                })

        elif op == 'withColumnRenamed':
            if len(args) >= 2:
                bucket['withColumnRenamed'].append({
                    'from': _lit(_get(0)),
                    'to': _lit(_get(1)),
                })

        elif op in ('where', 'filter'):
            if args:
                bucket[op].append(_src(_get(0), module))

        elif op in ('union', 'unionByName'):
            right = _get(0)
            union_with = (right.value if isinstance(right, cst.Name)
                          else _src(right, module))
            bucket[op].append({'unionWith': union_with, 'byName': op == 'unionByName'})
            if union_with:
                input_dfs.add(union_with)

        elif op in ('groupBy', 'groupby'):
            bucket['groupBy'].extend(
                _lit(a.value) or _src(a.value, module) for a in args
            )

        elif op == 'agg':
            for a in args:
                bucket['agg'].append(_parse_agg_arg(a.value, module))

        elif op in AGGREGATION_METHODS:
            args_src = [_src(a.value, module) for a in args]
            # look ahead one step for a chained .alias(...)
            alias = None
            if idx + 1 < len(chain):
                nxt = chain[idx + 1]
                if (isinstance(nxt.func, cst.Attribute)
                        and nxt.func.attr.value == 'alias'
                        and nxt.args):
                    alias = _lit(nxt.args[0].value)
            if not alias:
                alias = (f"{op}_{args_src[0].replace(chr(39), '')}"
                         if args_src else '')
            exp = f"{op}({', '.join(args_src) if args_src else '*'})"
            bucket['agg_function'].append({'expressions': exp, 'alias': alias})

        elif op == 'dropDuplicates':
            if args and isinstance(args[0].value, cst.List):
                cols = [_lit(e.value) or _src(e.value, module)
                        for e in args[0].value.elements]
            else:
                cols = [_lit(a.value) or _src(a.value, module) for a in args]
            bucket['dropDuplicates'] = cols

        elif op == 'distinct':
            bucket['distinct'] = True

        elif op == 'drop':
            bucket['drop'].extend(
                _lit(a.value) or _src(a.value, module) for a in args
            )

        elif op in ('orderBy', 'sort'):
            bucket['orderBy'].extend(_src(a.value, module) for a in args)

        elif op == 'limit':
            bucket['limit'] = _lit(_get(0)) if args else None

        elif op == 'fillna':
            bucket['fillna'] = _src(_get(0), module) if args else None

        elif op == 'dropna':
            bucket['dropna'] = True

        elif op in ('cache', 'persist'):
            bucket['cache'] = True

        elif op == 'pivot':
            pivot_col = (_lit(_get(0)) or _src(_get(0), module)) if args else None
            pivot_vals = []
            if len(args) > 1 and isinstance(args[1].value, cst.List):
                pivot_vals = [_lit(e.value) or _src(e.value, module)
                              for e in args[1].value.elements]
            bucket['pivot'].append({'column': pivot_col, 'values': pivot_vals})

        elif op in ('repartition', 'coalesce'):
            bucket['repartition'] = (
                (_lit(_get(0)) or _src(_get(0), module)) if args else None
            )

        elif op == 'join':
            right = _get(0)
            r_alias = None
            r_df = None
            is_broadcast = False

            if (isinstance(right, cst.Call)                         # broadcast(df).alias('b')
                    and isinstance(right.func, cst.Attribute)
                    and right.func.attr.value == 'alias'
                    and isinstance(right.func.value, cst.Call)
                    and isinstance(right.func.value.func, cst.Name)
                    and right.func.value.func.value == 'broadcast'):
                r_alias = _lit(right.args[0].value) if right.args else None
                r_df = right.func.value.args[0].value.value
                is_broadcast = True

            elif (isinstance(right, cst.Call)                       # df2.alias('b')
                  and isinstance(right.func, cst.Attribute)
                  and right.func.attr.value == 'alias'):
                r_alias = _lit(right.args[0].value) if right.args else None
                r_df = (right.func.value.value
                        if isinstance(right.func.value, cst.Name)
                        else _src(right.func.value, module))

            elif (isinstance(right, cst.Call)                       # broadcast(df)
                  and isinstance(right.func, cst.Name)
                  and right.func.value == 'broadcast'):
                r_df = right.args[0].value.value if right.args else None
                is_broadcast = True

            elif isinstance(right, cst.Name):
                r_df = right.value

            else:
                r_df = _src(right, module)

            # left-side alias: df1.alias('a').join(...)
            l_alias = None
            left_val = f.value
            if (isinstance(left_val, cst.Call)
                    and isinstance(left_val.func, cst.Attribute)
                    and left_val.func.attr.value == 'alias'
                    and left_val.args):
                l_alias = _lit(left_val.args[0].value)

            cond_node = _get(1) if len(args) > 1 else None
            cond = _src(cond_node, module) if cond_node else None
            if cond:
                cond = cond.replace(' & ', ' AND ').replace(' | ', ' OR ')
            jtype = _lit(_get(2)) if len(args) > 2 else 'inner'

            if r_df:
                input_dfs.add(r_df)
            joins.append({
                'type': 'join',
                'joinType': jtype,
                'table1': None,         # filled in below
                'table1Alias': l_alias,
                'table2': r_df,
                'table2Alias': r_alias,
                'condition': cond,
                'broadcast': is_broadcast,
            })



    # Resolve table1 for every join now that base_df is known
    for j in joins:
        j['table1'] = base_df

    # ---- Assemble metadata in call order --------------------------------
    meta = []
    for call in chain:
        f = call.func
        if isinstance(f, cst.Attribute) and f.attr.value == 'join':
            meta.extend(joins)

    for op in op_sequence:
        if op == 'withColumn':
            meta.append({'type': op, 'columns': bucket[op]})
        elif op == 'withColumnRenamed':
            meta.append({'type': op, 'columns': bucket[op]})
        elif op in ('where', 'filter'):
            meta.append({'type': op, 'conditions': bucket[op]})
        elif op == 'select':
            meta.append({'type': op, 'columns': bucket[op]})
        elif op in ('union', 'unionByName'):
            meta.append({'type': op, 'unions': bucket[op]})
        elif op in ('groupBy', 'groupby'):
            meta.append({'type': op, 'columns': bucket[op]})
        elif op == 'agg':
            meta.append({'type': 'agg', 'expressions': bucket['agg']})
        elif op == 'agg_function':
            for af in bucket['agg_function']:
                meta.append({'type': 'agg_function', **af})
        elif op == 'dropDuplicates':
            meta.append({'type': 'dropDuplicates', 'columns': bucket['dropDuplicates']})
        elif op == 'distinct':
            meta.append({'type': 'distinct'})
        elif op == 'drop':
            meta.append({'type': 'drop', 'columns': bucket['drop']})
        elif op in ('orderBy', 'sort'):
            meta.append({'type': 'orderBy', 'columns': bucket['orderBy']})
        elif op == 'limit':
            meta.append({'type': 'limit', 'value': bucket['limit']})
        elif op == 'fillna':
            meta.append({'type': 'fillna', 'value': bucket['fillna']})
        elif op == 'dropna':
            meta.append({'type': 'dropna'})
        elif op in ('cache', 'persist'):
            meta.append({'type': 'cache'})
        elif op == 'pivot':
            for p in bucket['pivot']:
                meta.append({'type': 'pivot', **p})
        elif op in ('repartition', 'coalesce'):
            meta.append({'type': 'repartition', 'value': str(bucket['repartition'])})

    # agg_function after groupBy — if not already emitted via op_sequence
    if 'agg_function' in bucket and 'agg_function' not in op_sequence:
        for af in bucket['agg_function']:
            meta.append({'type': 'agg_function', **af})

    return {
        'variable': target,
        'type': 'custom',
        'position': {'x': 300, 'y': 300},
        'data': {
            'base_df': base_df,
            'operation': [m['type'] for m in meta],
            'inputs': list(input_dfs),
            'code': node_code,
            'metadata': meta,
            'parsed_by': 'ast',
        },
    }


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def pyspark_to_flow(code: str):
    """
    Parse PySpark code into a graph of nodes and edges.

    Three-phase pipeline:
      1. Identify   — collect all df/variable assignments from the CST
      2. Build      — create node JSON for each df/variable; store in var_to_id map
      3. Edge       — create edges using the var_to_id snapshot at each node's creation
    """
    # Normalize double-backslash line continuations (\\<newline> → \<newline>).
    # This handles code copy-pasted from IDE views that display Python string
    # literals where \ is escaped as \\, so the pasted text has \\ instead of \.
    code = re.sub(r'\\\\\n', chr(92) + chr(10), code)

    try:
        module = cst.parse_module(code)
    except cst.ParserSyntaxError as exc:
        raise SyntaxError(str(exc)) from exc

    # --- Phase 1: Identify all df / variable assignments -----------------
    raw_stmts = _collect_assignments(module)

    # --- Phase 2: Build node JSON; populate var_to_id map ----------------
    nodes = []
    var_to_id = {}          # variable name → node id string
    node_id = 0
    #   keep (nid, target, base_df, metadata, snapshot) for edge phase
    node_records = []

    for target, stmt_line, stmt in raw_stmts:
        snapshot = dict(var_to_id)           # state BEFORE this node is registered
        node = _build_node(target, stmt_line, stmt, module)
        node['id'] = str(node_id)
        nodes.append(node)
        node_records.append((
            str(node_id),
            target,
            node['data']['base_df'],
            node['data']['metadata'],
            snapshot,
        ))
        var_to_id[target] = str(node_id)    # register AFTER snapshot
        node_id += 1

    # --- Phase 3: Create edges -------------------------------------------
    edges = []
    for nid, target, base_df, meta, snapshot in node_records:
        # base-df edge
        seen_sources = set()
        if base_df and base_df in snapshot:
            seen_sources.add(base_df)
            edges.append({
                'id': f"e_{base_df}_to_{target}",
                'source': snapshot[base_df],
                'target': nid,
            })
        # edges from every DataFrame operand referenced in this node's metadata
        for m in meta:
            mtype = m.get('type')

            if mtype == 'join':
                src_var = m.get('table2')
                if src_var and src_var in snapshot and src_var not in seen_sources:
                    seen_sources.add(src_var)
                    edges.append({
                        'id': f"e_{src_var}_to_{target}_join",
                        'source': snapshot[src_var],
                        'target': nid,
                    })

            elif mtype in ('union', 'unionByName'):
                for u in m.get('unions', []):
                    src_var = u.get('unionWith')
                    if src_var and src_var in snapshot and src_var not in seen_sources:
                        seen_sources.add(src_var)
                        edges.append({
                            'id': f"e_{src_var}_to_{target}_union",
                            'source': snapshot[src_var],
                            'target': nid,
                        })

    return {'nodes': nodes, 'edges': edges}


# ---------------------------------------------------------------------------
# Fallback-detection helper (used by graph_pipeline.py)
# ---------------------------------------------------------------------------

def _needs_ai_fallback(node: dict) -> bool:
    data = node.get('data', {})
    if not data.get('metadata'):
        return True
    if not data.get('operation'):
        return True
    if any(op == 'unknown' for op in data.get('operation', [])):
        return True
    if 'parsed_by' not in data:
        return True
    return False
