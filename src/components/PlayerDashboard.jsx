import React, { useState, useEffect } from 'react';
import { gameService, parseDateTimestamp } from '../services/gameService';
import LeaderboardView from './LeaderboardView';
import SudokuGameScreen from './SudokuGameScreen';

const isMobileScreen = () => typeof window !== 'undefined' && window.innerWidth <= 900;

export default function PlayerDashboard({ player, onLaunchGame, onLogout }) {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'upcoming' | 'results' | 'leaderboard'

  // Single Collapsible Sidebar State (defaults to closed on mobile, persisted on desktop)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (isMobileScreen()) return true;
    try {
      const saved = localStorage.getItem('mdc_sidebar_collapsed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });

  // Right-Side Collapsible Info HUD State (defaults to closed on mobile, persisted on desktop)
  const [isInfoPanelCollapsed, setIsInfoPanelCollapsed] = useState(() => {
    if (isMobileScreen()) return true;
    try {
      const saved = localStorage.getItem('mdc_infopanel_collapsed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });

  // Mutually exclusive toggle for Metrics HUD ONLY in mobile view
  const toggleInfoPanelCollapse = () => {
    setIsInfoPanelCollapsed(prev => {
      const next = !prev;
      if (!next && isMobileScreen()) {
        // Only in mobile view: opening HUD shuts the sidebar
        setIsCollapsed(true);
      }
      try {
        localStorage.setItem('mdc_infopanel_collapsed', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // Mutually exclusive toggle for Sidebar ONLY in mobile view
  const toggleSidebarCollapse = () => {
    setIsCollapsed(prev => {
      const nextState = !prev;
      if (!nextState && isMobileScreen()) {
        // Only in mobile view: opening Sidebar shuts the HUD
        setIsInfoPanelCollapsed(true);
      }
      try {
        localStorage.setItem('mdc_sidebar_collapsed', JSON.stringify(nextState));
      } catch (e) {}
      return nextState;
    });
  };

  // Window resize listener to ensure mutual exclusivity and mobile defaults
  useEffect(() => {
    const handleResize = () => {
      if (isMobileScreen()) {
        // On mobile, ensure they are never both open at once
        if (!isCollapsed && !isInfoPanelCollapsed) {
          setIsInfoPanelCollapsed(true);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed, isInfoPanelCollapsed]);

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileInfoExpanded, setMobileInfoExpanded] = useState(false);

  // Level 1: Categories State (Sorted by order)
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Level 2: Selected Category & Instances State
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [liveInstances, setLiveInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [attemptsMap, setAttemptsMap] = useState({});

  // Active Game State
  const [activePlayingGameId, setActivePlayingGameId] = useState(null);

  // My Results State
  const [myResults, setMyResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);

  // Overall Leaderboard State (for Stats & Top 3 Cards)
  const [overallLeaderboard, setOverallLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Broadcast Notifications State
  const [broadcasts, setBroadcasts] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readBroadcastIds, setReadBroadcastIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`mdc_read_broadcasts_${player?.playerId || 'IEEE-001'}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const playerId = player?.playerId || 'IEEE-001';

  // Load Categories on mount & attach real-time broadcast listener
  useEffect(() => {
    loadCategories();
    loadPlayerResults();
    loadLeaderboardData();

    const unsubscribe = gameService.listenToBroadcasts((list) => {
      setBroadcasts(list);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [playerId]);

  // Re-fetch data on active tab activation
  useEffect(() => {
    if (activeTab === 'results') {
      loadPlayerResults();
    } else if (activeTab === 'live') {
      loadLeaderboardData();
      loadPlayerResults();
    }
  }, [activeTab]);

  const handleToggleNotifications = () => {
    const nextState = !notificationsOpen;
    setNotificationsOpen(nextState);
    if (nextState && broadcasts.length > 0) {
      // Mark all current broadcasts as read
      const allIds = broadcasts.map(b => b.id);
      setReadBroadcastIds(allIds);
      try {
        localStorage.setItem(`mdc_read_broadcasts_${playerId}`, JSON.stringify(allIds));
      } catch (e) {}
    }
  };

  const handleMarkAllNotificationsRead = () => {
    const allIds = broadcasts.map(b => b.id);
    setReadBroadcastIds(allIds);
    try {
      localStorage.setItem(`mdc_read_broadcasts_${playerId}`, JSON.stringify(allIds));
    } catch (e) {}
  };

  const unreadBroadcastsCount = broadcasts.filter(b => !readBroadcastIds.includes(b.id)).length;

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const cats = await gameService.getCategories();
      setCategories(cats);
    } catch (err) {
      console.warn('Error loading categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadPlayerResults = async () => {
    setLoadingResults(true);
    try {
      const attempts = await gameService.getPlayerAttempts(playerId);
      const submittedOnly = attempts.filter(a => a.status === 'submitted');
      setMyResults(submittedOnly);
    } catch (err) {
      console.warn('Error loading player results:', err);
    } finally {
      setLoadingResults(false);
    }
  };

  const loadLeaderboardData = async () => {
    setLoadingLeaderboard(true);
    try {
      const data = await gameService.getOverallLeaderboard();
      setOverallLeaderboard(data);
    } catch (e) {
      console.warn('Error loading overall leaderboard:', e);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const getSoonestCategoryCountdown = () => {
    if (!categories || categories.length === 0) return null;
    const now = Date.now();
    const activeCats = categories.filter(c => c.active && (c.endDate || c.endTime));
    if (activeCats.length === 0) return null;

    let soonestCat = null;
    let minRemaining = Infinity;

    for (const cat of activeCats) {
      const endVal = cat.endDate || cat.endTime;
      const endMillis = parseDateTimestamp ? parseDateTimestamp(endVal, true) : new Date(endVal).getTime();
      if (endMillis > now && (endMillis - now) < minRemaining) {
        minRemaining = endMillis - now;
        soonestCat = cat;
      }
    }

    if (!soonestCat || minRemaining === Infinity) return null;

    const totalSec = Math.floor(minRemaining / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);

    let timeStr = '';
    if (days > 1) {
      timeStr = `${days} days left`;
    } else if (days === 1) {
      timeStr = `1 day ${hours}h left`;
    } else if (hours > 0) {
      timeStr = `${hours}h ${minutes}m left`;
    } else {
      timeStr = `${Math.max(1, minutes)} mins left`;
    }

    return {
      timeStr,
      categoryName: soonestCat.name
    };
  };

  const getUrgentBroadcasts = () => {
    if (!broadcasts || broadcasts.length === 0) return [];
    return broadcasts
      .filter(b => b.urgent === true || b.type === 'urgent' || (b.type && String(b.type).toLowerCase() === 'urgent'))
      .slice(0, 3);
  };

  // Load Level 2 instances when a category is selected
  const handleSelectCategory = async (category) => {
    if (!category.active) return;
    setSelectedCategory(category);
    setLoadingInstances(true);

    try {
      const games = await gameService.getInstancesByCategory(category.id);
      setLiveInstances(games);

      // Fetch attempt status for each game
      const attemptsObj = {};
      for (const g of games) {
        const att = await gameService.getAttempt(playerId, g.id);
        if (att) {
          attemptsObj[g.id] = att;
        }
      }
      setAttemptsMap(attemptsObj);
    } catch (err) {
      console.warn('Error loading instances:', err);
    } finally {
      setLoadingInstances(false);
    }
  };

  // Auto-evaluate expiration every 5 seconds for live instances on screen
  useEffect(() => {
    if (!selectedCategory || liveInstances.length === 0) return;

    const interval = setInterval(() => {
      setLiveInstances(prev => prev.map(inst => {
        if (inst.status !== 'closed' && gameService.isExpired(inst, selectedCategory)) {
          gameService.updateGameStatus(inst.id, 'closed').catch(() => {});
          return { ...inst, status: 'closed' };
        }
        return inst;
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedCategory, liveInstances]);

  const handleReturnToCategories = () => {
    setSelectedCategory(null);
    setActivePlayingGameId(null);
    loadCategories();
  };

  const handleStartPlay = (gameId) => {
    if (onLaunchGame) {
      onLaunchGame(gameId);
    }
    setActivePlayingGameId(gameId);
  };

  const getInitials = () => {
    if (!player) return 'P1';
    if (player.firstName && player.lastName) {
      return `${player.firstName[0]}${player.lastName[0]}`.toUpperCase();
    }
    return (player.playerId || 'P1').substring(0, 2).toUpperCase();
  };

  const formatDateTimeFull = (str) => {
    if (!str) return { datePart: 'TBD', timePart: null, fullText: 'TBD' };
    try {
      const d = new Date(str);
      if (isNaN(d.getTime())) return { datePart: String(str), timePart: null, fullText: String(str) };

      const hasTime = String(str).includes('T') || (String(str).includes(':') && !String(str).match(/^\d{4}-\d{2}-\d{2}$/));
      const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      if (hasTime) {
        const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        return { datePart, timePart, fullText: `${datePart} · ${timePart}` };
      }
      return { datePart, timePart: null, fullText: datePart };
    } catch (e) {
      return { datePart: String(str), timePart: null, fullText: String(str) };
    }
  };

  const renderTimeWindow = (startTime, endTime) => {
    const startObj = formatDateTimeFull(startTime);
    const endObj = formatDateTimeFull(endTime);

    return (
      <div className="time-window-display">
        <div className="time-window-row">
          <span className="time-window-label">START:</span>
          <span className="time-window-val">
            {startObj.datePart}
            {startObj.timePart && (
              <>
                <span className="time-window-dot">·</span>
                {startObj.timePart}
              </>
            )}
          </span>
        </div>
        <div className="time-window-row">
          <span className="time-window-label">END:</span>
          <span className="time-window-val">
            {endObj.datePart}
            {endObj.timePart && (
              <>
                <span className="time-window-dot">·</span>
                {endObj.timePart}
              </>
            )}
          </span>
        </div>
      </div>
    );
  };

  const formatSeriesDates = (start, end) => {
    if (!start && !end) return 'Open Window';
    try {
      const s = formatDateTimeFull(start).fullText;
      const e = formatDateTimeFull(end).fullText;
      if (s && e) return `${s} – ${e}`;
      return s || e;
    } catch (e) {
      return `${start} – ${end}`;
    }
  };

  const renderInfoBoxes = () => (
    <>
      {/* Box 1 — Your Stats */}
      <div className="bracket-card side-info-card info-box-stats">
        <div className="side-info-card-header">
          <h3 className="side-info-card-title">
            <span>👤</span> YOUR STATS
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-cyber)' }}>
            {playerId}
          </span>
        </div>

        {(() => {
          const myLeaderboardEntry = overallLeaderboard.find(e => String(e.playerId).trim() === String(playerId).trim());
          if (myLeaderboardEntry) {
            return (
              <div className="info-box-stats-grid">
                <div className="stat-mini-badge">
                  <div className="stat-mini-label">OVERALL RANK</div>
                  <div className="stat-mini-val" style={{ color: '#facc15' }}>
                    #{myLeaderboardEntry.rank}
                  </div>
                </div>
                <div className="stat-mini-badge">
                  <div className="stat-mini-label">TOTAL SCORE</div>
                  <div className="stat-mini-val">
                    {myLeaderboardEntry.totalScore}
                  </div>
                </div>
                <div className="stat-mini-badge">
                  <div className="stat-mini-label">SOLVED</div>
                  <div className="stat-mini-val" style={{ color: '#10b981' }}>
                    {myLeaderboardEntry.gamesCompleted}
                  </div>
                </div>
              </div>
            );
          }
          if (myResults.length > 0) {
            return (
              <div className="info-box-stats-grid">
                <div className="stat-mini-badge">
                  <div className="stat-mini-label">RANK</div>
                  <div className="stat-mini-val" style={{ color: '#facc15' }}>
                    -
                  </div>
                </div>
                <div className="stat-mini-badge">
                  <div className="stat-mini-label">SCORE</div>
                  <div className="stat-mini-val">
                    {myResults.reduce((acc, r) => acc + (r.score || 0), 0)}
                  </div>
                </div>
                <div className="stat-mini-badge">
                  <div className="stat-mini-label">SOLVED</div>
                  <div className="stat-mini-val" style={{ color: '#10b981' }}>
                    {myResults.length}
                  </div>
                </div>
              </div>
            );
          }
          return (
            <div className="info-box-empty">
              Play your first mission to see your stats here
            </div>
          );
        })()}
      </div>

      {/* Box 2 — Top 3 Leaderboard */}
      <div className="bracket-card side-info-card info-box-leaderboard">
        <div className="side-info-card-header">
          <h3 className="side-info-card-title">
            <span>🏆</span> TOP 3 LEADERBOARD
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>
            OVERALL
          </span>
        </div>

        {(() => {
          const top3 = overallLeaderboard.slice(0, 3);
          if (top3.length > 0) {
            return (
              <div className="mini-leaderboard-list">
                {top3.map((entry) => {
                  const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉';
                  const medalColor = entry.rank === 1 ? '#facc15' : entry.rank === 2 ? '#94a3b8' : '#cd7f32';
                  const isMe = entry.playerId === playerId;

                  return (
                    <div 
                      key={entry.playerId} 
                      className="mini-leaderboard-row"
                      style={{
                        borderColor: isMe ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.08)',
                        background: isMe ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255, 255, 255, 0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span className="mini-leaderboard-rank" style={{ color: medalColor }}>
                          {medal} #{entry.rank}
                        </span>
                        <span 
                          style={{ 
                            fontWeight: isMe ? 800 : 600, 
                            color: isMe ? 'var(--accent-cyan)' : 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={entry.playerId}
                        >
                          {entry.playerId} {isMe && '(You)'}
                        </span>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--accent-light)', fontFamily: 'var(--font-cyber)', flexShrink: 0 }}>
                        {entry.totalScore} PTS
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          }
          return (
            <div className="info-box-empty">
              No rankings recorded yet
            </div>
          );
        })()}

        <button
          type="button"
          className="mini-card-link"
          onClick={() => setActiveTab('leaderboard')}
        >
          View Full Leaderboard →
        </button>
      </div>

      {/* Box 3 — Event Countdown */}
      <div className="bracket-card side-info-card info-box-countdown">
        <div className="side-info-card-header">
          <h3 className="side-info-card-title">
            <span>⏳</span> EVENT COUNTDOWN
          </h3>
        </div>

        {(() => {
          const countdown = getSoonestCategoryCountdown();
          if (countdown) {
            return (
              <div className="countdown-display-box">
                <div className="countdown-time-val">
                  {countdown.timeStr}
                </div>
                <div className="countdown-subtext">
                  Until {countdown.categoryName} closes
                </div>
              </div>
            );
          }
          return (
            <div className="info-box-empty">
              Event details coming soon
            </div>
          );
        })()}
      </div>

      {/* Box 4 — Urgent Broadcasts */}
      <div className="bracket-card side-info-card side-info-card-urgent">
        <div className="side-info-card-header" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <h3 className="side-info-card-title">
            <span>🚨</span> URGENT BROADCASTS
          </h3>
          {(() => {
            const urgentList = getUrgentBroadcasts();
            return urgentList.length > 0 ? (
              <span className="pill-badge" style={{ background: 'rgba(239, 68, 68, 0.25)', color: '#f87171', border: '1px solid #ef4444', fontSize: '0.75rem', padding: '2px 8px' }}>
                {urgentList.length} ACTIVE
              </span>
            ) : null;
          })()}
        </div>

        {(() => {
          const urgentList = getUrgentBroadcasts();
          if (urgentList.length > 0) {
            return (
              <div>
                {urgentList.map((b) => (
                  <div key={b.id} className="urgent-item-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: '#fca5a5' }}>
                        {b.title || 'Urgent Notice'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>
                        {b.createdAtString || 'Recently'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                      {b.message}
                    </p>
                  </div>
                ))}
              </div>
            );
          }
          return (
            <div className="info-box-empty" style={{ color: 'var(--text-muted)' }}>
              No urgent announcements
            </div>
          );
        })()}
      </div>
    </>
  );

  const navItems = [
    { id: 'live', label: 'LIVE GAMES', icon: '🎮' },
    { id: 'results', label: 'MY RESULTS', icon: '📊' },
    { id: 'leaderboard', label: 'LEADERBOARD', icon: '🏆' }
  ];

  return (
    <div className="dashboard-layout full-screen-stretch">
      {/* Top Header Bar */}
      <header className="dashboard-header">
        <div className="header-left">
          {/* Hamburger Icon toggles the single collapsible sidebar */}
          <button 
            type="button" 
            className="hamburger-btn"
            onClick={toggleSidebarCollapse}
            title={isCollapsed ? 'Expand Sidebar Menu' : 'Collapse Sidebar Menu'}
            aria-label="Toggle Sidebar Menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="brand-logo-area">
            <h1 className="brand-title">
              COGNITIONIS <span className="accent-text">NEXUS</span>
            </h1>
            <p className="brand-subtitle">EXPANDING YOUR COGNITIVE HORIZON</p>
          </div>
        </div>

        <div className="header-right">
          {/* Notification Bell with Broadcast Feed */}
          <div className="bell-wrapper" title="Command Broadcasts">
            <button 
              type="button" 
              className={`bell-btn ${unreadBroadcastsCount > 0 ? 'has-unread' : ''}`}
              onClick={handleToggleNotifications}
              aria-label="Notifications"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {unreadBroadcastsCount > 0 && (
                <span className="notification-count-badge">
                  {unreadBroadcastsCount > 9 ? '9+' : unreadBroadcastsCount}
                </span>
              )}
            </button>

            {/* Floating Broadcast Notifications Dropdown */}
            {notificationsOpen && (
              <div className="notifications-dropdown-menu">
                <div className="notifications-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--accent-cyan)' }}>📡</span>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', fontFamily: 'var(--font-cyber)', color: 'var(--text-primary)' }}>
                      COMMAND BROADCASTS
                    </span>
                  </div>
                  {broadcasts.length > 0 && (
                    <button 
                      type="button" 
                      className="auth-link" 
                      onClick={handleMarkAllNotificationsRead}
                      style={{ fontSize: '0.8rem' }}
                    >
                      ✓ Mark all read
                    </button>
                  )}
                </div>

                <div className="notifications-list-body">
                  {broadcasts.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                      <span style={{ display: 'block', fontSize: '1.5rem', marginBottom: '4px' }}>📭</span>
                      No broadcast notifications from event command yet.
                    </div>
                  ) : (
                    broadcasts.map((b) => {
                      const isUnread = !readBroadcastIds.includes(b.id);
                      return (
                        <div 
                          key={b.id} 
                          className={`notification-item ${isUnread ? 'unread-item' : ''}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span 
                              className="pill-badge"
                              style={{
                                background: b.type === 'urgent' ? 'rgba(239, 68, 68, 0.2)' : b.type === 'warning' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                                color: b.type === 'urgent' ? '#f87171' : b.type === 'warning' ? '#facc15' : 'var(--accent-cyan)',
                                border: `1px solid ${b.type === 'urgent' ? '#ef4444' : b.type === 'warning' ? '#eab308' : 'var(--accent-cyan)'}`,
                                fontSize: '0.75rem',
                                padding: '2px 8px'
                              }}
                            >
                              {b.type === 'urgent' ? '🚨 URGENT' : b.type === 'warning' ? '⚠️ WARNING' : b.type === 'info' ? 'ℹ️ INFO' : '📢 ANNOUNCEMENT'}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>
                              {b.createdAtString || 'Recently'}
                            </span>
                          </div>

                          <div style={{ fontWeight: 700, fontSize: '0.92rem', color: isUnread ? 'var(--accent-cyan)' : 'var(--text-primary)', marginBottom: '4px' }}>
                            {b.title}
                          </div>

                          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                            {b.message}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Metrics HUD Toggle Button for Live Games */}
          {activeTab === 'live' && !selectedCategory && !activePlayingGameId && (
            <button
              type="button"
              className={`hud-toggle-btn ${!isInfoPanelCollapsed ? 'active' : ''}`}
              onClick={toggleInfoPanelCollapse}
              title={isInfoPanelCollapsed ? "Show Metrics HUD" : "Hide Metrics HUD"}
              aria-label="Toggle Metrics HUD"
            >
              <span>📊</span>
              <span>METRICS HUD</span>
            </button>
          )}

          {/* Profile Avatar & Dropdown */}
          <div className="profile-wrapper">
            <button 
              type="button" 
              className="user-avatar-btn" 
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            >
              {getInitials()}
            </button>

            {profileDropdownOpen && (
              <div className="profile-dropdown-menu">
                <div className="profile-info-header">
                  <div className="profile-name">{player?.firstName ? `${player.firstName} ${player.lastName}` : player?.playerId}</div>
                  <div className="profile-id">ID: {player?.playerId || 'IEEE-001'}</div>
                  <div className="profile-email">{player?.email || 'agent@ieee.org'}</div>
                </div>
                <button 
                  type="button" 
                  className="dropdown-logout-btn" 
                  onClick={onLogout}
                >
                  🚪 DISCONNECT SESSION
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Body with Single Collapsible Sidebar */}
      <div className="workspace-body-container">
        {/* Mobile Backdrop for Sidebar when open on narrow screens */}
        {!isCollapsed && (
          <div 
            className="sidebar-backdrop" 
            onClick={() => setIsCollapsed(true)} 
            aria-hidden="true" 
          />
        )}

        {/* Single Collapsible Left Sidebar */}
        <aside className={`collapsible-sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}>
          <div className="sidebar-header-row">
            {!isCollapsed && <span className="sidebar-section-label">NAVIGATION</span>}
            <button 
              type="button" 
              className="sidebar-collapse-toggle-btn"
              onClick={toggleSidebarCollapse}
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isCollapsed ? '»' : '«'}
            </button>
          </div>

          <nav className="sidebar-menu-nav">
            {navItems.map((item) => (
              <button 
                key={item.id}
                type="button" 
                className={`sidebar-nav-btn ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setActivePlayingGameId(null);
                  if (isMobileScreen()) {
                    setIsCollapsed(true);
                  }
                }}
                title={isCollapsed ? item.label : ''}
              >
                <span className="nav-icon">{item.icon}</span>
                {!isCollapsed && <span className="nav-label">{item.label}</span>}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer-action">
            <button 
              type="button" 
              className="btn-sidebar-logout" 
              onClick={onLogout}
              title={isCollapsed ? 'Disconnect Session' : ''}
            >
              <span className="nav-icon">🚪</span>
              {!isCollapsed && <span className="nav-label">DISCONNECT SESSION</span>}
            </button>
          </div>
        </aside>

        {/* Stretched Main Content Area */}
        <main className="dashboard-content-area flex-1">
          {/* 1. ACTIVE GAME PLAY VIEW (IF PLAYING) */}
          {activePlayingGameId ? (
            <SudokuGameScreen
              player={player}
              gameId={activePlayingGameId}
              onBackToMissions={() => {
                setActivePlayingGameId(null);
                if (selectedCategory) {
                  handleSelectCategory(selectedCategory);
                }
                loadPlayerResults();
              }}
            />
          ) : (
            <>
              {/* LIVE GAMES TAB */}
              {activeTab === 'live' && (
                <div className="tab-pane">
                  {/* LEVEL 1: CATEGORIES VIEW */}
                  {!selectedCategory ? (
                    <div>
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h2 className="section-title">GAMES</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
                          Select an active game to access live missions and puzzle challenges.
                        </p>
                      </div>

                      {loadingCategories ? (
                        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                          <div className="cyber-loader" style={{ margin: '0 auto 1rem' }}></div>
                          <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-cyber)' }}>
                            LOADING GAMES...
                          </span>
                        </div>
                      ) : categories.length === 0 ? (
                        <div className="empty-state-card bracket-card">
                          <p className="empty-state-title">NO GAMES AVAILABLE YET</p>
                          <p className="empty-state-desc">Event organizers are finalizing game deployment.</p>
                        </div>
                      ) : (
                        <>
                          <div className="games-cards-grid">
                            {categories.map((cat) => (
                              <div
                                key={cat.id}
                                className={`bracket-card game-card category-card ${!cat.active ? 'category-card-disabled' : ''}`}
                                onClick={() => cat.active && handleSelectCategory(cat)}
                                style={{
                                  cursor: cat.active ? 'pointer' : 'not-allowed',
                                  opacity: cat.active ? 1 : 0.6,
                                  filter: cat.active ? 'none' : 'grayscale(60%) blur(0.5px)',
                                  position: 'relative'
                                }}
                              >
                                <div className="card-top-badges">
                                  <span className={`pill-badge ${cat.active ? 'badge-status-live' : 'badge-status-closed'}`}>
                                    {cat.active ? 'ACTIVE GAME' : 'COMING SOON'}
                                  </span>
                                </div>

                                <h3 className="game-card-title">{cat.name}</h3>
                                <p className="game-card-desc">{cat.description}</p>

                                {renderTimeWindow(cat.startDate, cat.endDate)}

                                <button
                                  type="button"
                                  className={`btn-action-primary ${cat.active ? 'btn-play' : 'btn-action-disabled'}`}
                                  disabled={!cat.active}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (cat.active) handleSelectCategory(cat);
                                  }}
                                >
                                  {cat.active ? 'ENTER MISSIONS →' : '🔒 LOCKED (COMING SOON)'}
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Mobile-Only Opt-In Info Section (Below Category Cards) */}
                          <div className="mobile-info-section">
                            {/* Urgent Broadcast Compact Preview Line (only if any urgent exists) */}
                            {(() => {
                              const urgentList = getUrgentBroadcasts();
                              if (urgentList.length > 0) {
                                const count = urgentList.length;
                                return (
                                  <div 
                                    className="mobile-urgent-preview-banner"
                                    onClick={() => setMobileInfoExpanded(true)}
                                    role="button"
                                    tabIndex={0}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '1rem' }}>🚨</span>
                                      <span style={{ fontSize: '0.82rem', color: '#fca5a5', fontWeight: 700 }}>
                                        {count} urgent {count === 1 ? 'announcement' : 'announcements'} — tap to view
                                      </span>
                                    </div>
                                    <span style={{ color: '#f87171', fontWeight: 800, fontSize: '0.9rem' }}>›</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}

                            {/* Collapsed Toggle Button */}
                            <button
                              type="button"
                              className="btn-mobile-info-toggle"
                              onClick={() => setMobileInfoExpanded(prev => !prev)}
                              aria-expanded={mobileInfoExpanded}
                            >
                              <span>📊</span>
                              <span>{mobileInfoExpanded ? 'Hide Stats & Announcements ▴' : 'Show Stats & Announcements ▾'}</span>
                            </button>

                            {/* Expanded Four Boxes Stack on Mobile */}
                            {mobileInfoExpanded && (
                              <div className="mobile-info-cards-stack">
                                {renderInfoBoxes()}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    /* LEVEL 2: INSTANCES VIEW */
                    <div>
                      {/* Breadcrumb Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        marginBottom: '1.5rem',
                        paddingBottom: '0.75rem',
                        borderBottom: '1px solid rgba(168, 85, 247, 0.2)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <button
                            type="button"
                            className="btn-back-nav"
                            onClick={handleReturnToCategories}
                            title="Back to Games"
                            aria-label="Back to Games"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="19" y1="12" x2="5" y2="12"></line>
                              <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                            <span>BACK TO GAMES</span>
                          </button>
                          <h2 className="section-title" style={{ margin: 0 }}>
                            MISSIONS: {selectedCategory.name}
                          </h2>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn-refresh-nav"
                            onClick={() => handleSelectCategory(selectedCategory)}
                            title="Refresh puzzle list"
                          >
                            <span>↻ REFRESH</span>
                          </button>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                            borderRadius: '6px',
                            padding: '4px 10px',
                            fontSize: '0.8rem'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)', fontWeight: 700, fontSize: '0.75rem', width: '45px' }}>START:</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatDateTimeFull(selectedCategory.startDate).fullText}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)', fontWeight: 700, fontSize: '0.75rem', width: '45px' }}>END:</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatDateTimeFull(selectedCategory.endDate).fullText}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {loadingInstances ? (
                        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                          <div className="cyber-loader" style={{ margin: '0 auto 1rem' }}></div>
                          <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-cyber)' }}>
                            LOADING LIVE MISSIONS...
                          </span>
                        </div>
                      ) : liveInstances.length === 0 ? (
                        <div className="empty-state-card bracket-card">
                          <p className="empty-state-title">NO LIVE SUDOKU PUZZLES RIGHT NOW</p>
                          <p className="empty-state-desc">No live Sudoku puzzles right now — check back soon</p>
                          <button
                            type="button"
                            className="btn-back-nav btn-back-nav-prominent"
                            onClick={handleReturnToCategories}
                            style={{ marginTop: '1.25rem' }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="19" y1="12" x2="5" y2="12"></line>
                              <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                            <span>RETURN TO GAMES</span>
                          </button>
                        </div>
                      ) : (
                        <div className="games-cards-grid">
                          {liveInstances.map((game) => {
                            const att = attemptsMap[game.id];
                            const isSubmitted = att?.status === 'submitted';
                            const isInProgress = att?.status === 'in_progress';
                            const status = (game.status || 'live').toLowerCase();
                            const isUpcoming = status === 'upcoming';
                            const isClosed = status === 'closed';

                            return (
                              <div key={game.id} className="bracket-card game-card">
                                <div className="card-top-badges">
                                  {isSubmitted ? (
                                    <span className="pill-badge badge-solved">✓ COMPLETED</span>
                                  ) : isUpcoming ? (
                                    <span className="pill-badge badge-status-upcoming">UPCOMING</span>
                                  ) : isClosed ? (
                                    <span className="pill-badge badge-status-closed">CLOSED</span>
                                  ) : isInProgress ? (
                                    <span className="pill-badge badge-medium" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' }}>
                                      IN PROGRESS
                                    </span>
                                  ) : (
                                    <span className="pill-badge badge-not-started">AVAILABLE</span>
                                  )}
                                </div>

                                <h3 className="game-card-title">{game.title}</h3>

                                {renderTimeWindow(game.startTime, game.endTime)}

                                {isSubmitted ? (
                                  <div style={{
                                    marginTop: '1rem',
                                    padding: '0.75rem',
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(16, 185, 129, 0.25)',
                                    fontSize: '0.85rem'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontWeight: 'bold' }}>
                                      <span>SCORE: {att.score} PTS</span>
                                      <span>{att.correctCells} / 81 ACCURACY</span>
                                    </div>
                                    <button
                                      type="button"
                                      className="btn-action-primary btn-replay"
                                      style={{ marginTop: '0.5rem', width: '100%' }}
                                      onClick={() => handleStartPlay(game.id)}
                                    >
                                      VIEW RESULTS
                                    </button>
                                  </div>
                                ) : isUpcoming ? (
                                  <button
                                    type="button"
                                    className="btn-action-primary btn-action-disabled"
                                    disabled
                                    style={{ marginTop: '1.25rem', cursor: 'not-allowed', opacity: 0.6 }}
                                  >
                                    ⏳ UPCOMING (LOCKED)
                                  </button>
                                ) : isClosed ? (
                                  <button
                                    type="button"
                                    className="btn-action-primary btn-action-disabled"
                                    disabled
                                    style={{ marginTop: '1.25rem', cursor: 'not-allowed', opacity: 0.6 }}
                                  >
                                    🔒 PUZZLE CLOSED
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className={`btn-action-primary ${isInProgress ? 'btn-replay' : 'btn-play'}`}
                                    onClick={() => handleStartPlay(game.id)}
                                    style={{ marginTop: '1.25rem' }}
                                  >
                                    {isInProgress ? '↻ RESUME MISSION' : '▶ PLAY MISSION'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MY RESULTS TAB */}
              {activeTab === 'results' && (
                <div className="tab-pane">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <h2 className="section-title" style={{ margin: 0 }}>MY MISSION RESULTS</h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '4px 0 0 0' }}>
                        Your verified mission scores and decryption records.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-refresh-nav"
                      onClick={loadPlayerResults}
                      title="Refresh results records"
                    >
                      <span>↻ REFRESH</span>
                    </button>
                  </div>

                  {loadingResults ? (
                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                      <div className="cyber-loader" style={{ margin: '0 auto 1rem' }}></div>
                      <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-cyber)' }}>
                        RETRIEVING AGENT RECORDS...
                      </span>
                    </div>
                  ) : myResults.length === 0 ? (
                    <div className="empty-state-card bracket-card">
                      <p className="empty-state-title">YOU HAVEN'T COMPLETED ANY MISSIONS YET</p>
                      <p className="empty-state-desc">Jump into an active series mission to record your score and secure a rank!</p>
                      <button
                        type="button"
                        className="btn-back-nav btn-back-nav-prominent"
                        onClick={() => setActiveTab('live')}
                        style={{ marginTop: '1.25rem' }}
                      >
                        <span>🎮 GO TO LIVE GAMES</span>
                      </button>
                    </div>
                  ) : (
                    <div className="desktop-table-container bracket-card">
                      <table className="cyber-table">
                        <thead>
                          <tr>
                            <th>MISSION & CATEGORY</th>
                            <th>SCORE</th>
                            <th>TIME TAKEN</th>
                            <th>ACCURACY</th>
                            <th>STATUS</th>
                            <th>SUBMITTED AT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myResults.map((res) => (
                            <tr key={res.id}>
                              <td className="game-title-col">
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                  {res.gameTitle || res.gameId}
                                </div>
                                {res.categoryName && (
                                  <span style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-cyber)', display: 'block', marginTop: '3px' }}>
                                    📁 {res.categoryName}
                                  </span>
                                )}
                              </td>
                              <td className="score-col">{res.score} PTS</td>
                              <td>{res.timeTakenSec ? `${Math.floor(res.timeTakenSec / 60)}m ${res.timeTakenSec % 60}s` : 'N/A'}</td>
                              <td>{res.correctCells} / 81</td>
                              <td>
                                <span className="status-icon-solved">✓ SUBMITTED</span>
                              </td>
                              <td className="date-col">{res.submittedAtString || 'Recently'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* LEADERBOARD TAB */}
              {activeTab === 'leaderboard' && (
                <div className="tab-pane">
                  <LeaderboardView role="player" />
                </div>
              )}
            </>
          )}
        </main>

        {/* Right-Side Fixed/Collapsible Info Panel (Navbar-style HUD) */}
        {activeTab === 'live' && !selectedCategory && !activePlayingGameId && (
          <>
            {/* Mobile Backdrop to click-to-close on narrow screens */}
            {!isInfoPanelCollapsed && (
              <div 
                className="info-panel-backdrop" 
                onClick={toggleInfoPanelCollapse}
                aria-hidden="true"
              />
            )}

            <aside className={`collapsible-info-panel ${isInfoPanelCollapsed ? 'collapsed' : 'expanded'}`}>
              <div className="info-panel-inner-container">
                {/* Header inside Panel */}
                <div className="info-panel-header-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.9rem' }}>⚡</span>
                    <span className="info-panel-section-label">METRICS HUD</span>
                  </div>
                  <button
                    type="button"
                    className="info-panel-close-btn"
                    onClick={toggleInfoPanelCollapse}
                    title="Hide Metrics Panel"
                    aria-label="Hide Metrics Panel"
                  >
                    ✕
                  </button>
                </div>

                <div className="info-panel-content-scroll">
                  {renderInfoBoxes()}
                </div>
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
