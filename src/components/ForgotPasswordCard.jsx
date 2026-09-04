import React, { useState } from 'react';
import { authService } from '../services/authService';

export default function ForgotPasswordCard({ onNavigateToLogin }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!email.trim()) {
      setStatus({ type: 'error', message: 'Email address is required.' });
      return;
    }

    setLoading(true);
    try {
      const result = await authService.requestPasswordReset(email);
      setStatus({ type: 'success', message: result.message });
    } catch (err) {
      setStatus({ 
        type: 'success', 
        message: 'If this email is registered, a password reset link has been sent.' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="card-header-bar"></div>
      
      <div className="auth-header">
        <h1 className="brand-title">
          CREDENTIAL <span className="accent-text">RECOVERY</span>
        </h1>
        <p className="brand-subtitle">SCAN REGISTERED NODE COORDINATES</p>
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
          <label className="form-label" htmlFor="recoveryEmail">Registered Email</label>
          <div className="input-container">
            <span className="input-icon">✉️</span>
            <input
              id="recoveryEmail"
              type="email"
              className="form-input"
              placeholder="ENTER EMAIL ADDRESS"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              autoFocus
            />
          </div>
        </div>

        <button type="submit" className="btn-cyber" disabled={loading}>
          {loading ? <span className="cyber-loader"></span> : 'SEND RESET LINK'}
        </button>

        <div className="form-footer-links" style={{ justifyContent: 'center' }}>
          <button 
            type="button" 
            onClick={() => onNavigateToLogin()} 
            className="auth-link auth-link-primary"
            disabled={loading}
          >
            RETURN TO LOGIN GATEWAY
          </button>
        </div>
      </form>
    </div>
  );
}
