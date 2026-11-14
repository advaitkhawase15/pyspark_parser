// App.jsx
import { useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import CustomNode from './components/CustomNode';
import RightPanel from './components/RightPanel';
import { getLayoutedElements } from './utils/getLayoutedElements';
import CustomToolbar from './components/CustomToolbar';

const nodeTypes = { custom: CustomNode };

const graphData = JSON.parse(localStorage.getItem('graph_data'));
const initialNodes = graphData?.nodes || [];
const initialNodess = [
  {
    id: '0',
    variable: 'it_base_zprc_with_mer_pos_agent',
    type: 'custom',
    position: {
      x: 300,
      y: 300,
    },
    data: {
      base_df: 'it_base_zprc_with_zpro_header',
      operation: ['join', 'select', 'withColumn'],
      inputs: ['it_base_zprc_with_zpro_header', 'it_order_caf_add_union'],
      code: "it_base_zprc_with_mer_pos_agent = it_base_zprc_with_zpro_header.alias('zprc')    .join(it_order_caf_add_union.alias('b'),\n        (col('zprc.order_id') == col('b.order_id')) & (col('zprc.yyext_ref_num') == col('b.ext_ref_num')), 'left')     .select(\n        'zprc.*'\n        ,'b.merchant_code', 'b.pos_agent_code'\n        , col('b.kf_current_ts').alias('order_caf_add_kf_current_ts')\n        )    .withColumn(\"merchant_code\",\n        when((length(col('merchant_code')) < 10) & (col('merchant_code').substr(1,1) >= '0') & (col('merchant_code').substr(1,1) <= '9'),lpad(col('merchant_code'),10,'0'))\n        .otherwise(col('merchant_code'))\n        )    .withColumn(\"pos_agent_code\",\n        when((length(col('pos_agent_code')) < 10) & (col('pos_agent_code').substr(1,1) >= '0') & (col('pos_agent_code').substr(1,1) <= '9'),lpad(col('pos_agent_code'),10,'0'))\n        .otherwise(col('pos_agent_code'))\n        )",
      metadata: [
        {
          type: 'join',
          joinType: 'left',
          table1: 'it_base_zprc_with_zpro_header',
          table1Alias: 'zprc',
          table2: 'it_order_caf_add_union',
          table2Alias: 'b',
          condition:
            "(col('zprc.order_id') == col('b.order_id')) AND (col('zprc.yyext_ref_num') == col('b.ext_ref_num'))",
        },
        {
          type: 'select',
          columns: [
            'zprc.*',
            'b.merchant_code',
            'b.pos_agent_code',
            "col('b.kf_current_ts').alias('order_caf_add_kf_current_ts')",
          ],
        },
        {
          type: 'withColumn',
          columns: [
            {
              column: 'merchant_code',
              expression:
                "when((length(col('merchant_code')) < 10) & (col('merchant_code').substr(1, 1) >= '0') & (col('merchant_code').substr(1, 1) <= '9'), lpad(col('merchant_code'), 10, '0')).otherwise(col('merchant_code'))",
            },
            {
              column: 'pos_agent_code',
              expression:
                "when((length(col('pos_agent_code')) < 10) & (col('pos_agent_code').substr(1, 1) >= '0') & (col('pos_agent_code').substr(1, 1) <= '9'), lpad(col('pos_agent_code'), 10, '0')).otherwise(col('pos_agent_code'))",
            },
          ],
        },
      ],
    },
  },
  {
    id: '1',
    variable: 'it_base_zprc_with_ekyc_flag',
    type: 'custom',
    position: {
      x: 300,
      y: 300,
    },
    data: {
      base_df: 'it_base_zprc_with_mer_pos_agent',
      operation: ['join', 'select'],
      inputs: ['it_base_zprc_with_mer_pos_agent', 'it_order_profdet_union'],
      code: "it_base_zprc_with_ekyc_flag = it_base_zprc_with_mer_pos_agent.alias('zprc')    .join(it_order_profdet_union.alias('b'),\n        (col('zprc.order_id') == col('b.order_id')) & (col('zprc.yyext_ref_num') == col('b.ext_ref_num')), 'left')     .select(\n        'zprc.*'\n        ,col('b.ekyc_flag').alias('ekyc_flag_c')\n        ,col('b.kf_current_ts').alias('opf_kf_current_ts')\n        )",
      metadata: [
        {
          type: 'join',
          joinType: 'left',
          table1: 'it_base_zprc_with_mer_pos_agent',
          table1Alias: 'zprc',
          table2: 'it_order_profdet_union',
          table2Alias: 'b',
          condition:
            "(col('zprc.order_id') == col('b.order_id')) AND (col('zprc.yyext_ref_num') == col('b.ext_ref_num'))",
        },
        {
          type: 'select',
          columns: [
            'zprc.*',
            "col('b.ekyc_flag').alias('ekyc_flag_c')",
            "col('b.kf_current_ts').alias('opf_kf_current_ts')",
          ],
        },
      ],
    },
  },
  {
    id: '2',
    variable: 'it_order_item_status_ois_lkp',
    type: 'custom',
    position: {
      x: 300,
      y: 300,
    },
    data: {
      base_df: 'it_self_lookup_data',
      operation: ['select'],
      inputs: ['it_self_lookup_data'],
      code: 'it_order_item_status_ois_lkp = it_self_lookup_data.select("order_id", "order_item_no", "zpro_item_status", "ois_zpro_item_status_created_at", "ois_kf_current_ts")',
      metadata: [
        {
          type: 'select',
          columns: [
            'order_id',
            'order_item_no',
            'zpro_item_status',
            'ois_zpro_item_status_created_at',
            'ois_kf_current_ts',
          ],
        },
      ],
    },
  },
  {
    id: '3',
    variable: 'it_order_item_status_ois',
    type: 'custom',
    position: {
      x: 300,
      y: 300,
    },
    data: {
      base_df: 'it_order_status',
      operation: ['where'],
      inputs: ['it_order_status'],
      code: "it_order_item_status_ois = it_order_status    .where(col('status_id').isin('Z01','Z02','Z04','Z05','Z06','Z07','Z08','Z10','Z11','Z12','Z15','ZM90'))",
      metadata: [
        {
          type: 'where',
          conditions: [
            "col('status_id').isin('Z01', 'Z02', 'Z04', 'Z05', 'Z06', 'Z07', 'Z08', 'Z10', 'Z11', 'Z12', 'Z15', 'ZM90')",
          ],
        },
      ],
    },
  },
  {
    id: '4',
    variable: 'it_order_item_status_ois',
    type: 'custom',
    position: {
      x: 300,
      y: 300,
    },
    data: {
      base_df: 'it_order_item_status_ois',
      operation: ['select'],
      inputs: ['it_order_item_status_ois'],
      code: 'it_order_item_status_ois = it_order_item_status_ois.select("order_id", "item_no", "status_id", "zpro_item_status_created_at", "kf_current_ts")',
      metadata: [
        {
          type: 'select',
          columns: [
            'order_id',
            'item_no',
            'status_id',
            'zpro_item_status_created_at',
            'kf_current_ts',
          ],
        },
      ],
    },
  },
  {
    id: '5',
    variable: 'it_order_item_status',
    type: 'custom',
    position: {
      x: 300,
      y: 300,
    },
    data: {
      base_df: 'it_order_item_status_ois',
      operation: ['union', 'withColumn', 'where'],
      inputs: ['it_order_item_status_ois'],
      code: "it_order_item_status = it_order_item_status_ois.union(it_order_item_status_ois_lkp)        .withColumn('rh_order_item_status_row',\n            row_number().over(Window.partitionBy(col('order_id'),col('item_no'))\n            .orderBy(col('kf_current_ts').desc())))        .where(col('rh_order_item_status_row')<=int(1))",
      metadata: [
        {
          type: 'union',
          unions: [
            {
              unionWith: 'it_order_item_status_ois',
              byName: false,
            },
          ],
        },
        {
          type: 'withColumn',
          columns: [
            {
              column: 'rh_order_item_status_row',
              expression:
                "row_number().over(Window.partitionBy(col('order_id'), col('item_no')).orderBy(col('kf_current_ts').desc()))",
            },
          ],
        },
        {
          type: 'where',
          conditions: ["col('rh_order_item_status_row') <= int(1)"],
        },
      ],
    },
  },
  {
    id: '6',
    variable: 'it_base_zprc_with_zpro_item_status',
    type: 'custom',
    position: {
      x: 300,
      y: 300,
    },
    data: {
      base_df: 'it_base_zprc_with_ekyc_flag',
      operation: ['join', 'select', 'withColumn', 'withColumnRenamed'],
      inputs: ['it_order_item_status', 'it_base_zprc_with_ekyc_flag'],
      code: "it_base_zprc_with_zpro_item_status = it_base_zprc_with_ekyc_flag.alias('zprc')    .join(it_order_item_status.alias('b'),\n        (col('zprc.order_id') == col('b.order_id')) & (col('zprc.order_item_no') == col('b.item_no')), 'left')     .select(\n        'zprc.*'\n        ,'b.status_id', 'b.zpro_item_status_created_at'\n        ,col('b.kf_current_ts').alias('ois_kf_current_ts')\n        )    .withColumn('zpro_item_date',date_format(col('zpro_item_status_created_at'),'yyyyMMdd'))    .withColumn('zpro_item_time',date_format(col('zpro_item_status_created_at'),'HHmmss'))    .withColumn('zpro_item_datetime',date_format(col('zpro_item_status_created_at'),'yyyyMMddHHmmss'))    .withColumnRenamed('status_id','zpro_item_status')    .withColumnRenamed('zpro_item_status_created_at','ois_zpro_item_status_created_at')",
      metadata: [
        {
          type: 'join',
          joinType: 'left',
          table1: 'it_base_zprc_with_ekyc_flag',
          table1Alias: 'zprc',
          table2: 'it_order_item_status',
          table2Alias: 'b',
          condition:
            "(col('zprc.order_id') == col('b.order_id')) AND (col('zprc.order_item_no') == col('b.item_no'))",
        },
        {
          type: 'select',
          columns: [
            'zprc.*',
            'b.status_id',
            'b.zpro_item_status_created_at',
            "col('b.kf_current_ts').alias('ois_kf_current_ts')",
          ],
        },
        {
          type: 'withColumn',
          columns: [
            {
              column: 'zpro_item_date',
              expression:
                "date_format(col('zpro_item_status_created_at'), 'yyyyMMdd')",
            },
            {
              column: 'zpro_item_time',
              expression:
                "date_format(col('zpro_item_status_created_at'), 'HHmmss')",
            },
            {
              column: 'zpro_item_datetime',
              expression:
                "date_format(col('zpro_item_status_created_at'), 'yyyyMMddHHmmss')",
            },
          ],
        },
        {
          type: 'withColumnRenamed',
          columns: [
            {
              from: 'status_id',
              to: 'zpro_item_status',
            },
            {
              from: 'zpro_item_status_created_at',
              to: 'ois_zpro_item_status_created_at',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'read_orders',
    type: 'custom',
    variable: 'orders_df',
    position: { x: 0, y: 0 },
    data: {
      operation: 'read',
      inputs: [],
      metadata: [{ type: 'read', path: 'data/orders.csv', format: 'csv' }],
    },
  },
  {
    id: 'select_orders',
    type: 'custom',
    variable: 'orders_sel',
    position: { x: 300, y: 0 },
    data: {
      operation: 'select',
      inputs: ['orders_df'],
      main_df: 'it_base_zprc_with_ekyc_flag',
      metadata: [
        { type: 'select', columns: ['order_id', 'customer_id', 'order_date'] },
      ],
    },
  },
  {
    id: 'with_col_order_year',
    type: 'custom',
    variable: 'orders_with_year',
    position: { x: 600, y: 0 },
    data: {
      operation: 'withColumn',
      inputs: ['orders_sel'],
      main_df: 'it_base_zprc_with_ekyc_flag',
      metadata: [
        {
          type: 'withColumn',
          column: 'order_year',
          expression: "year(col('order_date'))",
        },
      ],
    },
  },

  {
    id: 'join_orders_customers',
    type: 'custom',
    variable: 'orders_joined',
    position: { x: 600, y: 100 },
    data: {
      operation: 'join',
      inputs: ['orders_with_year', 'cust_renamed'],
      main_df: 'it_base_zprc_with_ekyc_flag',
      metadata: [
        {
          type: 'join',
          joinType: 'right',
          table1: 'it_base_zprc_with_ekyc_flag',
          table1Alias: 'zprc',
          table2: 'it_order_item_status',
          table2Alias: 'b',
          conditions: [
            "col('zprc.order_id') == col('b.order_id') AND col('zprc.order_item_no') == col('b.item_no')",
          ],
        },
      ],
    },
  },

  {
    id: 'node_it_base_zprc_with_zpro_item_status',
    type: 'custom',
    variable: 'it_base_zprc_with_zpro_item_status',
    position: { x: 600, y: 300 },
    data: {
      operation: ['filter', 'withColumnRenamed'],
      inputs: [
        'it_base_zprc_with_ekyc_flag',
        'it_order_item_status',
        'it_base_zprc_with_ekyc_flag',
        'it_order_item_status',
      ],
      main_df: 'it_base_zprc_with_ekyc_flag',
      metadata: [
        {
          type: 'join',
          joinType: 'left',
          table1: 'it_base_zprc_with_ekyc_flag',
          table1Alias: 'zprc',
          table2: 'it_order_item_status',
          table2Alias: 'b',
          conditions: [
            "(col('zprc.order_id') == col('b.order_id')) & (col('zprc.order_item_no') == col('b.item_no'))",
          ],
        },
        {
          type: 'select',
          columns: [
            'zprc.*',
            'b.status_id',
            'b.zpro_item_status_created_at',
            "col('b.kf_current_ts').alias('ois_kf_current_ts')",
          ],
        },
        {
          type: 'withColumn',
          column: 'zpro_item_date',
          expression:
            "date_format(col('zpro_item_status_created_at'),'yyyyMMdd')",
        },
        {
          type: 'withColumnRenamed',
          columns: [
            { from: 'status_id', to: 'zpro_item_status' },
            {
              from: 'zpro_item_status_created_at',
              to: 'ois_zpro_item_status_created_at',
            },
          ],
        },
        {
          type: 'filter',
          conditions: ["col('rh_order_item_status_row') <= int(1)"],
        },

        {
          type: 'withColumn',
          columns: [
            {
              column: 'created_at',
              expression:
                "regexp_replace(col('created_at').substr(1, 19), 'T', ' ')",
            },
            {
              column: 'created_on',
              expression: "date_format(col('created_at'), 'yyyyMMdd')",
            },
            {
              column: 'created_on_time',
              expression: "date_format(col('created_at'), 'HHmmss')",
            },
            {
              column: 'created_on_datetime',
              expression: "date_format(col('created_at'), 'yyyyMMddHHmmss')",
            },
            {
              column: 'creation_date',
              expression: "date_format(col('created_at'), 'yyyy-MM-dd')",
            },
            {
              column: 'creation_time',
              expression: "date_format(col('created_at'), 'HH:mm:ss')",
            },
          ],
        },
      ],
    },
  },
  {
    id: 'node_it_base_zprc_with_zpro_item_dates',
    type: 'custom',
    variable: 'it_base_zprc_with_zpro_item_dates',
    position: {
      x: 300,
      y: 300,
    },
    data: {
      operation: ['filter', 'join', 'union', 'groupby', 'agg'],
      inputs: ['it_base_zprc_with_latest_zprc_status_desc'],
      main_df: 'it_base_zprc_with_ekyc_flag',
      code: `it_zprc_with_s1_logic = it_zprc_with_service_no_and_msisdn_enc.alias('zprc')\
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
      
      `,
      metadata: [
        {
          type: 'custom',
          operation: `.withColumn('rh_it_order_item_row',
          row_number().over(Window.partitionBy(col('order_id'),col('parent_item_no'))
          .orderBy(col('kf_current_ts').desc())))\ `,
        },
        {
          type: 'join',
          joinType: 'left',
          table1: 'it_base_zprc_with_latest_zprc_status_desc',
          table1Alias: 'zprc',
          table2: 'it_order_item_status_dates_aggr',
          table2Alias: 'b',
          conditions: [
            "(col('zprc.order_id') == col('b.order_id')) AND (col('zprc.order_item_no') == col('b.item_no'))",
          ],
        },
        {
          type: 'union',
          unions: [
            {
              unionWith: 'df hu mai fdsdfoidsfsadfds dsoifsaifua',
              byName: true,
            },
            { unionWith: 'df3', byName: false },
          ],
        },
        {
          type: 'groupby',
          columns: ['order_id', 'sys_id'],
        },
        {
          type: 'agg',
          expressions: [
            {
              exp: "max(col('x'))max(col('x'))max(col('x'))max(col('x'))max(col('x'))",
              alias: 'sdf',
            },
            { exp: "max(col('y'))", alias: 'pank2' },
          ],
        },
        {
          type: 'agg_function',
          expressions: 'count(*)max(col())count(*)max(col())count(*)max(col())',
          alias: 'some_aliascount(*)max(col())',
        },
        {
          type: 'select',
          columns: [
            'b.agent_code',
            'b.tv_pend_date',
            'b.tv_pend_datetime',
            'b.tv_pend_time',
            'b.tv_rej_date',
            'b.tv_rej_time',
            'b.tv_suc_date',
            'b.tv_suc_time',
            'b.tv_suc_timestamp',
            'tv_rej_timestamp',
            'zprc.*',
          ],
        },
        {
          type: 'withColumn',
          columns: [
            {
              column: 'mandt',
              expression: "lit('CE1')",
            },
            {
              column: 'tv_status',
              expression:
                "when(col('tv_suc_date').isNotNull() & (col('agent_code') != ''), lit('AGENT')).when(col('tv_suc_date').isNotNull() & (col('agent_code') == ''), lit('IVR')).when(col('tv_suc_date').isNotNull() & col('agent_code').isNull(), lit('IVR')).otherwise(lit('NA'))",
            },
          ],
        },
        {
          type: 'filter',
          conditions: ["col('tv_rej_timestamp').isNotNull()"],
        },
        {
          type: 'withColumnRenamed',
          columns: [
            { from: 'id', to: 'customer_id' },
            { from: 'name', to: 'customer_name' },
          ],
        },
        {
          type: 'withColumnRenamed',
          columns: [
            {
              from: 'circle_id',
              to: 'yycircle_id',
            },
            {
              from: 'contract_desc',
              to: 'prod_desc',
            },
            {
              from: 'item_no',
              to: 'item_no_zprc',
            },
            {
              from: 'item_type',
              to: 'itm_type',
            },
            {
              from: 'product_id',
              to: 'ordered_prod',
            },
          ],
        },
      ],
    },
  },
  {
    id: 'node_1',
    type: 'custom',
    variable: 'df1',
    position: { x: 100, y: 300 },
    data: {
      operation: ['select'],
      inputs: [],
      code: "it_base_zprc_with_ekyc_flag = it_base_zprc_with_mer_pos_agent.alias('zprc')",
      metadata: [
        {
          type: 'select',
          columns: ['id', 'name', 'created_at'],
        },
      ],
      columns: {
        id: {
          sources: [{ prev_node: 'node_1', prev_col: 'id' }],
          type: 'direct',
        },
        name: {
          sources: [{ prev_node: 'node_1', prev_col: 'name' }],
          type: 'direct',
        },
        created_at: {
          sources: [{ prev_node: 'node_1', prev_col: 'created_at' }],
          type: 'direct',
        },
      },
    },
  },
  {
    id: 'node_2',
    type: 'custom',
    variable: 'df2',
    position: { x: 400, y: 200 },
    data: {
      operation: ['withColumn'],
      inputs: ['df1'],
      code: "it_base_zprc_with_ekyc_flag = it_base_zprc_with_mer_pos_agent.alias('zprc')",
      metadata: [
        {
          type: 'withColumn',
          columns: [
            {
              column: 'created_on',
              expression: "date_format(col('created_at'), 'yyyyMMdd')",
            },
            {
              column: 'created_on_time',
              expression: "date_format(col('created_at'), 'HHmmss')",
            },
          ],
        },
      ],
      columns: {
        id: {
          sources: [{ prev_node: 'node_1', prev_col: 'id' }],
          type: 'direct',
        },
        name: {
          sources: [{ prev_node: 'node_1', prev_col: 'name' }],
          type: 'direct',
        },
        created_at: {
          sources: [{ prev_node: 'node_1', prev_col: 'created_at' }],
          type: 'direct',
        },
        // created_on: {
        //   sources: [{ prev_node: 'node_1', prev_col: 'created_at' }],
        //   type: 'derived',
        //   transformation: "date_format(col('created_at'), 'yyyyMMdd')",
        // },
        created_on_time: {
          sources: [{ prev_node: 'node_1', prev_col: 'created_at' }],
          type: 'derived',
          transformation: "date_format(col('created_at'), 'HHmmss')",
        },
      },
    },
  },
  {
    id: 'node_4',
    type: 'custom',
    variable: 'df4',
    position: { x: 400, y: 400 },
    data: {
      operation: ['withColumnRenamed'],
      inputs: ['df1'],
      code: "it_base_zprc_with_ekyc_flag = it_base_zprc_with_mer_pos_agent.alias('zprc')",
      metadata: [
        {
          type: 'withColumnRenamed',
          columns: [
            { from: 'id', to: 'user_id' },
            { from: 'name', to: 'user_name' },
          ],
        },
      ],
      columns: {
        user_id: {
          sources: [{ prev_node: 'node_1_5', prev_col: 'id' }],
          type: 'renamed',
          transformation: 'id -> user_id',
        },
        user_name: {
          sources: [{ prev_node: 'node_1_5', prev_col: 'name' }],
          type: 'renamed',
          transformation: 'name -> user_name',
        },
        created_at: {
          sources: [{ prev_node: 'node_1_5', prev_col: 'created_at' }],
          type: 'direct',
        },
      },
    },
  },
  {
    id: 'node_3',
    type: 'custom',
    variable: 'df3',
    position: { x: 700, y: 300 },
    data: {
      operation: ['union'],
      inputs: ['df2', 'df4'],
      code: "it_base_zprc_with_ekyc_flag = it_base_zprc_with_mer_pos_agent.alias('zprc')",
      metadata: [
        {
          type: 'union',
          unions: [
            { unionWith: 'df2', byName: true },
            { unionWith: 'df4', byName: true },
          ],
        },
      ],
      columns: {
        id: {
          sources: [
            { prev_node: 'node_2', prev_col: 'id' },
            { prev_node: 'node_4', prev_col: 'user_id' },
          ],
          type: 'direct',
        },
        name: {
          sources: [
            { prev_node: 'node_2', prev_col: 'name' },
            { prev_node: 'node_4', prev_col: 'user_name' },
          ],
          type: 'direct',
        },
        created_at: {
          sources: [
            { prev_node: 'node_2', prev_col: 'created_at' },
            { prev_node: 'node_4', prev_col: 'created_at' },
          ],
          type: 'direct',
        },
        created_on: {
          sources: [{ prev_node: 'node_2', prev_col: 'created_on' }],
          type: 'direct',
        },
        created_on_time: {
          sources: [{ prev_node: 'node_2', prev_col: 'created_on_time' }],
          type: 'direct',
        },
      },
    },
  },
  {
    id: 'node_5',
    type: 'custom',
    variable: 'df_filtered',
    position: { x: 1000, y: 200 }, // Top-right of node_3
    data: {
      operation: ['filter'],
      inputs: ['df3'],
      code: "df_filtered = df3.filter(df3['created_on'] > '20240101')",
      metadata: [
        {
          type: 'filter',
          condition: "df3['created_on'] > '20240101'",
        },
      ],
      columns: {
        id: {
          sources: [{ prev_node: 'node_3', prev_col: 'id' }],
          type: 'direct',
        },
        name: {
          sources: [{ prev_node: 'node_3', prev_col: 'name' }],
          type: 'direct',
        },
        created_on: {
          sources: [{ prev_node: 'node_3', prev_col: 'created_on' }],
          type: 'direct',
        },
        created_at: {
          sources: [{ prev_node: 'node_3', prev_col: 'created_at' }],
          type: 'direct',
        },
      },
    },
  },

  // Node 6: A select operation
  {
    id: 'node_6',
    type: 'custom',
    variable: 'df_selected',
    position: { x: 1000, y: 400 }, // Bottom-right of node_3
    data: {
      operation: ['select'],
      inputs: ['df3'],
      code: "df_selected = df3.select('id', 'name')",
      metadata: [
        {
          type: 'select',
          columns: ['id', 'name'],
        },
      ],
      columns: {
        id: {
          sources: [{ prev_node: 'node_3', prev_col: 'id' }],
          type: 'direct',
        },
        name: {
          sources: [{ prev_node: 'node_3', prev_col: 'name' }],
          type: 'direct',
        },
      },
    },
  },
  {
    id: 'node_1_5',
    type: 'custom',
    variable: 'df_intermediate',
    position: { x: 250, y: 300 }, // Between node_1 and node_2/node_4
    data: {
      operation: ['select'],
      inputs: ['df1'],
      code: "df_intermediate = df1.select('id', 'name', 'created_at')",
      metadata: [
        {
          type: 'select',
          columns: ['id', 'name', 'created_at'],
        },
      ],
      columns: {
        id: {
          sources: [{ prev_node: 'node_1', prev_col: 'id' }],
          type: 'direct',
        },
        name: {
          sources: [{ prev_node: 'node_1', prev_col: 'name' }],
          type: 'direct',
        },
        created_at: {
          sources: [{ prev_node: 'node_1', prev_col: 'created_at' }],
          type: 'direct',
        },
      },
    },
  },
  {
    id: 'node_50',
    type: 'custom',
    variable: 'df_filtered_new',
    position: { x: 1000, y: 200 }, 
    data: {
      operation: ['filter'],
      inputs: ['df3'],
      code: "df_filtered = df3.filter(df3['created_on'] > '20240101')",
      metadata: [
        {
          type: 'filter',
          condition: "df3['created_on'] > '20240101'",
        },
      ],
      columns: {
        id: {
          sources: [{ prev_node: 'node_5', prev_col: 'id' }],
          type: 'direct',
        },
        name: {
          sources: [{ prev_node: 'node_5', prev_col: 'name' }],
          type: 'direct',
        },
        created_on: {
          sources: [{ prev_node: 'node_5', prev_col: 'created_on' }],
          type: 'direct',
        },
        created_at: {
          sources: [{ prev_node: 'node_5', prev_col: 'created_at' }],
          type: 'direct',
        },
      },
    },
  },
  {
    id: 'node_variable',
    type: 'variable',
    variable: 'variables',
    position: { x: 1000, y: 200 },
    data: {
      operation: ['variable'],
      type: 'variable',
      metadata: [
        {
          name: 'var1',
          value: 'some_valueewrw',
        },
        { name: 'input_path', value: '/mnt/adls/folder1' },
        { name: 'threshold', value: '0.8' },
      ],
    },
  },
];

let initialEdges = graphData?.edges || [];
const initialEdgess = [
  { id: 'e11', source: 'node_1', target: 'node_2' },
  // { id: 'e12', source: 'node_1', target: 'node_4' },
  { id: 'e19', source: 'node_1', target: 'node_1_5' },
  // { id: 'e17', source: 'node_1_5', target: 'node_2' },
  { id: 'e18', source: 'node_1_5', target: 'node_4' },
  { id: 'e13', source: 'node_2', target: 'node_3' },
  { id: 'e14', source: 'node_4', target: 'node_3' },
  { id: 'e1', source: 'read_orders', target: 'select_orders' },
  { id: 'e2', source: 'select_orders', target: 'with_col_order_year' },
  { id: 'e3', source: 'with_col_order_year', target: 'join_orders_customers' },
  { id: 'e4', source: 'read_customers', target: 'rename_customers' },
  { id: 'e5', source: 'rename_customers', target: 'join_orders_customers' },
  { id: 'e15', source: 'node_3', target: 'node_5' },
  { id: 'e150', source: 'node_5', target: 'node_50' },
  { id: 'e16', source: 'node_3', target: 'node_6' },
  {
    id: 'e_df1_to_df',
    source: '0',
    target: '2',
  },
  {
    id: 'e_df2_to_df_join_right',
    source: '1',
    target: '2',
  },
  {
    id: 'e_it_base_zprc_with_mer_pos_agent_to_it_base_zprc_with_ekyc_flag',
    source: '0',
    target: '1',
  },
  {
    id: 'e_it_order_item_status_ois_to_it_order_item_status_ois',
    source: '3',
    target: '4',
  },
  {
    id: 'e_it_order_item_status_ois_to_it_order_item_status',
    source: '4',
    target: '5',
  },
  {
    id: 'e_it_base_zprc_with_ekyc_flag_to_it_base_zprc_with_zpro_item_status',
    source: '1',
    target: '6',
  },
  {
    id: 'e_it_order_item_status_to_it_base_zprc_with_zpro_item_status_join_right',
    source: '5',
    target: '6',
  },
];

function calculateDownstreamUsage(nodes, edges) {
  const usageMap = {};
  edges.forEach((edge) => {
    usageMap[edge.source] = (usageMap[edge.source] || 0) + 1;
  });

  return nodes
    .filter((node) => node.type !== 'variable')
    .map((node) => ({
      ...node,
      data: {
        ...node.data,
        variable: node.variable,
        downstreamCount: usageMap[node.id] || 0,
      },
    }));
}

function generateStyledEdges(nodes, baseEdges, highlighted = []) {
  return baseEdges.map((edge) => ({
    ...edge,
    type: 'default',
    style: {
      stroke: highlighted.includes(edge.id) ? '#f50057' : '#64b5f6',
      strokeWidth: highlighted.includes(edge.id) ? 3 : 1.5,
      strokeOpacity: highlighted.includes(edge.id) ? 1 : 0.75,
    },
    markerEnd: {
      type: 'arrowclosed',
      width: 16,
      height: 16,
      color: highlighted.includes(edge.id) ? '#f50057' : '#64b5f6',
    },
  }));
}

export default function App() {
  // initialNodes = initialNodess;
  // initialEdges = initialEdgess;
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [variables, setVariables] = useState(
    initialNodes.filter((node) => node.type === 'variable')
  );

  const applyAutoLayout = useCallback((nodes = initialNodes, edges = initialEdges) => {
    const nodesWithUsage = calculateDownstreamUsage(nodes, edges);

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodesWithUsage,
      edges,
      'LR'
    );
    const styledEdges = generateStyledEdges(layoutedNodes, layoutedEdges);
    setNodes(layoutedNodes);
    setEdges(styledEdges);
    localStorage.setItem('graph_data', JSON.stringify({ nodes: layoutedNodes, edges: styledEdges }));
  }, []);

  useEffect(() => {
    applyAutoLayout();
  }, [applyAutoLayout]);

  useEffect(() => {
    setVariables(initialNodes.filter((node) => node.type === 'variable') || []);
  }, [nodes]);

  const onNodeClick = useCallback((_, node) => {
    setSelectedNode(node);
    setShowPanel(true);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes.filter((nodes) => nodes.type !== 'variable')}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView={true}
          minZoom={0.2}
        >
          <MiniMap />
          {/* <Controls /> */}
          <CustomToolbar
            variables={variables[0] || {}}
            setSelectedNode={setSelectedNode}
            setShowPanel={setShowPanel}
            setNodes={setNodes}
            setEdges={setEdges}
            applyLayout={applyAutoLayout}
          />
          <Background />
        </ReactFlow>
      </div>

      {selectedNode && showPanel && (
        <RightPanel
          selectedNode={selectedNode}
          setShow={(visible) => {
            setShowPanel(visible);
            if (!visible) setSelectedNode(null);
          }}
          nodes={nodes}
          setNodes={setNodes}
          edges={edges}
          setEdges={setEdges}
        />
      )}
    </div>
  );
}
