import React, { useState } from 'react';
import {
  MdZoomIn,
  MdZoomOut,
  MdFitScreen,
  MdRestartAlt,
  MdFileDownload,
  MdAdd,
  MdDataObject,
  MdDeleteSweep,
} from 'react-icons/md';
import { useReactFlow } from 'reactflow';
import AddModal from './AddModal';

const CustomToolbar = ({
  variables,
  setSelectedNode,
  setShowPanel,
  setNodes,
  setEdges,
  applyLayout,
}) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const [isModalOpen, setModalOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [jsonFile, setJsonFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleShowVariables = () => {
    if (variables?.data?.metadata?.length > 0) {
      setSelectedNode(variables);
      setShowPanel(true);
    } else {
      alert('No variable node found!');
    }
  };

  const handleModalSubmit = async () => {
    if (!codeInput.trim()) {
      setModalOpen(false);
      setCodeInput('');
      return;
    }

    setIsLoading(true);
    try {
      // ---- JSON paste: replace graph entirely ----
      const parsed = JSON.parse(codeInput);
      if (typeof parsed === 'object' && parsed !== null) {
        localStorage.removeItem('pyspark_code');
        localStorage.setItem('graph_data', JSON.stringify(parsed));
        applyLayout(parsed?.nodes || [], parsed?.edges || []);
      }
    } catch (e) {
      // ---- PySpark code: append to existing code and re-parse ----
      try {
        const existing = localStorage.getItem('pyspark_code') || '';
        const combined = existing ? existing + '\n' + codeInput : codeInput;

        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: combined }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(`Parser error: ${err.detail || res.statusText}`);
        } else {
          const data = await res.json();
          if (data.errors && data.errors.length > 0) {
            alert(`Parse errors:\n${data.errors.join('\n')}`);
          } else if (!data.nodes || data.nodes.length === 0) {
            alert('No DataFrame nodes found in the provided code.');
          } else {
            localStorage.setItem('pyspark_code', combined);
            localStorage.setItem('graph_data', JSON.stringify(data));
            applyLayout(data.nodes || [], data.edges || []);
          }
        }
      } catch (fetchErr) {
        alert(`Could not reach backend: ${fetchErr.message}`);
      }
    } finally {
      setIsLoading(false);
    }

    setModalOpen(false);
    setCodeInput('');
    setJsonFile(null);
  };

  const handleClearGraph = () => {
    localStorage.removeItem('pyspark_code');
    localStorage.removeItem('graph_data');
    setNodes([]);
    setEdges([]);
  };

  const downloadGraphJson = () => {
    const graphData = localStorage.getItem('graph_data');
    if (!graphData) {
      alert('No graph data found in localStorage!');
      return;
    }

    const blob = new Blob([graphData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph_data.json';
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          background: '#1e1e1e',
          padding: '6px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
          border: '1px solid #444',
        }}
      >
        <ToolbarButton
          onClick={() => setModalOpen(true)}
          title="Add / Append PySpark Code"
          icon={<MdAdd size={18} />}
        />
        <ToolbarButton
          onClick={zoomIn}
          icon={<MdZoomIn size={18} />}
          title="Zoom In"
        />
        <ToolbarButton
          onClick={zoomOut}
          icon={<MdZoomOut size={18} />}
          title="Zoom Out"
        />
        <ToolbarButton
          onClick={fitView}
          icon={<MdFitScreen size={18} />}
          title="Fit View"
        />
        <ToolbarButton
          onClick={() => window.location.reload()}
          icon={<MdRestartAlt size={18} />}
          title="Reset View"
        />
        <ToolbarButton
          onClick={handleShowVariables}
          icon={<MdDataObject size={18} />}
          title="Show Variables"
        />
        <ToolbarButton
          onClick={downloadGraphJson}
          icon={<MdFileDownload size={18} />}
          title="Download Graph JSON"
        />
        <ToolbarButton
          onClick={handleClearGraph}
          icon={<MdDeleteSweep size={18} />}
          title="Clear Graph"
          danger
        />
      </div>
      <AddModal
        isOpen={isModalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleModalSubmit}
        title="Add / Append PySpark Code"
        loading={isLoading}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label>
            <textarea
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="df = df.select('col1', 'col2')"
              style={{
                width: '95%',
                minHeight: '120px',
                maxHeight: '250px',
                fontFamily: 'monospace',
                padding: '10px',
                fontSize: '14px',
                borderRadius: '8px',
                border: '1px solid #ccc',
                backgroundColor: '#f9f9f9',
                resize: 'vertical',
                color: '#333',
                lineHeight: '1.4',
                overflow: 'auto',
                scrollbarColor: '#ccc transparent',
                scrollbarWidth: 'thin',
              }}
            />
          </label>
        </div>
      </AddModal>
    </>
  );
};

const ToolbarButton = ({ icon, onClick, title, danger = false }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      background: danger ? '#3a1a1a' : '#292929',
      color: danger ? '#ff6b6b' : '#fff',
      border: `1px solid ${danger ? '#7a3a3a' : '#555'}`,
      borderRadius: '4px',
      padding: '6px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.2s',
      width: '30px',
      height: '30px',
    }}
    onMouseEnter={(e) =>
      (e.currentTarget.style.background = danger ? '#5a2a2a' : '#444')
    }
    onMouseLeave={(e) =>
      (e.currentTarget.style.background = danger ? '#3a1a1a' : '#292929')
    }
  >
    {icon}
  </button>
);

export default CustomToolbar;
