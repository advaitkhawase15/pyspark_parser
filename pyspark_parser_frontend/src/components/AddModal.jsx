// components/AddModal.jsx
import React from 'react';

const AddModal = ({ isOpen, onClose, onSubmit, title, children, loading = false }) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'rgb(244, 246, 248)',
          borderRadius: '12px',
          width: '560px',
          maxWidth: '90%',
          padding: '24px',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
          fontFamily: 'Segoe UI, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '600',
              color: '#333',
            }}
          >
            {title}
          </h2>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {children}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '24px',
            gap: '10px',
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={buttonStyle('#f0f0f0', '#333', '#ccc', loading)}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            style={{
              ...buttonStyle(loading ? '#5a9fd4' : '#1976d2', '#fff'),
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '80px',
              justifyContent: 'center',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading && <span style={spinnerStyle} />}
            {loading ? 'Loading...' : 'Submit'}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    </div>
  );
};

const buttonStyle = (bg, color, border = 'transparent', disabled = false) => ({
  padding: '8px 16px',
  background: bg,
  color,
  fontWeight: '600',
  border: `1px solid ${border}`,
  borderRadius: '6px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: '14px',
  transition: 'background 0.2s',
  opacity: disabled ? 0.6 : 1,
});

const spinnerStyle = {
  width: 14,
  height: 14,
  border: '2px solid rgba(255,255,255,0.35)',
  borderTopColor: '#fff',
  borderRadius: '50%',
  display: 'inline-block',
  animation: 'spin 0.7s linear infinite',
};

export default AddModal;
