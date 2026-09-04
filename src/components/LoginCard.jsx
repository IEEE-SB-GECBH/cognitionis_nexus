import React, { useState } from 'react';
import { authService } from '../services/authService';

export default function LoginCard({ defaultPlayerId = '', onNavigateToRegister, onNavigateToForgot, onNavigateToHost, onLoginSuccess }) {
  const [formData, setFormData] = useState({
    playerId: defaultPlayerId,
    password: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const { playerId, password } = formData;
    if (!playerId.trim() || !password) {
      setStatus({ type: 'error', message: 'Invalid player ID or password.' });
      return false;
    }
    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!validate()) return;

    setLoading(true);
    try {
      const result = await authService.login(formData);
      setStatus({ type: 'success', message: 'Verification established. Logging in...' });
      
      if (onLoginSuccess) {
        const playerObj = result.player || { playerId: result.playerId || formData.playerId, email: result.user?.email };
        onLoginSuccess(playerObj);
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Invalid player ID or password.' });
    } finally {
      setLoading(false);
    }
  };

  const renderEyeIcon = () => (
    showPassword ? (
      <svg className="eye-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
      </svg>
    ) : (
      <svg className="eye-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm-9.35-4l17.7 17.7-1.41 1.41L12.44 19.3c-.15.02-.3.03-.44.03-5 0-9.27-3.11-11-7.5.76-1.92 2.01-3.57 3.6-4.79L1.24 5.66l1.41-1.41z"/>
      </svg>
    )
  );

  return (
    <div className="auth-card">
      <div className="card-header-bar"></div>
      
      <div className="auth-header">
        <h1 className="brand-title">
          COGNITIONIS <span className="accent-text">NEXUS</span>
        </h1>
        <p className="brand-subtitle">EXPANDING YOUR COGNITIVE HORIZON</p>
      </div>

      {status.message && (
        <div className={`status-msg status-msg-${status.type}`}>
          <span className="status-icon">
            {status.type === 'error' ? '⚡' : '🛡️'}
          </span>
          <div>{status.message}</div>
        </div>
      )}

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label className="form-label" htmlFor="playerId">Player ID Coordinate</label>
          <div className="input-container">
            <span className="input-icon">🆔</span>
            <input
              id="playerId"
              name="playerId"
              type="text"
              className="form-input"
              placeholder="e.g. IEEE-001"
              value={formData.playerId}
              onChange={handleChange}
              disabled={loading}
              required
              autoFocus
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Security Signature</label>
          <div className="input-container">
            <span className="input-icon">🔑</span>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="PASSWORD"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {renderEyeIcon()}
            </button>
          </div>
        </div>

        <button type="submit" className="btn-cyber" disabled={loading}>
          {loading ? <span className="cyber-loader"></span> : 'ENTER COGNITIVE GATEWAY'}
        </button>

        <div className="form-footer-links">
          <button 
            type="button" 
            onClick={onNavigateToForgot} 
            className="auth-link"
            disabled={loading}
          >
            Forgot Credentials?
          </button>
          <button 
            type="button" 
            onClick={onNavigateToRegister} 
            className="auth-link auth-link-primary"
            disabled={loading}
          >
            Register Account
          </button>
        </div>

        {onNavigateToHost && (
          <div className="host-portal-container">
            <button 
              type="button" 
              onClick={onNavigateToHost} 
              className="btn-host-portal"
              disabled={loading}
            >
              🔑 Event Host Login Portal
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
