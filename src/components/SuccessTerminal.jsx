import React, { useState, useEffect, useRef } from 'react';

export default function SuccessTerminal({ player, onLogout }) {
  const [logs, setLogs] = useState([]);
  const [bootCompleted, setBootCompleted] = useState(false);
  const terminalEndRef = useRef(null);

  const bootSequence = [
    { text: '>> INITIALIZING SECURE DECRYPTION PROTOCOL...', type: 'info' },
    { text: '>> ESTABLISHING QUANTUM HANDSHAKE WITH IEEE GATEWAY...', type: 'info' },
    { text: '>> CONNECTING IP COORDINATES: 192.168.42.254', type: 'info' },
    { text: '>> BYPASSING FIREWALL DEFENSIVE GRID...', type: 'warning' },
    { text: '>> DECRYPTING AGENT SIGNATURE KEY...', type: 'warning' },
    { text: `>> SIGNATURE VERIFIED: Hash match: ${player.playerId.toLowerCase()}-key-0x9F3`, type: 'success' },
    { text: `>> PROFILE DETECTED: Agent ${player.firstName} ${player.lastName}`, type: 'success' },
    { text: '>> RETRIEVING COMPETITION PUZZLE GRID COORDINATES...', type: 'info' },
    { text: '>> SECURITY CLEARANCE VERIFIED: LEVEL 1 // INFILTRATOR', type: 'highlight' },
    { text: '---------------------------------------------------', type: 'info' },
    { text: 'ACCESS GRANTED. SESSION INITIALIZED SUCCESSFULLY.', type: 'success' },
    { text: '>> Type "help" to list active intelligence operations.', type: 'info' }
  ];

  // Run the diagnostic typing effect sequence
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < bootSequence.length) {
        setLogs((prev) => [...prev, bootSequence[index]]);
        index++;
      } else {
        clearInterval(interval);
        setBootCompleted(true);
      }
    }, 400);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom of terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="auth-card terminal-card">
      <div className="card-header-bar"></div>
      
      <div className="terminal-header">
        <div className="terminal-controls">
          <span className="terminal-dot terminal-dot-red"></span>
          <span className="terminal-dot terminal-dot-yellow"></span>
          <span className="terminal-dot terminal-dot-green"></span>
        </div>
        <div className="terminal-title">MDC-SECURE-TERMINAL // TERMINAL_ID: {player.playerId}</div>
        <div style={{ width: '50px' }}></div>
      </div>

      <div className="terminal-body">
        {logs.map((log, index) => (
          <div key={index} className={`terminal-line ${log.type}`}>
            {log.text}
          </div>
        ))}
        {!bootCompleted && <span className="terminal-cursor"></span>}
        <div ref={terminalEndRef} />
      </div>

      {bootCompleted && (
        <div style={{ marginTop: '2rem', animation: 'slide-down 0.5s ease-out' }}>
          <div style={{ 
            background: 'rgba(168, 85, 247, 0.05)', 
            border: '1px solid rgba(168, 85, 247, 0.2)', 
            borderRadius: '8px', 
            padding: '1.25rem',
            marginBottom: '1.5rem',
            textAlign: 'left'
          }}>
            <h3 style={{ fontFamily: 'var(--font-cyber)', color: 'var(--accent-light)', marginBottom: '0.5rem', fontSize: '0.9rem', letterSpacing: '1px' }}>
              AGENT IDENTITY VERIFIED
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 16px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>PLAYER ID:</span>
              <span style={{ fontFamily: 'var(--font-cyber)', color: 'white' }}>{player.playerId}</span>
              
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>AGENT NAME:</span>
              <span style={{ color: 'white' }}>{player.firstName} {player.lastName}</span>
              
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>COORDINATES:</span>
              <span style={{ color: 'white' }}>{player.email}</span>
              
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>GATE CLEARANCE:</span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>APPROVED (LEVEL 1)</span>
            </div>
          </div>

          <button 
            type="button" 
            className="btn-cyber" 
            style={{ background: 'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 100%)', borderColor: 'rgba(168, 85, 247, 0.3)' }}
            onClick={onLogout}
          >
            DISCONNECT SECURE SESSION
          </button>
        </div>
      )}
    </div>
  );
}
