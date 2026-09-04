import React, { useEffect } from 'react';

export default function Toast({
  message,
  type = 'info', // 'info' | 'success' | 'warning' | 'error'
  duration = 3500,
  onClose
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const iconMap = {
    info: 'ℹ️',
    success: '✓',
    warning: '⚠️',
    error: '⚡'
  };

  const colorMap = {
    info: { border: 'rgba(6, 182, 212, 0.5)', bg: 'rgba(6, 182, 212, 0.15)', text: 'var(--accent-cyan)' },
    success: { border: 'rgba(16, 185, 129, 0.5)', bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
    warning: { border: 'rgba(245, 158, 11, 0.5)', bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
    error: { border: 'rgba(239, 68, 68, 0.5)', bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171' }
  };

  const style = colorMap[type] || colorMap.info;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 10000,
        background: 'rgba(15, 12, 35, 0.95)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${style.border}`,
        borderRadius: '8px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: `0 8px 30px rgba(0, 0, 0, 0.5), 0 0 15px ${style.bg}`,
        color: 'white',
        fontFamily: 'var(--font-sans)',
        fontSize: '0.9rem',
        maxWidth: '420px',
        animation: 'slide-up 0.3s ease-out'
      }}
    >
      <span style={{ fontSize: '1.2rem', color: style.text }}>{iconMap[type] || 'ℹ️'}</span>
      <div style={{ flex: 1, lineHeight: '1.4' }}>{message}</div>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '1rem',
          padding: '0 4px',
          lineHeight: '1'
        }}
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
