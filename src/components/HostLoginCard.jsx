import React, { useState } from 'react';
import { authService } from '../services/authService';

export default function HostLoginCard({ onNavigateToPlayerLogin, onHostLoginSuccess }) {
  const [hostId, setHostId] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!hostId.trim()) {
      setStatus({ type: 'error', message: 'Invalid host ID.' });
      return;
    }

    setLoading(true);
    try {
      const result = await authService.hostLogin(hostId);
      // TODO: redirect to HostDashboard
      setStatus({ type: 'success', message: 'Host access granted.' });
      
      if (onHostLoginSuccess) {
        onHostLoginSuccess({
          playerId: result.hostId,
          firstName: 'Host',
          lastName: 'Admin',
          isHost: true
        });
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Invalid host ID.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="card-header-bar"></div>
      
      <div className="auth-header">
        <h1 className="brand-title">
          HOST <span className="accent-text">PORTAL</span>
        </h1>
        <p className="brand-subtitle">EVENT CONTROLLER CLEARANCE</p>
      </div>

      {status.message && (
        <div className={`status-msg status-msg-${status.type}`}>
          <span className="status-icon">
            {status.type === 'error' ? '⚡' : '🛡️'}
          </span>
          <div>{status.message}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="hostId">Host ID</label>
          <div className="input-container">
            <span className="input-icon">🔑</span>
            <input
              id="hostId"
              type="text"
              className="form-input"
              placeholder="ENTER HOST ID (e.g. HOST-IEEE-2026)"
              value={hostId}
              onChange={(e) => setHostId(e.target.value)}
              disabled={loading}
              required
              autoFocus
            />
          </div>
        </div>

        <button type="submit" className="btn-cyber" disabled={loading}>
          {loading ? <span className="cyber-loader"></span> : 'AUTHENTICATE HOST'}
        </button>

        <div className="form-footer-links" style={{ justifyContent: 'center' }}>
          <button 
            type="button" 
            onClick={() => onNavigateToPlayerLogin()} 
            className="auth-link auth-link-primary"
            disabled={loading}
          >
            RETURN TO PLAYER GATEWAY
          </button>
        </div>
      </form>
    </div>
  );
}
