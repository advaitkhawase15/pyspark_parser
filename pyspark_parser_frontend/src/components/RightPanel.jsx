import React, { useState, useEffect, useRef } from 'react';
import {
  MdTableChart,
  MdFilterAlt,
  MdAddBox,
  MdEdit,
  MdJoinFull,
  MdLink,
  MdFilePresent,
  MdClose,
  MdCheckCircle,
  MdCancel,
  MdGroupWork,
  MdFunctions,
  MdViewColumn,
  MdDriveFileRenameOutline,
  MdCode,
  MdScience,
} from 'react-icons/md';
import JoinIcon from '../icons/JoinIcon';

const panelStyle = (width) => ({
  backgroundColor: '#f4f6f8',
  borderLeft: '1px solid #ccc',
  padding: '20px',
  height: '100vh',
  overflowY: 'auto',
  width: `${width}px`,
  position: 'fixed',
  right: 0,
  top: 0,
  fontFamily: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`,
  fontSize: '14px',
  color: '#222',
  zIndex: 1000,
});

const operationIcons = {
  select: <MdViewColumn />,
  filter: <MdFilterAlt />,
  withColumn: <MdAddBox />,
  withColumnRenamed: <MdDriveFileRenameOutline />,
  rename: <MdEdit />,
  join: <MdJoinFull />,
  union: <MdLink />,
  read: <MdFilePresent />,
  groupby: <MdGroupWork />,
  groupBy: <MdGroupWork />,
  agg: <MdFunctions />,
  agg_function: <MdFunctions />,
  custom: <MdCode />,
};

const sectionColors = {
  Select: '#e1f3e1',
  select: '#e1f3e1',
  filter: '#e1ecf4',
  withColumn: '#f0e5f6',
  rename: '#fdf2d5',
  join: '#e4f8f9',
  union: '#fce4ec',
  read: '#ede7f6',
  custom: '#e6e6fa',
};

const draggerStyle = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: '6px',
  cursor: 'col-resize',
  zIndex: 1,
};

const CollapsibleBlock = ({ icon, title, children, color }) => {
  const [open, setOpen] = useState(true);

  return (
    <div
      style={{
        marginBottom: '1rem',
        borderRadius: '8px',
        border: `1px solid ${color}`,
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      <div
        onClick={() => setOpen(!open)}
        style={{
          background: color,
          padding: '10px 14px',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#333',
        }}
      >
        <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {typeof icon === 'function' ? icon() : icon} {title}
        </span>
        <span>{open ? '−' : '+'}</span>
      </div>
      {open && (
        <div
          style={{
            padding: '14px',
            paddingTop: 6,
            lineHeight: 1.6,
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              minWidth: '100%',
              scrollbarColor: '#ccc transparent',
              scrollbarWidth: 'thin',
            }}
          >
            <style>
              {`
                ::-webkit-scrollbar {
                  height: 6px;
                }
                ::-webkit-scrollbar-thumb {
                  background: #ccc;
                  border-radius: 4px;
                }
                ::-webkit-scrollbar-track {
                  background: transparent;
                }
              `}
            </style>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default function RightPanel({
  selectedNode,
  setShow,
  nodes,
  setNodes,
  edges,
  setEdges,
}) {
  // console.log('selectedNode------------', selectedNode);
  const [width, setWidth] = useState(360);
  const [dragging, setDragging] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const panelRef = useRef();
  const metadata = selectedNode?.data?.metadata || [];
  const code = selectedNode?.data?.code || '';
  const lastHighlightedRef = useRef(null);
  const lastInputHighlightRef = useRef(null);

  const startDrag = () => setDragging(true);
  const stopDrag = () => setDragging(false);
  const onDrag = (e) => {
    if (dragging) setWidth(window.innerWidth - e.clientX);
  };

  useEffect(() => {
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [dragging]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        resetStyles();
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setShow]);

  useEffect(() => {
    lastHighlightedRef.current = null;
    lastInputHighlightRef.current = null;
  }, [selectedNode?.id]);

  const highlightInput = (inputVar) => {
    if (lastInputHighlightRef.current === inputVar) {
      resetStyles();
      lastInputHighlightRef.current = null;
      return;
    }
    lastInputHighlightRef.current = inputVar;
    resetStyles();

    const inputNode = nodes.find(
      (n) => n.variable === inputVar || n.data?.variable === inputVar
    );
    if (!inputNode) return;

    setNodes((nds) =>
      nds.map((n) =>
        n.id === inputNode.id
          ? { ...n, style: { ...n.style, border: '3px solid #ff9800', borderRadius: 17 } }
          : n
      )
    );
    setEdges((eds) =>
      eds.map((e) =>
        e.source === inputNode.id && e.target === selectedNode.id
          ? {
              ...e,
              style: { stroke: '#ff9800', strokeWidth: 2.5 },
              markerEnd: { type: 'arrowclosed', width: 16, height: 16, color: '#ff9800' },
            }
          : e
      )
    );
  };

  const resetStyles = () => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        style: { ...n.style, border: '2px solid #1976d2', borderRadius: 17 },
      }))
    );
    setEdges((eds) =>
      eds.map((e) => ({
        ...e,
        type: 'default',
        style: { stroke: '#64b5f6', strokeWidth: 1.5, strokeOpacity: 0.75 },
        markerEnd: { type: 'arrowclosed', width: 16, height: 16, color: '#64b5f6' },
      }))
    );
  };

  // resetStyles();

  const highlightLineage = (column) => {
    // console.log('column--------------->', column);
    const firstSource = column?.sources?.[0];
    const currentKey = firstSource
      ? `${firstSource.prev_node}.${firstSource.prev_col}`
      : null;

    // Toggle highlight: reset if clicking the same source again
    if (lastHighlightedRef.current === currentKey) {
      resetStyles();
      lastHighlightedRef.current = null;
      return;
    }

    // Update the last highlighted source
    lastHighlightedRef.current = currentKey;

    // Reset before applying new highlight
    resetStyles();
    // console.log('column-------------->', column);

    // const visitedNodes = new Set();
    // const visitedEdges = new Set();

    const highlightRecursively = (currentNodeId, colSources) => {
      colSources.forEach((src) => {
        const { prev_node, prev_col } = src;

        if (!prev_node || prev_node == currentNodeId) {
          // console.log('prev_node--------------->', prev_node);
          // console.log('currentNodeId--------------->', currentNodeId);
          return;
        }

        // visitedNodes.add(prev_node);

        // Highlight node
        setNodes((nds) =>
          nds.map((n) =>
            n.id === prev_node
              ? {
                  ...n,
                  style: {
                    ...n.style,
                    border: '5px solid orange',
                    borderRadius: 17,
                  },
                }
              : n
          )
        );

        // Highlight edge from prev_node → currentNodeId
        setEdges((eds) =>
          eds.map((e) => {
            if (e.source === prev_node && e.target === currentNodeId) {
              // visitedEdges.add(e.id);
              return {
                ...e,
                style: { stroke: 'orange', strokeWidth: 3 },
                markerEnd: { type: 'arrowclosed', color: 'orange' },
              };
            }
            return e;
          })
        );

        const prevNode = nodes.find((n) => n.id === prev_node);
        const nextColMeta = prevNode?.data?.columns?.[prev_col];
        if (nextColMeta?.sources?.length) {
          highlightRecursively(prev_node, nextColMeta.sources);
        }
      });
    };

    highlightRecursively(selectedNode.id, column.sources);
  };

  if (!selectedNode) return null;

  const columns = Object.entries(selectedNode?.data?.columns || {});

  return (
    <div ref={panelRef} style={panelStyle(width)}>
      <div style={draggerStyle} onMouseDown={startDrag} />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '10px',
        }}
      >
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '18px',
            fontWeight: 'bold',
          }}
          title={selectedNode.variable}
        >
          <code>{selectedNode.variable}</code>
        </div>
        {typeof code === 'string' && code.trim() !== '' && (
          <span onClick={() => setShowCode(!showCode)}>
            <MdCode size={22} />
          </span>
        )}
        <MdClose
          size={22}
          style={{ cursor: 'pointer', color: '#555', flexShrink: 0 }}
          onClick={() => {
            setShow(false);
            resetStyles();
          }}
          title="Close Panel"
        />
      </div>

      {showCode && selectedNode.type !== 'variable' ? (
        <pre
          style={{
            background: '#2d2d2d',
            fontFamily: `'Fira Code', 'Consolas', 'Courier New', monospace`,
            fontSize: '13.5px',
            lineHeight: '1.6',
            padding: '16px',
            borderRadius: '8px',
            overflowX: 'auto',
            whiteSpace: 'pre',
            marginTop: '12px',
            boxShadow: 'inset 0 0 0 1px #444',
            color: '#ccc',
          }}
        >
          <code>{code}</code>
        </pre>
      ) : (
        <>
          {selectedNode.type !== 'variable' && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: '#555', margin: '0 0 6px 0' }}>
                <b>Source df:</b>{' '}
                <code style={{ background: '#e8f4fd', padding: '2px 6px', borderRadius: 4 }}>
                  {selectedNode?.data?.base_df ||
                    selectedNode?.data?.main_df ||
                    selectedNode?.data?.inputs?.[0] ||
                    '—'}
                </code>
              </p>
              {selectedNode?.data?.inputs?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#888' }}>Inputs:</span>
                  {selectedNode.data.inputs.map((inp, i) => (
                    <span
                      key={i}
                      onClick={() => highlightInput(inp)}
                      title="Click to highlight upstream node"
                      style={{
                        fontSize: 12,
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: lastInputHighlightRef.current === inp ? '#ff9800' : '#fff3e0',
                        color: lastInputHighlightRef.current === inp ? '#fff' : '#e65100',
                        border: '1px solid #ffcc80',
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                        transition: 'all 0.15s',
                      }}
                    >
                      {inp}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedNode?.type != 'variable' &&
            metadata.map((item, index) => {
              const icon =
                item.type === 'join' && item.joinType
                  ? () => (
                      <JoinIcon type={item.joinType.toLowerCase()} size={28} />
                    )
                  : operationIcons[item.type] || <MdTableChart />;

              const color = sectionColors[item.type] || '#e0e0e0';
              // console.log('item------------------->', item);

              return (
                <CollapsibleBlock
                  key={index}
                  icon={icon}
                  title={`${index + 1}. ${item.type}`}
                  color={color}
                >
                  {item.type === 'select' && (
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {item.columns.map((col, i) => (
                        <li key={i}>{col}</li>
                      ))}
                    </ul>
                  )}
                  {(item.type === 'filter' || item.type === 'where') && (
                    <div style={{ margin: 0 }}>
                      {(item.conditions || [item.condition]).map((cond, i) => (
                        <p key={i} style={{ margin: '4px 0' }}>
                          <code>{cond}</code>
                        </p>
                      ))}
                    </div>
                  )}
                  {item.type === 'withColumn' && (
                    <table
                      style={{ width: '100%', borderCollapse: 'collapse' }}
                    >
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px' }}>
                            Column
                          </th>
                          <th style={{ textAlign: 'left', padding: '6px' }}>
                            Expression
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          item.columns || [
                            {
                              column: item.column,
                              expression: item.expression,
                            },
                          ]
                        ).map((colObj, i) => (
                          <tr key={i}>
                            <td style={{ padding: '6px' }}>{colObj.column}</td>
                            <td style={{ padding: '6px' }}>
                              <code>{colObj.expression}</code>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {item.type === 'withColumnRenamed' && (
                    <table
                      style={{ width: '100%', borderCollapse: 'collapse' }}
                    >
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px' }}>
                            From
                          </th>
                          <th style={{ textAlign: 'left', padding: '6px' }}>
                            To
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.columns.map((pair, i) => (
                          <tr key={i}>
                            <td style={{ padding: '6px' }}>{pair.from}</td>
                            <td style={{ padding: '6px' }}>{pair.to}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {item.type === 'join' && (
                    <>
                      <p>
                        <b>join Type:</b> <code>{item.joinType}</code>
                      </p>
                      <p>
                        <b>Table 1:</b> <code>{item.table1}</code>{' '}
                        {item.table1Alias && `(alias: ${item.table1Alias})`}
                      </p>
                      <p>
                        <b>Table 2:</b> <code>{item.table2}</code>{' '}
                        {item.table2Alias && `(alias: ${item.table2Alias})`}
                      </p>
                      <p>
                        <b>Condition:</b>
                        <br />
                        <code>{item.conditions}</code>
                      </p>
                    </>
                  )}

                  {item.type === 'union' && (
                    <table
                      style={{ width: '100%', borderCollapse: 'collapse' }}
                    >
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px' }}>
                            Unions
                          </th>
                          <th style={{ textAlign: 'center', padding: '6px' }}>
                            By Name
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.unions.map((items, i) => (
                          <tr key={i}>
                            <td style={{ padding: '6px', maxWidth: '200px' }}>
                              <div
                                title={items.unionWith}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: '23px',
                                    marginRight: '8px',
                                  }}
                                >
                                  &bull;
                                </span>
                                <span
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {items.unionWith}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '6px', textAlign: 'center' }}>
                              {items.byName ? (
                                <MdCheckCircle color="green" title="True" />
                              ) : (
                                <MdCancel color="red" title="False" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {(item.type === 'agg' || item.type === 'agg_function') && (
                    <table
                      style={{ width: '100%', borderCollapse: 'collapse' }}
                    >
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '6px' }}>
                            Expression
                          </th>
                          <th style={{ textAlign: 'right', padding: '6px' }}>
                            Alias
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.type === 'agg' &&
                          item.expressions.map((row, i) => (
                            <tr key={i}>
                              <td
                                style={{
                                  padding: '6px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '300px',
                                }}
                                title={row.exp}
                              >
                                • <code>{row.exp}</code>
                              </td>
                              <td
                                style={{
                                  padding: '6px',
                                  textAlign: 'right',
                                }}
                              >
                                <code>{row.alias}</code>
                              </td>
                            </tr>
                          ))}

                        {item.type === 'agg_function' && (
                          <tr>
                            <td
                              style={{
                                padding: '6px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '300px',
                              }}
                              title={item.expressions}
                            >
                              • <code>{item.expressions}</code>
                            </td>
                            <td
                              style={{
                                padding: '6px',
                                textAlign: 'right',
                              }}
                            >
                              <code>{item.alias}</code>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                  {item.type === 'read' && (
                    <>
                      <p>
                        <b>Path:</b> <code>{item.path}</code>
                      </p>
                      <p>
                        <b>Format:</b> <code>{item.format}</code>
                      </p>
                    </>
                  )}
                  {(item.type === 'groupby' || item.type === 'groupBy') && (
                    <div style={{ margin: 0 }}>
                      <b>Group By Columns:</b>
                      <ul style={{ marginTop: '6px', paddingLeft: 20 }}>
                        {item.columns.map((col, i) => (
                          <li key={i}>{col}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.type === 'custom' && (
                    <pre
                      className="language-python"
                      style={{
                        background: '#2d2d2d',
                        padding: '10px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        color: '#ccc',
                        overflowX: 'auto',
                      }}
                    >
                      <code className="language-python">{item.operation}</code>
                    </pre>
                  )}
                </CollapsibleBlock>
              );
            })}
        </>
      )}

      {/* Column Lineage Section */}
      {columns.length > 0 && (
        <div
          style={{
            marginTop: '16px',
            background: '#fefefe',
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            scrollbarColor: '#ccc transparent',
            scrollbarWidth: 'thin',
          }}
        >
          <h4
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <MdScience /> Column Lineage
          </h4>

          <div
            style={{
              overflowX: 'auto',
              maxWidth: '100%',
            }}
          >
            <table
              style={{
                minWidth: '500px', // ensures scroll activates on overflow
                borderCollapse: 'collapse',
                fontSize: '13px',
                width: '100%',
              }}
            >
              <thead>
                <tr style={{ background: '#f5f7fa' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>
                    Column
                  </th>
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>
                    Sources
                  </th>
                </tr>
              </thead>
              <tbody>
                {columns.map(([colName, colMeta], i) => (
                  <tr
                    key={i}
                    style={{
                      backgroundColor: i % 2 === 0 ? '#fff' : '#fafafa',
                      borderTop: '1px solid #eee',
                    }}
                  >
                    <td style={{ padding: '6px 10px', fontWeight: 500 }}>
                      {colName}
                    </td>
                    <td style={{ padding: '6px 10px', color: '#555' }}>
                      {colMeta.sources?.map((src, j) => (
                        <span
                          key={j}
                          onClick={() => highlightLineage({ sources: [src] })}
                          role="button"
                          tabIndex={0}
                          title={`${src.prev_node}.${src.prev_col}`}
                          style={{
                            display: 'inline-block',
                            marginRight: 6,
                            background: '#e0f7fa',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {src.prev_node}.{src.prev_col}
                        </span>
                      )) || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedNode?.type === 'variable' && (
        <div
          style={{
            border: '1px solid #ccc',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
            }}
          >
            <thead>
              <tr style={{ background: '#f5f7fa' }}>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontWeight: 600,
                    color: '#222',
                    backgroundColor: '#e1e4e8',
                    borderBottom: '1px solid #ccc',
                  }}
                >
                  Variable
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontWeight: 600,
                    color: '#222',
                    backgroundColor: '#e1e4e8',
                    borderBottom: '1px solid #ccc',
                  }}
                >
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {metadata.map((v, i) => (
                <tr
                  key={i}
                  style={{
                    backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9',
                    borderTop: '1px solid #eee',
                  }}
                >
                  <td style={{ padding: '8px 12px' }}>
                    <code>{v.name}</code>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <code>{v.value}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
