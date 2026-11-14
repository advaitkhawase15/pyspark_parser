import React from 'react';
import { Handle } from 'reactflow';
import { MdFilterAlt, MdLink, MdGroupWork, MdFunctions } from 'react-icons/md';
import JoinIcon from '../icons/JoinIcon';
import { Tooltip as ReactTooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

const operationIcons = {
  filter: <MdFilterAlt size={16} color="#0077b6" />,
  join: <JoinIcon type="inner" size={16} color="#0077b6" />,
  union: (
    <>
      <b>U</b>
      <br />
    </>
  ),
  groupby: <MdGroupWork size={16} color="#0077b6" />,
  groupBy: <MdGroupWork size={16} color="#0077b6" />,
  agg: <MdFunctions size={16} color="#0077b6" />,
  agg_function: <MdFunctions size={16} color="#0077b6" />,
};

export default function CustomNode({ data, id }) {
  const miniOps = Array.isArray(data.operation)
    ? [
        ...new Set(
          data.operation.filter((op) =>
            ['filter', 'join', 'union', 'agg', 'agg_function'].includes(op)
          )
        ),
      ]
    : [];

  return (
    <div
      data-tooltip-id={`tooltip-${id}`}
      data-tooltip-html={`
        <b>${data.variable}</b><br/>
        Inputs: ${data.inputs?.join(', ') || 'None'}
      `}
      style={{
        backgroundColor: '#f0f4f8',
        padding: '12px 16px',
        border: '2px solid #1976d2',
        borderRadius: 14,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        fontSize: 13,
        minWidth: 220,
        maxWidth: 260,
        color: '#333',
        position: 'relative',
        transition: 'all 0.2s ease-in-out',
      }}
    >
      {/* Variable Name */}
      <div
        style={{
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {data.variable}
      </div>

      {/* Inputs */}
      <div style={{ fontSize: 12, marginBottom: 2 }}>
        <b style={{ color: '#555' }}>Input:</b>{' '}
        {data.inputs?.join(', ') || 'None'}
      </div>

      {/* Downstream Info */}
      <div style={{ fontSize: 11, marginTop: 4, color: '#777' }}>
        Used in {data.downstreamCount || 0} node
        {data.downstreamCount > 1 ? 's' : ''}
      </div>
      <div style={{ fontSize: 11, marginTop: 4, color: '#777' }}>
        selected col: {data.selectedColumn || ''}
      </div>

      {/* Mini operation icons */}
      {miniOps.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 10,
            right: 12,
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
          }}
        >
          {miniOps.map((op, i) => (
            <div
              key={i}
              data-tooltip-id={`miniop-${id}-${i}`}
              data-tooltip-content={op}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {operationIcons[op]}
              <ReactTooltip id={`miniop-${id}-${i}`} place="top" />
            </div>
          ))}
        </div>
      )}

      {/* Handles */}
      <Handle type="target" position="left" style={{ background: '#555' }} />
      <Handle type="source" position="right" style={{ background: '#555' }} />
      <ReactTooltip id={`tooltip-${id}`} place="top" />
    </div>
  );
}
