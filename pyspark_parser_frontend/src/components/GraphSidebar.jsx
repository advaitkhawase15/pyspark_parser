import React, { useRef, useState, useEffect } from 'react';
import { MdClose, MdUpload } from 'react-icons/md';

export default function GraphSidebar({ savedGraphs, onLoad, onSave }) {
  const [width, setWidth] = useState(250);
  const [resizing, setResizing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const sidebarRef = useRef(null);

  const startResize = (e) => {
    setResizing(true);
  };

  const handleMouseMove = (e) => {
    if (!resizing) return;
    const newWidth = Math.max(150, Math.min(e.clientX, 400)); // min: 150, max: 400
    setWidth(newWidth);
  };

  const stopResize = () => {
    setResizing(false);
  };

  useEffect(() => {
    if (resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', stopResize);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [resizing]);

  return (
    <div
      ref={sidebarRef}
      style={{
        width: width,
        background: '#f5f5f5',
        borderRight: '1px solid #ccc',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1001,
        transition: resizing ? 'none' : 'width 0.2s ease-in-out',
        display: width === 0 ? 'none' : 'block',
      }}
    >
      {/* Resize Handle */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 6,
          height: '100%',
          cursor: 'col-resize',
          background: '#ccc',
          zIndex: 1002,
        }}
        onMouseDown={startResize}
        title="Drag to Resize"
      />

      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px',
          background: '#ddd',
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: 14 }}>Saved Graphs</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <MdUpload
            size={20}
            onClick={() => setShowModal(true)}
            title="Upload Graph"
            style={{ cursor: 'pointer' }}
          />
          {/* <MdClose
            size={20}
            onClick={() => setWidth(0)}
            title="Close Panel"
            style={{ cursor: 'pointer' }}
          /> */}
        </div>
      </div>

      {/* Graph List */}
      <div style={{ padding: '10px' }}>
        {Object.entries(savedGraphs || {}).map(([name], idx) => (
          <div
            key={idx}
            style={{
              padding: '6px 8px',
              marginBottom: '6px',
              background: '#fff',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              fontSize: 13,
              color: '#000',
            }}
            onClick={() => onLoad(name)}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Upload Modal */}
      {showModal && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#ffffff',
            border: '1px solid #ccc',
            borderRadius: '12px',
            padding: '20px',
            zIndex: 1000, // ✅ Lower than the resize handle (1002)
            width: '90%',
            maxWidth: 320,
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
          }}
        >
          <h4 style={{ marginBottom: '12px' }}>Upload New Graph</h4>
          <UploadForm
            onSave={(name, nodes, edges) => {
              onSave(name, nodes, edges);
              setShowModal(false);
            }}
            onCancel={() => setShowModal(false)}
          />
        </div>
      )}
    </div>
  );
}

function UploadForm({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const [nodes, setNodes] = useState('');
  const [edges, setEdges] = useState('');

  // const handleSave = () => {
  //   try {
  //     const parsedNodes = JSON.parse(nodes);
  //     const parsedEdges = JSON.parse(edges);
  //     onSave(name, parsedNodes, parsedEdges);
  //   } catch (err) {
  //     alert('Invalid JSON for nodes or edges.');
  //   }
  // };

  const handleSave = () => {
    try {
      const parsedNodes = JSON.parse(nodes);
      const parsedEdges = JSON.parse(edges);
      onSave(name, parsedNodes, parsedEdges);
      // onClose();
    } catch (e) {
      console.error('JSON parse error:', e.message);
      alert('Invalid JSON! Check console for details.');
    }
  };

  return (
    <div style={{ fontSize: 13, color: '#333' }}>
      <label style={{ fontWeight: 600, marginBottom: 4, color: '#333' }}>
        File Name
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          border: '1px solid #bbb',
          background: '#fafafa',
          marginBottom: 10,
          padding: '6px 8px',
          border: '1px solid #ccc',
          borderRadius: 4,
          fontSize: 13,
          // background: '#fff',
          color: '#000',
        }}
      />

      <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
        Nodes (JSON)
      </label>
      <textarea
        value={nodes}
        onChange={(e) => setNodes(e.target.value)}
        style={{
          background: '#fafafa',
          color: '#000',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          width: '100%',
          boxSizing: 'border-box',
          height: 80,
          marginBottom: 10,
          padding: '6px 8px',
          border: '1px solid #ccc',
          borderRadius: 4,
          fontSize: 13,
          fontFamily: 'monospace',
        }}
      />

      <label style={{ fontWeight: 600, display: 'block', marginBottom: 4 }}>
        Edges (JSON)
      </label>
      <textarea
        value={edges}
        onChange={(e) => setEdges(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          height: 80,
          marginBottom: 10,
          padding: '6px 8px',
          border: '1px solid #ccc',
          borderRadius: 4,
          fontSize: 13,
          background: '#fafafa',
          color: '#000',
          fontFamily: 'monospace',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button
          onClick={handleSave}
          style={{
            padding: '6px 12px',
            background: '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 12px',
            background: '#aaa',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
