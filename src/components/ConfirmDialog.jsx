import React from 'react';

export default function ConfirmDialog({
  isOpen,
  title = 'CONFIRM ACTION',
  message = 'Are you sure you want to proceed?',
  confirmText = 'CONFIRM',
  cancelText = 'CANCEL',
  danger = false,
  onConfirm,
  onCancel
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 9999 }}>
      <div 
        className="modal-card bracket-card" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: '440px', 
          textAlign: 'center',
          borderColor: danger ? 'rgba(239, 68, 68, 0.6)' : 'rgba(168, 85, 247, 0.5)',
          boxShadow: danger ? '0 0 30px rgba(239, 68, 68, 0.25)' : '0 0 30px rgba(168, 85, 247, 0.25)'
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
          {danger ? '⚠️' : '🛡️'}
        </div>

        <h2 style={{ 
          fontFamily: 'var(--font-cyber)', 
          color: danger ? '#f87171' : 'var(--accent-cyan)', 
          fontSize: '1.2rem', 
          marginBottom: '0.75rem',
          letterSpacing: '1px'
        }}>
          {title}
        </h2>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.75rem' }}>
          {message}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
            style={{ flex: 1, padding: '10px' }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            className="btn-cyber"
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px',
              background: danger ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' : undefined,
              borderColor: danger ? '#ef4444' : undefined
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
