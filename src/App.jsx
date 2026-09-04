import React, { useState } from 'react';
import LoginCard from './components/LoginCard';
import RegisterCard from './components/RegisterCard';
import ForgotPasswordCard from './components/ForgotPasswordCard';
import HostLoginCard from './components/HostLoginCard';
import SuccessTerminal from './components/SuccessTerminal';
import PlayerDashboard from './components/PlayerDashboard';
import HostDashboard from './components/HostDashboard';

export default function App() {
  const [currentView, setCurrentView] = useState(() => {
    return sessionStorage.getItem('mdc_active_view') || 'login';
  });
  const [loggedInPlayer, setLoggedInPlayer] = useState(() => {
    try {
      const saved = sessionStorage.getItem('mdc_active_player');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [prefilledPlayerId, setPrefilledPlayerId] = useState('');

  const handleNavigateToLogin = (playerId = '') => {
    if (playerId) {
      setPrefilledPlayerId(playerId);
    }
    setCurrentView('login');
    sessionStorage.setItem('mdc_active_view', 'login');
  };

  const handleLoginSuccess = (player) => {
    const activeUser = player || { playerId: 'IEEE-001' };
    setLoggedInPlayer(activeUser);
    try {
      sessionStorage.setItem('mdc_active_player', JSON.stringify(activeUser));
    } catch (e) {}

    if (activeUser?.isHost) {
      setCurrentView('host_dashboard');
      sessionStorage.setItem('mdc_active_view', 'host_dashboard');
    } else {
      setCurrentView('player_dashboard');
      sessionStorage.setItem('mdc_active_view', 'player_dashboard');
    }
  };

  const handleLogout = () => {
    setLoggedInPlayer(null);
    setCurrentView('login');
    sessionStorage.removeItem('mdc_active_player');
    sessionStorage.removeItem('mdc_active_view');
  };

  return (
    <div className="app-container">
      {/* Cybersecurity Cyber-Mystery Atmospheric Effects */}
      <div className="bg-grid"></div>
      <div className="bg-scanline"></div>

      {/* Floating Ambient Glowing Spheres */}
      <div className="glow-sphere glow-sphere-1"></div>
      <div className="glow-sphere glow-sphere-2"></div>
      <div className="glow-sphere glow-sphere-3"></div>

      {/* View routing based on React State */}
      {currentView === 'login' && (
        <LoginCard 
          defaultPlayerId={prefilledPlayerId}
          onNavigateToRegister={() => setCurrentView('register')}
          onNavigateToForgot={() => setCurrentView('forgot')}
          onNavigateToHost={() => setCurrentView('host')}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {currentView === 'register' && (
        <RegisterCard 
          onNavigateToLogin={handleNavigateToLogin}
        />
      )}

      {currentView === 'forgot' && (
        <ForgotPasswordCard 
          onNavigateToLogin={handleNavigateToLogin}
        />
      )}

      {currentView === 'host' && (
        <HostLoginCard 
          onNavigateToPlayerLogin={() => setCurrentView('login')}
          onHostLoginSuccess={(host) => {
            setLoggedInPlayer(host);
            setCurrentView('host_dashboard');
          }}
        />
      )}

      {currentView === 'player_dashboard' && loggedInPlayer && (
        <PlayerDashboard 
          player={loggedInPlayer}
          onLogout={handleLogout}
        />
      )}

      {currentView === 'host_dashboard' && loggedInPlayer && (
        <HostDashboard 
          hostUser={loggedInPlayer}
          onLogout={handleLogout}
        />
      )}

      {currentView === 'success' && loggedInPlayer && (
        <SuccessTerminal 
          player={loggedInPlayer}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}
