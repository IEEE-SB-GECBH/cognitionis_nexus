import React, { useState } from 'react';
import { authService } from '../services/authService';

export default function RegisterCard({ onNavigateToLogin }) {
  const [formData, setFormData] = useState({
    playerId: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const { playerId, email, password, confirmPassword } = formData;
    
    // Check if any field is empty
    if (!playerId.trim() || !email.trim() || !password || !confirmPassword) {
      setStatus({ type: 'error', message: 'All fields are required.' });
      return false;
    }
    
    // Email regex validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return false;
    }
    
    // Password length validation (minimum 6 characters)
    if (password.length < 6) {
      setStatus({ type: 'error', message: 'Password must be at least 6 characters long.' });
      return false;
    }

    // Password and Confirm Password must match
    if (password !== confirmPassword) {
      setStatus({ type: 'error', message: 'Password and Confirm Password must match.' });
      return false;
    }
    
    return true;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    
    if (!validate()) return;
    
    setLoading(true);
    try {
      const result = await authService.register({
        playerId: formData.playerId,
        email: formData.email,
        password: formData.password
      });
      setIsSuccess(true);
      setStatus({ 
        type: 'success', 
        message: result.message || 'Registration successful! You can now log in.' 
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Registration failed.' });
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
          <span className="accent-text">REGISTRATION</span>
        </h1>
        <p className="brand-subtitle">INITIALIZE AGENT PORTAL</p>
      </div>

      {status.message && (
        <div className={`status-msg status-msg-${status.type}`}>
          <span className="status-icon">
            {status.type === 'error' ? '⚡' : '🛡️'}
          </span>
          <div>{status.message}</div>
        </div>
      )}

      {isSuccess ? (
        <div className="registered-success-view">
          <button 
            type="button" 
            className="btn-cyber" 
            onClick={() => onNavigateToLogin(formData.playerId)}
          >
            GO TO LOGIN
          </button>
        </div>
      ) : (
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label" htmlFor="playerId">Player ID</label>
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
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <div className="input-container">
              <span className="input-icon">✉️</span>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                placeholder="EMAIL ADDRESS"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
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

          <div className="form-group">
            <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
            <div className="input-container">
              <span className="input-icon">🔑</span>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="CONFIRM PASSWORD"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-cyber" disabled={loading}>
            {loading ? 'Checking player ID...' : 'INITIALIZE REGISTRATION'}
          </button>

          <div className="form-footer-links">
            <button 
              type="button" 
              onClick={() => onNavigateToLogin()} 
              className="auth-link auth-link-primary"
              disabled={loading}
            >
              Back to Login
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
