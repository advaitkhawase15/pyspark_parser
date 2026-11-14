import ast, json
from collections import defaultdict

def lit(n):
    if isinstance(n, ast.Constant):
        return n.value
    # Fallback for older Python versions
    if hasattr(ast, 'Str') and isinstance(n, ast.Str):
        return n.s
    if hasattr(ast, 'Num') and isinstance(n, ast.Num):
        return n.n
    return None

def src(node):
    # Returns source code for an AST node, if possible
    try: return ast.unparse(node)
    except: return None

def dfs_calls(call):
    # Traverses chained calls and returns them in order (base to top)
    stack = []
    cur = call
    while isinstance(cur, ast.Call):
        stack.append(cur)
        f = cur.func
        cur = f.value if isinstance(f, ast.Attribute) else None
    return list(reversed(stack))

# Set of aggregation method names
AGGREGATION_METHODS = {'count', 'max', 'min', 'avg', 'sum', 'mean'}

def parse_agg_arg(arg):
    # Returns (expression, alias) for agg() argument
    if isinstance(arg, ast.Call) and isinstance(arg.func, ast.Attribute) and arg.func.attr == "alias":
        # e.g., max(col('x')).alias('xmax')
        alias = lit(arg.args[0])
        exp = src(arg.func.value)
        return {"exp": exp, "alias": alias}
    else:
        # e.g., min('d'), max('c')
        return {"exp": src(arg), "alias": None}

def parse_agg_function_call(call):
    # Returns (function, arguments, alias) for .count(), .sum('x').alias('total'), etc.
    func_name = call.func.attr
    args = [src(a) for a in call.args]
    alias = None
    # Handle alias: .count().alias('cnt')
    if isinstance(call.parent, ast.Call) and isinstance(call.parent.func, ast.Attribute) and call.parent.func.attr == "alias":
        alias = lit(call.parent.args[0])
    return func_name, args, alias

def pyspark_to_flow(code: str):
    # Parse the code into AST
    t = ast.parse(code)
    nodes, edges = [], []
    node_id = 0  # Unique integer id for each node
    var_to_id = {}  # Maps variable name to node id

    # Patch AST nodes to have parent links (for alias detection in parse_agg_function_call)
    for node in ast.walk(t):
        for child in ast.iter_child_nodes(node):
            child.parent = node
       
    # Process each assignment in the code
    for stmt in t.body:
        if not isinstance(stmt, ast.Assign):
            continue # Skip non-assignment statements
        
        target = stmt.targets[0].id  # The variable being assigned
        chain = dfs_calls(stmt.value)  # The chain of calls for this assignment
        base_df = None  # The base DataFrame variable name
        bucket = defaultdict(list)  # Collects arguments for each operation
        joins = []  # List to store join information
        op_sequence = []  # Order of operations for this statement
        input_dfs = set()  # Set of all DataFrames used as input

        
        # Traverse the call chain and collect operation details
        for idx, call in enumerate(chain):
            f = call.func
            op = f.attr
            if op not in op_sequence and op != 'join':
                op_sequence.append(op)

            # Collect arguments for each operation type
            if op == 'select':
                bucket['select'].extend(lit(a) or src(a) for a in call.args)
            elif op == 'withColumn':
                bucket['withColumn'].append({'column': lit(call.args[0]), 'expression': src(call.args[1])})
            elif op == 'withColumnRenamed':
                bucket['withColumnRenamed'].append({'from': lit(call.args[0]), 'to': lit(call.args[1])})
            elif op in ('where', 'filter'):
                bucket[op].append(src(call.args[0]))
            elif op in ('union', 'unionByName'):
                bucket[op].append({'unionWith': f.value.id, 'byName': op == 'unionByName'})
            elif op in ('groupBy', 'groupby'):
                bucket['groupBy'].extend(lit(a) or src(a) for a in call.args)
            elif op == 'agg':
                for a in call.args:
                    bucket['agg'].append(parse_agg_arg(a))
            elif op in AGGREGATION_METHODS:
                # Only treat as aggregation if after groupBy
                # if idx > 0 and chain[idx-1].func.attr in ('groupBy', 'groupby'):
                func_name, args, alias = parse_agg_function_call(call)
                if not alias:
                    if args:
                        clean_arg = args[0].replace("'", "")
                        alias = f"{func_name}_{clean_arg}"
                    else:
                        alias = ""
                exp = f"{func_name}({', '.join(args) if args else '*'})"
                bucket['agg_function'].append({'expressions': exp, 'alias': alias})
            elif op == 'join':
                # Process join: extract left/right DataFrames, aliases, join type, and condition
                right = call.args[0]
                r_alias = None
                r_df = None
                is_broadcast = False
            
                # Handle broadcast join: broadcast(df).alias('b')
                if (
                    isinstance(right, ast.Call)
                    and isinstance(right.func, ast.Attribute)
                    and right.func.attr == 'alias'
                    and isinstance(right.func.value, ast.Call)
                    and isinstance(right.func.value.func, ast.Name)
                    and right.func.value.func.id == 'broadcast'
                ):
                    # right = broadcast(df).alias('b')
                    r_alias = lit(right.args[0])
                    r_df = right.func.value.args[0].id  # The df inside broadcast()
                    is_broadcast = True
                # Handle normal alias: df2.alias('b')
                elif isinstance(right, ast.Call) and isinstance(right.func, ast.Attribute) and right.func.attr == 'alias':
                    r_alias = lit(right.args[0])
                    r_df = right.func.value.id
                # Handle broadcast(df) without alias
                elif (
                    isinstance(right, ast.Call)
                    and isinstance(right.func, ast.Name)
                    and right.func.id == 'broadcast'
                ):
                    r_df = right.args[0].id
                    is_broadcast = True
                else:
                    r_alias = None
                    r_df = right.id
            
                # Left alias detection (for left table)
                l_alias = None
                if (
                    isinstance(f.value, ast.Call)
                    and isinstance(f.value.func, ast.Attribute)
                    and f.value.func.attr == 'alias'
                ):
                    l_alias = lit(f.value.args[0])
            
                cond = src(call.args[1]) if len(call.args) > 1 else None
                if cond:
                    cond = cond.replace(' & ', ' AND ').replace(' | ', ' OR ')
                jtype = lit(call.args[2]) if len(call.args) > 2 else 'inner'
            
                # Add right table to input DataFrames
                input_dfs.add(r_df)
                joins.append({
                    'type': 'join',
                    'joinType': jtype,
                    'table1': None,  # Will be set to base_df below
                    'table1Alias': l_alias,
                    'table2': r_df,
                    'table2Alias': r_alias,
                    'condition': cond,
                    'broadcast': is_broadcast  # <-- Mark if this is a broadcast join
                })

            # Detect base DataFrame and add to input_dfs
            if isinstance(f.value, ast.Name):
                base_df = f.value.id
                input_dfs.add(base_df)

        # For all joins, set table1 to base_df
        for j in joins:
            j['table1'] = base_df
            
        meta = []
        # Insert joins in order
        for call in chain:
            if call.func.attr == 'join':
                meta.extend(joins)

        # Insert other operations in order, using collected arguments
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
                for agg_func in bucket['agg_function']:
                    meta.append({'type': 'agg_function', **agg_func})
            # elif op != 'join':  # join already handled
            #     meta.append({'type': op})

        # Add any agg_function not already in op_sequence (for single agg after groupby)
        if 'agg_function' in bucket and 'agg_function' not in op_sequence:
            for agg_func in bucket['agg_function']:
                meta.append({'type': 'agg_function', **agg_func})
                
        node_code = ast.get_source_segment(code, stmt)
        nodes.append({'id': str(node_id),
                      'variable': target,
                      'position': {'x':300,'y':300},
                      'data': {'base_df': base_df,
                               'operation': [m['type'] for m in meta],
                               'inputs': list(input_dfs),  # All DataFrames used
                               'code': node_code,          # The code for this node
                               'metadata': meta}})
        #base_df edge
        if base_df in var_to_id:
            edges.append({'id': f"e_{base_df}_to_{target}",
                          'source': var_to_id[base_df],
                          'target': str(node_id)})
        #Join edges
        for join in joins:
            if  join['table2'] in var_to_id:
                edges.append({'id': f"e_{join['table2']}_to_{target}_join_right",
                              'source': var_to_id[join['table2']],
                              'target': str(node_id)
                             }) 
        var_to_id[target] = str(node_id)
        node_id += 1
    return {'nodes': nodes, 'edges': edges}

# demo --------------------------------------------------------------
code = """
    from pyspark.sql.functions import col, when, length, lpad, row_number, date_format
    from pyspark.sql.window import Window

    # ---------------------------------------------------------
    # Variables (from node_variable)
    # ---------------------------------------------------------
    var1 = 'some_valueewrw'
    input_path = '/mnt/adls/folder1'
    threshold = '0.8'

    # ---------------------------------------------------------
    # Node 0: it_base_zprc_with_mer_pos_agent
    # ---------------------------------------------------------
    it_base_zprc_with_mer_pos_agent = it_base_zprc_with_zpro_header.alias('zprc') \
        .join(it_order_caf_add_union.alias('b'),
            (col('zprc.order_id') == col('b.order_id')) & (col('zprc.yyext_ref_num') == col('b.ext_ref_num')), 'left') \
        .select(
            'zprc.*',
            'b.merchant_code', 
            'b.pos_agent_code', 
            col('b.kf_current_ts').alias('order_caf_add_kf_current_ts')
        ) \
        .withColumn("merchant_code",
            when((length(col('merchant_code')) < 10) & (col('merchant_code').substr(1,1) >= '0') & (col('merchant_code').substr(1,1) <= '9'), lpad(col('merchant_code'),10,'0'))
            .otherwise(col('merchant_code'))
        ) \
        .withColumn("pos_agent_code",
            when((length(col('pos_agent_code')) < 10) & (col('pos_agent_code').substr(1,1) >= '0') & (col('pos_agent_code').substr(1,1) <= '9'), lpad(col('pos_agent_code'),10,'0'))
            .otherwise(col('pos_agent_code'))
        )

    # ---------------------------------------------------------
    # Node 1: it_base_zprc_with_ekyc_flag
    # ---------------------------------------------------------
    it_base_zprc_with_ekyc_flag = it_base_zprc_with_mer_pos_agent.alias('zprc') \
        .join(it_order_profdet_union.alias('b'),
            (col('zprc.order_id') == col('b.order_id')) & (col('zprc.yyext_ref_num') == col('b.ext_ref_num')), 'left') \
        .select(
            'zprc.*',
            col('b.ekyc_flag').alias('ekyc_flag_c'),
            col('b.kf_current_ts').alias('opf_kf_current_ts')
        )

    # ---------------------------------------------------------
    # Node 2: it_order_item_status_ois_lkp
    # ---------------------------------------------------------
    it_order_item_status_ois_lkp = it_self_lookup_data.select(
        "order_id", "order_item_no", "zpro_item_status", "ois_zpro_item_status_created_at", "ois_kf_current_ts"
    )

    # ---------------------------------------------------------
    # Node 3 & 4: it_order_item_status_ois
    # ---------------------------------------------------------
    it_order_item_status_ois = it_order_status \
        .where(col('status_id').isin('Z01','Z02','Z04','Z05','Z06','Z07','Z08','Z10','Z11','Z12','Z15','ZM90'))

    it_order_item_status_ois = it_order_item_status_ois.select(
        "order_id", "item_no", "status_id", "zpro_item_status_created_at", "kf_current_ts"
    )

    # ---------------------------------------------------------
    # Node 5: it_order_item_status
    # ---------------------------------------------------------
    it_order_item_status = it_order_item_status_ois.union(it_order_item_status_ois_lkp) \
        .withColumn('rh_order_item_status_row',
            row_number().over(Window.partitionBy(col('order_id'),col('item_no'))
            .orderBy(col('kf_current_ts').desc()))) \
        .where(col('rh_order_item_status_row') <= int(1))

    # ---------------------------------------------------------
    # Node 6: it_base_zprc_with_zpro_item_status
    # ---------------------------------------------------------
    it_base_zprc_with_zpro_item_status = it_base_zprc_with_ekyc_flag.alias('zprc') \
        .join(it_order_item_status.alias('b'),
            (col('zprc.order_id') == col('b.order_id')) & (col('zprc.order_item_no') == col('b.item_no')), 'left') \
        .select(
            'zprc.*',
            'b.status_id', 
            'b.zpro_item_status_created_at',
            col('b.kf_current_ts').alias('ois_kf_current_ts')
        ) \
        .withColumn('zpro_item_date', date_format(col('zpro_item_status_created_at'),'yyyyMMdd')) \
        .withColumn('zpro_item_time', date_format(col('zpro_item_status_created_at'),'HHmmss')) \
        .withColumn('zpro_item_datetime', date_format(col('zpro_item_status_created_at'),'yyyyMMddHHmmss')) \
        .withColumnRenamed('status_id','zpro_item_status') \
        .withColumnRenamed('zpro_item_status_created_at','ois_zpro_item_status_created_at')

    # ---------------------------------------------------------
    # Node: node_it_base_zprc_with_zpro_item_dates
    # ---------------------------------------------------------
    it_zprc_with_s1_logic = it_zprc_with_service_no_and_msisdn_enc.alias('zprc') \
        .join(it_yhp_partner_master.alias('b'),
            (col('zprc.merchant_code')==col('b.partnerid')), 'left') \
        .select(
            'zprc.*',
            'b.r4j_state_code',
            col('b.jio_center').alias('jio_center_s1'),
            col('b.partner_name').alias('partner_name_s1'),
            col('b.city1').alias('city1_s1'),
            col('b.region').alias('region_s1'),
            col('b.post_code1').alias('post_code1_s1'),
            col('b.jc_name').alias('jc_name_s1'),
            col('b.r4j_state_code').alias('r4j_state_code_s1'),
            col('b.circle_id').alias('circle_id_s1'), 
            col('b.circle_name').alias('circle_name_s1')
        )

    # ---------------------------------------------------------
    # Subsequent Test/Mock Nodes
    # (Extracted from node_1, node_2, node_4, node_3, etc.)
    # ---------------------------------------------------------

    # Note: The JSON array reuses this assignment across multiple test nodes (1, 2, 3, 4)
    it_base_zprc_with_ekyc_flag = it_base_zprc_with_mer_pos_agent.alias('zprc')

    # Node 5 & 50
    df_filtered = df3.filter(df3['created_on'] > '20240101')

    # Node 6 (Secondary)
    df_selected = df3.select('id', 'name')

    # Node 1_5
    df_intermediate = df1.select('id', 'name', 'created_at')
"""

if __name__ == "__main__":
    print(json.dumps(pyspark_to_flow(code), indent=2, default=str))
