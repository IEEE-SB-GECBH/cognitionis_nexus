import React, { useState, useEffect } from 'react';
import { gameService } from '../services/gameService';
import LeaderboardView from './LeaderboardView';
import ConfirmDialog from './ConfirmDialog';
import Toast from './Toast';

const isMobileScreen = () => typeof window !== 'undefined' && window.innerWidth <= 900;

export default function HostDashboard({ hostUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('games'); // 'games' | 'results' | 'leaderboard'

  // Single Collapsible Sidebar State with localStorage persistence (defaults to closed on mobile)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (isMobileScreen()) return true;
    try {
      const saved = localStorage.getItem('mdc_sidebar_collapsed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch (e) {
      return false;
    }
  });

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState({ message: '', type: 'info' });

  // Categories & Games Data
  const [categories, setCategories] = useState([]);
  const [games, setGames] = useState([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Player Results Tab Data
  const [selectedResultGameId, setSelectedResultGameId] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [viewingSubmission, setViewingSubmission] = useState(null);

  // Modal: Add Category
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryForm, setNewCategoryForm] = useState({
    name: '',
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    active: true
  });

  // Modal: Add Game
  const [showAddGameModal, setShowAddGameModal] = useState(false);
  const [newGameForm, setNewGameForm] = useState({
    categoryId: '',
    title: '',
    questionGrid: '530070000\n600195000\n098000060\n800060003\n400803001\n700020006\n060000280\n000419005\n000080079',
    answerGrid: '534678912\n672195348\n198342567\n859761423\n426853791\n713924856\n961537284\n287419635\n345286179',
    startTime: new Date().toISOString().substring(0, 16),
    endTime: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 16),
    status: 'live'
  });
  const [gridError, setGridError] = useState('');

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    danger: false,
    onConfirm: null
  });

  // Broadcast Center State
  const [broadcasts, setBroadcasts] = useState([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
    type: 'announcement'
  });
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const cats = await gameService.getCategories();
      setCategories(cats);

      const allGames = await gameService.getAllGames();
      setGames(allGames);
      if (allGames.length > 0 && !selectedResultGameId) {
        setSelectedResultGameId(allGames[0].id);
      }

      await loadBroadcasts();
    } catch (err) {
      setToast({ message: 'Error loading host data: ' + err.message, type: 'error' });
    }
  };

  const loadBroadcasts = async () => {
    setLoadingBroadcasts(true);
    try {
      const list = await gameService.getBroadcasts();
      setBroadcasts(list);
    } catch (e) {
      console.warn('Error loading broadcasts:', e);
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) {
      setToast({ message: 'Please provide both title and message.', type: 'error' });
      return;
    }
    setSendingBroadcast(true);
    try {
      const created = await gameService.sendBroadcast({
        title: broadcastForm.title,
        message: broadcastForm.message,
        type: broadcastForm.type
      });
      setBroadcasts(prev => [created, ...prev]);
      setBroadcastForm({ title: '', message: '', type: 'announcement' });
      setToast({ message: 'Broadcast notification dispatched to all players!', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to send broadcast: ' + err.message, type: 'error' });
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleDeleteBroadcast = (broadcast) => {
    setConfirmDialog({
      isOpen: true,
      title: 'DELETE BROADCAST MESSAGE',
      message: `Delete broadcast "${broadcast.title}"? Players will no longer see this notification in their feed.`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false });
        try {
          await gameService.deleteBroadcast(broadcast.id);
          setBroadcasts(prev => prev.filter(b => b.id !== broadcast.id));
          setToast({ message: 'Broadcast notification deleted.', type: 'success' });
        } catch (err) {
          setToast({ message: 'Error deleting broadcast: ' + err.message, type: 'error' });
        }
      }
    });
  };

  // Auto-evaluate expiration every 5 seconds for games in Host Dashboard
  useEffect(() => {
    if (games.length === 0) return;

    const interval = setInterval(() => {
      setGames(prev => prev.map(g => {
        const cat = categories.find(c => c.id === g.categoryId);
        if (g.status !== 'closed' && gameService.isExpired(g, cat)) {
          gameService.updateGameStatus(g.id, 'closed').catch(() => { });
          return { ...g, status: 'closed' };
        }
        return g;
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [games, categories]);

  useEffect(() => {
    if (selectedResultGameId) {
      loadSubmissions(selectedResultGameId);
    }
  }, [selectedResultGameId]);

  const loadSubmissions = async (gameId) => {
    setLoadingSubmissions(true);
    try {
      const results = await gameService.getResultsForGame(gameId);
      setSubmissions(results);
    } catch (err) {
      setToast({ message: 'Error loading submissions: ' + err.message, type: 'error' });
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const toggleSidebarCollapse = () => {
    setIsCollapsed(prev => {
      const nextState = !prev;
      try {
        localStorage.setItem('mdc_sidebar_collapsed', JSON.stringify(nextState));
      } catch (e) { }
      return nextState;
    });
  };

  // 1. Category Actions
  const handleToggleCategoryActive = async (catId, currentActive) => {
    const updated = !currentActive;
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, active: updated } : c));
    await gameService.updateCategory(catId, { active: updated });
    setToast({ message: `Category ${updated ? 'activated' : 'deactivated'}.`, type: 'success' });
  };

  const handleCategoryFieldChange = async (catId, field, value) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, [field]: value } : c));
    await gameService.updateCategory(catId, { [field]: value });
  };

  // Drag and Drop Reordering for Categories
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('dragIndex', String(index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('dragIndex'), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const reordered = [...categories];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    setCategories(reordered);
    await gameService.reorderCategories(reordered);
    setToast({ message: 'Category order updated and persisted.', type: 'success' });
  };

  const handleMoveCategory = async (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= categories.length) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setCategories(reordered);
    await gameService.reorderCategories(reordered);
    setToast({ message: 'Category position updated.', type: 'success' });
  };

  const handleDeleteCategoryPrompt = (category) => {
    setConfirmDialog({
      isOpen: true,
      title: 'DELETE SERIES CATEGORY',
      message: `Are you sure you want to permanently delete "${category.name}" and all associated mission games? This action cannot be undone.`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false });
        try {
          await gameService.deleteCategory(category.id);
          setCategories(prev => prev.filter(c => c.id !== category.id));
          setGames(prev => prev.filter(g => g.categoryId !== category.id));
          setToast({ message: `Category "${category.name}" deleted.`, type: 'success' });
        } catch (err) {
          setToast({ message: 'Error deleting category: ' + err.message, type: 'error' });
        }
      }
    });
  };

  const handleSaveNewCategory = async (e) => {
    e.preventDefault();
    try {
      const created = await gameService.addCategory(newCategoryForm);
      setCategories(prev => [...prev, created]);
      setShowAddCategoryModal(false);
      setNewCategoryForm({
        name: '',
        description: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        active: true
      });
      setToast({ message: 'New series category created.', type: 'success' });
    } catch (err) {
      setToast({ message: 'Error creating category: ' + err.message, type: 'error' });
    }
  };

  // 2. Instance Actions
  const handleOpenAddGameModal = () => {
    const defaultCatId = (selectedCategoryFilter !== 'all' && selectedCategoryFilter)
      ? selectedCategoryFilter
      : (categories[0]?.id || 'cat-sudoku-core');

    setNewGameForm({
      categoryId: defaultCatId,
      title: '',
      questionGrid: '530070000\n600195000\n098000060\n800060003\n400803001\n700020006\n060000280\n000419005\n000080079',
      answerGrid: '534678912\n672195348\n198342567\n859761423\n426853791\n713924856\n961537284\n287419635\n345286179',
      startTime: new Date().toISOString().substring(0, 16),
      endTime: new Date(Date.now() + 30 * 86400000).toISOString().substring(0, 16),
      status: 'live'
    });
    setGridError('');
    setShowAddGameModal(true);
  };

  const handleGameFieldChange = async (gameId, field, value) => {
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, [field]: value } : g));
    await gameService.updateGame(gameId, { [field]: value });
  };

  const handleGameStatusToggle = async (gameId, currentStatus) => {
    let nextStatus = 'live';
    const norm = (currentStatus || '').toLowerCase();
    if (norm === 'upcoming') nextStatus = 'live';
    else if (norm === 'live') nextStatus = 'closed';
    else if (norm === 'closed') nextStatus = 'upcoming';

    setGames(prev => prev.map(g => g.id === gameId ? { ...g, status: nextStatus } : g));
    await gameService.updateGameStatus(gameId, nextStatus);
    setToast({ message: `Game status changed to ${nextStatus.toUpperCase()}.`, type: 'info' });
  };

  const handleDeleteGamePrompt = (game) => {
    setConfirmDialog({
      isOpen: true,
      title: 'DELETE MISSION PUZZLE',
      message: `Are you sure you want to permanently delete "${game.title}"? Player submissions for this puzzle will no longer be accessible.`,
      danger: true,
      onConfirm: async () => {
        setConfirmDialog({ isOpen: false });
        try {
          await gameService.deleteGame(game.id);
          setGames(prev => prev.filter(g => g.id !== game.id));
          setToast({ message: `Puzzle "${game.title}" deleted.`, type: 'success' });
        } catch (err) {
          setToast({ message: 'Error deleting puzzle: ' + err.message, type: 'error' });
        }
      }
    });
  };

  const validateGridInput = (text, requireNoBlanks = false) => {
    const lines = text.trim().split('\n').map(l => l.trim());
    if (lines.length !== 9) {
      return 'Grid must contain exactly 9 rows.';
    }
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length !== 9) {
        return `Row ${i + 1} must contain exactly 9 characters (currently ${lines[i].length}).`;
      }
      if (requireNoBlanks && (lines[i].includes('0') || lines[i].includes('.'))) {
        return `Answer grid Row ${i + 1} contains blanks (0 or .). Completed solution must have digits 1-9 only.`;
      }
    }
    return '';
  };

  const handleSaveNewGame = async (e) => {
    e.preventDefault();
    setGridError('');

    const qErr = validateGridInput(newGameForm.questionGrid, false);
    if (qErr) {
      setGridError(`Question Grid Error: ${qErr}`);
      return;
    }

    const aErr = validateGridInput(newGameForm.answerGrid, true);
    if (aErr) {
      setGridError(`Answer Grid Error: ${aErr}`);
      return;
    }

    const qLines = newGameForm.questionGrid.trim().split('\n').map(l => l.trim());
    const aLines = newGameForm.answerGrid.trim().split('\n').map(l => l.trim());

    try {
      const targetCatId = (newGameForm.categoryId || (categories[0]?.id || 'cat-sudoku-core')).trim();
      const created = await gameService.addGame({
        categoryId: targetCatId,
        title: newGameForm.title || 'Untitled Puzzle',
        question: qLines,
        answer: aLines,
        startTime: newGameForm.startTime,
        endTime: newGameForm.endTime,
        status: newGameForm.status || 'live'
      });

      setGames(prev => [created, ...prev]);
      setShowAddGameModal(false);
      if (!selectedResultGameId) {
        setSelectedResultGameId(created.id);
      }
      setToast({ message: 'New mission puzzle saved and set to LIVE.', type: 'success' });
    } catch (err) {
      setGridError('Error saving game: ' + err.message);
    }
  };

  const filteredGames = selectedCategoryFilter === 'all'
    ? games
    : games.filter(g => String(g.categoryId).trim() === String(selectedCategoryFilter).trim());

  const getCellChar = (gridSource, r, c) => {
    if (!gridSource) return '0';
    if (Array.isArray(gridSource)) {
      const row = gridSource[r] || '000000000';
      return row[c] || '0';
    }
    if (typeof gridSource === 'string') {
      const idx = r * 9 + c;
      return gridSource[idx] || '0';
    }
    return '0';
  };

  const navItems = [
    { id: 'games', label: 'GAMES MANAGEMENT', icon: '🎯' },
    { id: 'broadcast', label: 'BROADCAST CENTER', icon: '📢' },
    { id: 'results', label: 'PLAYER RESULTS', icon: '📈' },
    { id: 'leaderboard', label: 'LEADERBOARD', icon: '🏆' }
  ];

  return (
    <div className="dashboard-layout full-screen-stretch host-dashboard-layout">
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
            <div className="brand-title-row">
              <h1 className="brand-title">
                COGNITIONIS <span className="accent-text">NEXUS</span>
              </h1>
              <span className="host-admin-badge">HOST / ADMIN</span>
            </div>
            <p className="brand-subtitle">EVENT CONTROLLER WORKSPACE</p>
          </div>
        </div>

        <div className="header-right">
          {/* Profile Avatar & Dropdown */}
          <div className="profile-wrapper">
            <button
              type="button"
              className="user-avatar-btn host-avatar"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            >
              H1
            </button>

            {profileDropdownOpen && (
              <div className="profile-dropdown-menu">
                <div className="profile-info-header">
                  <div className="profile-name">Event Administrator</div>
                  <div className="profile-id">HOST ID: {hostUser?.playerId || 'HOST-IEEE-2026'}</div>
                  <div className="profile-email">admin@ieee.org</div>
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
            {!isCollapsed && <span className="sidebar-section-label">HOST CONTROLLER</span>}
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
          {/* GAMES MANAGEMENT TAB */}
          {activeTab === 'games' && (
            <div className="tab-pane">
              {/* 1. CATEGORY LEVEL MANAGEMENT */}
              <div style={{ marginBottom: '2.5rem' }}>
                <div className="host-actions-bar">
                  <div>
                    <h2 className="section-title">GAMES </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>

                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-add-game"
                    onClick={() => setShowAddCategoryModal(true)}
                  >
                    + ADD CATEGORY
                  </button>
                </div>

                <div className="games-cards-grid">
                  {categories.map((cat, index) => (
                    <div
                      key={cat.id}
                      className="bracket-card game-card host-game-card"
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      style={{ cursor: 'grab' }}
                    >
                      <div className="card-top-badges">
                        <span className={`pill-badge ${cat.active ? 'badge-status-live' : 'badge-status-closed'}`}>
                          {cat.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>

                        {/* Order Handle & Position Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-cyber)', marginRight: '4px' }}>
                            #{index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(index, index - 1)}
                            disabled={index === 0}
                            style={{
                              background: 'rgba(168, 85, 247, 0.2)',
                              border: 'none',
                              color: 'white',
                              borderRadius: '3px',
                              padding: '2px 6px',
                              cursor: index === 0 ? 'default' : 'pointer',
                              opacity: index === 0 ? 0.3 : 1
                            }}
                            title="Move Category Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveCategory(index, index + 1)}
                            disabled={index === categories.length - 1}
                            style={{
                              background: 'rgba(168, 85, 247, 0.2)',
                              border: 'none',
                              color: 'white',
                              borderRadius: '3px',
                              padding: '2px 6px',
                              cursor: index === categories.length - 1 ? 'default' : 'pointer',
                              opacity: index === categories.length - 1 ? 0.3 : 1
                            }}
                            title="Move Category Down"
                          >
                            ▼
                          </button>
                        </div>
                      </div>

                      {/* Inline Editable Category Name */}
                      <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)', display: 'block', marginBottom: '4px' }}>
                          CATEGORY NAME:
                        </label>
                        <input
                          type="text"
                          className="cyber-input"
                          style={{ padding: '8px 10px', fontSize: '1rem', fontWeight: 'bold', width: '100%' }}
                          value={cat.name || ''}
                          onChange={(e) => handleCategoryFieldChange(cat.id, 'name', e.target.value)}
                          placeholder="Category Name"
                        />
                      </div>

                      {/* Inline Editable Category Description */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)', display: 'block', marginBottom: '4px' }}>
                          DESCRIPTION:
                        </label>
                        <textarea
                          className="cyber-textarea"
                          style={{ padding: '8px 10px', fontSize: '0.88rem', width: '100%', resize: 'vertical' }}
                          rows="2"
                          value={cat.description || ''}
                          onChange={(e) => handleCategoryFieldChange(cat.id, 'description', e.target.value)}
                          placeholder="Category Description"
                        />
                      </div>

                      {/* Inline Editable Dates */}
                      <div style={{
                        marginTop: '0.5rem',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(168, 85, 247, 0.2)'
                      }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-cyber)' }}>
                          SERIES DATE WINDOW (INLINE EDITABLE):
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            type="date"
                            className="cyber-input"
                            style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                            value={cat.startDate || ''}
                            onChange={(e) => handleCategoryFieldChange(cat.id, 'startDate', e.target.value)}
                            title="Category Start Date"
                          />
                          <span style={{ color: 'var(--text-muted)' }}>–</span>
                          <input
                            type="date"
                            className="cyber-input"
                            style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                            value={cat.endDate || ''}
                            onChange={(e) => handleCategoryFieldChange(cat.id, 'endDate', e.target.value)}
                            title="Category End Date"
                          />
                        </div>
                      </div>

                      {/* Action Row: Toggle Active & Delete */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                        <button
                          type="button"
                          className={`btn-status-toggle ${cat.active ? 'status-btn-live' : 'status-btn-closed'}`}
                          onClick={() => handleToggleCategoryActive(cat.id, cat.active)}
                          style={{ flex: 1 }}
                        >
                          {cat.active ? 'ACTIVE' : 'INACTIVE'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCategoryPrompt(cat)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            borderRadius: '4px',
                            color: '#f87171',
                            padding: '6px 12px',
                            fontFamily: 'var(--font-cyber)',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                          title="Delete Category"
                        >
                          🗑️ DELETE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. INSTANCE LEVEL MANAGEMENT */}
              <div>
                <div className="host-actions-bar">
                  <div>
                    <h2 className="section-title">MISSIONS</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>

                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <select
                      className="cyber-select"
                      style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    >
                      <option value="all">All Series Categories</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="btn-add-game"
                      onClick={handleOpenAddGameModal}
                    >
                      + ADD NEW GAME
                    </button>
                  </div>
                </div>

                <div className="games-cards-grid">
                  {filteredGames.map((game) => (
                    <div key={game.id} className="bracket-card game-card host-game-card">
                      <div className="card-top-badges">
                        <span className={`pill-badge badge-status-${(game.status || 'live').toLowerCase()}`}>
                          {(game.status || 'live').toUpperCase()}
                        </span>
                        <span className="pill-badge badge-type">Sudoku</span>
                      </div>

                      {/* Inline Editable Mission Title */}
                      <div style={{ marginTop: '0.75rem', marginBottom: '0.75rem' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)', display: 'block', marginBottom: '4px' }}>
                          MISSION TITLE:
                        </label>
                        <input
                          type="text"
                          className="cyber-input"
                          style={{ padding: '8px 10px', fontSize: '1rem', fontWeight: 'bold', width: '100%' }}
                          value={game.title || ''}
                          onChange={(e) => handleGameFieldChange(game.id, 'title', e.target.value)}
                          placeholder="Mission Title"
                        />
                      </div>

                      {/* Inline Editable Category Assignment */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)', display: 'block', marginBottom: '4px' }}>
                          ASSIGNED CATEGORY:
                        </label>
                        <select
                          className="cyber-select"
                          style={{ padding: '6px 10px', fontSize: '0.85rem', width: '100%' }}
                          value={game.categoryId || ''}
                          onChange={(e) => handleGameFieldChange(game.id, 'categoryId', e.target.value)}
                        >
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Inline Editable Time Window for Instance */}
                      <div style={{
                        marginTop: '0.5rem',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(168, 85, 247, 0.2)'
                      }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-cyber)' }}>
                          INSTANCE PLAYABLE WINDOW (INLINE EDITABLE):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '45px' }}>START:</span>
                            <input
                              type="datetime-local"
                              className="cyber-input"
                              style={{ padding: '4px 8px', fontSize: '0.85rem', flex: 1 }}
                              value={game.startTime || ''}
                              onChange={(e) => handleGameFieldChange(game.id, 'startTime', e.target.value)}
                              title="Instance Start Time"
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '45px' }}>END:</span>
                            <input
                              type="datetime-local"
                              className="cyber-input"
                              style={{ padding: '4px 8px', fontSize: '0.85rem', flex: 1 }}
                              value={game.endTime || ''}
                              onChange={(e) => handleGameFieldChange(game.id, 'endTime', e.target.value)}
                              title="Instance End Time"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Row: Toggle Status & Delete */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
                        <button
                          type="button"
                          className={`btn-status-toggle status-btn-${(game.status || 'live').toLowerCase()}`}
                          onClick={() => handleGameStatusToggle(game.id, game.status)}
                          style={{ flex: 1 }}
                        >
                          {(game.status || 'live').toUpperCase()} (TOGGLE)
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteGamePrompt(game)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            borderRadius: '4px',
                            color: '#f87171',
                            padding: '6px 12px',
                            fontFamily: 'var(--font-cyber)',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                          title="Delete Puzzle Instance"
                        >
                          🗑️ DELETE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BROADCAST CENTER TAB */}
          {activeTab === 'broadcast' && (
            <div className="tab-pane">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                {/* 1. DISPATCH FORM */}
                <div className="bracket-card" style={{ padding: '1.5rem' }}>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                      <span>📡</span> DISPATCH LIVE BROADCAST
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '6px 0 0 0' }}>
                      Send real-time alerts and announcements directly to all player notification bells.
                    </p>
                  </div>

                  <form onSubmit={handleSendBroadcast}>
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Broadcast Title</label>
                      <input
                        type="text"
                        className="cyber-input"
                        placeholder="e.g. Mission 2 Decryption Protocol Now Live!"
                        value={broadcastForm.title}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Priority / Alert Type</label>
                      <select
                        className="cyber-select"
                        value={broadcastForm.type}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, type: e.target.value })}
                      >
                        <option value="announcement">📢 Announcement (Standard Notice)</option>
                        <option value="urgent">🚨 Urgent Alert (High Priority)</option>
                        <option value="warning">⚠️ Warning / Countdown</option>
                        <option value="info">ℹ️ Information / Hint</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                      <label className="form-label">Message Content</label>
                      <textarea
                        className="cyber-textarea"
                        rows="4"
                        placeholder="Type notification message visible to all online players..."
                        value={broadcastForm.message}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn-cyber"
                      style={{ width: '100%', padding: '12px', fontSize: '0.9rem' }}
                      disabled={sendingBroadcast}
                    >
                      {sendingBroadcast ? 'TRANSMITTING BROADCAST...' : '📡 DISPATCH BROADCAST TO PLAYERS'}
                    </button>
                  </form>
                </div>

                {/* 2. BROADCAST HISTORY */}
                <div className="bracket-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <div>
                      <h2 className="section-title" style={{ margin: 0 }}>
                        BROADCAST HISTORY ({broadcasts.length})
                      </h2>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                        Active notifications delivered to players.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="auth-link"
                      onClick={loadBroadcasts}
                      style={{ fontSize: '0.85rem' }}
                    >
                      ↻ Refresh
                    </button>
                  </div>

                  {loadingBroadcasts ? (
                    <div style={{ textAlign: 'center', padding: '3rem 0', margin: 'auto' }}>
                      <div className="cyber-loader" style={{ margin: '0 auto 1rem' }}></div>
                      <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-cyber)' }}>
                        LOADING BROADCAST FEED...
                      </span>
                    </div>
                  ) : broadcasts.length === 0 ? (
                    <div className="empty-state-card" style={{ border: 'none', background: 'transparent', margin: 'auto' }}>
                      <p className="empty-state-title">NO BROADCASTS SENT YET</p>
                      <p className="empty-state-desc">Use the dispatch panel to send your first event notification.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '500px', paddingRight: '4px' }}>
                      {broadcasts.map((b) => (
                        <div
                          key={b.id}
                          style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid rgba(168, 85, 247, 0.2)',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            position: 'relative'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{b.title}</strong>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteBroadcast(b)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#f87171',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                padding: '2px 6px'
                              }}
                              title="Delete notification"
                            >
                              🗑️
                            </button>
                          </div>

                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', margin: '4px 0 8px', lineHeight: 1.4 }}>
                            {b.message}
                          </p>

                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>
                            🕒 {b.createdAtString || 'Recently'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PLAYER RESULTS TAB */}
          {activeTab === 'results' && (
            <div className="tab-pane">
              <div className="filter-controls-bar">
                <div className="filter-label">SELECT MISSION INSTANCE:</div>
                <select
                  className="cyber-select"
                  value={selectedResultGameId}
                  onChange={(e) => setSelectedResultGameId(e.target.value)}
                >
                  {games.map(g => {
                    const cat = categories.find(c => c.id === g.categoryId);
                    return (
                      <option key={g.id} value={g.id}>
                        {g.title} {cat ? `(${cat.name})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {loadingSubmissions ? (
                <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                  <div className="cyber-loader" style={{ margin: '0 auto 1rem' }}></div>
                  <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-cyber)' }}>
                    RETRIEVING SUBMISSIONS...
                  </span>
                </div>
              ) : submissions.length === 0 ? (
                <div className="empty-state-card bracket-card">
                  <p className="empty-state-title">NO SUBMISSIONS YET FOR THIS GAME.</p>
                  <p className="empty-state-desc">Submissions will appear here once players complete this game instance.</p>
                </div>
              ) : (
                <div className="desktop-table-container bracket-card">
                  <table className="cyber-table">
                    <thead>
                      <tr>
                        <th>PLAYER ID</th>
                        <th>COMPLETED</th>
                        <th>CORRECT / TOTAL</th>
                        <th>SCORE</th>
                        <th>TIME TAKEN</th>
                        <th>SUBMITTED AT</th>
                        <th style={{ textAlign: 'center' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((sub) => {
                        const matchedGame = games.find(g => g.id === selectedResultGameId);
                        return (
                          <tr 
                            key={sub.id}
                            className="row-interactive"
                            onClick={() => setViewingSubmission({ sub, game: matchedGame })}
                            title="Click to view full 9x9 answer grid"
                          >
                            <td className="player-id-text">{sub.playerId}</td>
                            <td>
                              {sub.solved ? (
                                <span className="status-icon-solved">✓ COMPLETED</span>
                              ) : (
                                <span className="status-icon-failed">✗ UNFINISHED</span>
                              )}
                            </td>
                            <td>{sub.correctCells}</td>
                            <td className="score-col">{sub.score} PTS</td>
                            <td>{sub.timeTaken}</td>
                            <td className="date-col">{sub.submittedAt}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn-grid-preview"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingSubmission({ sub, game: matchedGame });
                                }}
                                title="Inspect player's submitted Sudoku grid"
                              >
                                🔍 VIEW GRID
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* LEADERBOARD TAB */}
          {activeTab === 'leaderboard' && (
            <div className="tab-pane">
              <LeaderboardView role="host" />
            </div>
          )}
        </main>
      </div>

      {/* MODAL: ADD CATEGORY */}
      {showAddCategoryModal && (
        <div className="modal-overlay" onClick={() => setShowAddCategoryModal(false)}>
          <div className="modal-card bracket-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">+ ADD SERIES CATEGORY</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAddCategoryModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewCategory} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="catName">Category Name</label>
                <input
                  id="catName"
                  type="text"
                  className="cyber-input"
                  placeholder="e.g. Quantum Sudoku Decryption"
                  value={newCategoryForm.name}
                  onChange={(e) => setNewCategoryForm({ ...newCategoryForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="catDesc">Description</label>
                <textarea
                  id="catDesc"
                  className="cyber-textarea"
                  rows="3"
                  placeholder="Cyber deduction puzzles testing algorithmic thinking..."
                  value={newCategoryForm.description}
                  onChange={(e) => setNewCategoryForm({ ...newCategoryForm, description: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="catStart">Start Date</label>
                  <input
                    id="catStart"
                    type="date"
                    className="cyber-input"
                    value={newCategoryForm.startDate}
                    onChange={(e) => setNewCategoryForm({ ...newCategoryForm, startDate: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="catEnd">End Date</label>
                  <input
                    id="catEnd"
                    type="date"
                    className="cyber-input"
                    value={newCategoryForm.endDate}
                    onChange={(e) => setNewCategoryForm({ ...newCategoryForm, endDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="catActive">Initial State</label>
                <select
                  id="catActive"
                  className="cyber-select"
                  value={newCategoryForm.active ? 'true' : 'false'}
                  onChange={(e) => setNewCategoryForm({ ...newCategoryForm, active: e.target.value === 'true' })}
                >
                  <option value="true">Active (Visible & Playable)</option>
                  <option value="false">Inactive (Coming Soon / Locked)</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowAddCategoryModal(false)}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="btn-cyber"
                >
                  CREATE CATEGORY
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW GAME (WITH 9x9 VALIDATION, NO DIFFICULTY) */}
      {showAddGameModal && (
        <div className="modal-overlay" onClick={() => setShowAddGameModal(false)}>
          <div className="modal-card bracket-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">+ ADD NEW MISSION GAME</h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowAddGameModal(false)}
              >
                ✕
              </button>
            </div>

            {gridError && (
              <div className="status-msg status-msg-error">
                <span className="status-icon">⚡</span>
                <div>{gridError}</div>
              </div>
            )}

            <form onSubmit={handleSaveNewGame} className="modal-form">
              <div className="form-group">
                <label className="form-label" htmlFor="categoryId">Series Category</label>
                <select
                  id="categoryId"
                  className="cyber-select"
                  value={newGameForm.categoryId}
                  onChange={(e) => setNewGameForm({ ...newGameForm, categoryId: e.target.value })}
                  required
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="title">Game Mission Title</label>
                <input
                  id="title"
                  type="text"
                  className="cyber-input"
                  placeholder="e.g. Sudoku — Week 1 Decryption"
                  value={newGameForm.title}
                  onChange={(e) => setNewGameForm({ ...newGameForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="questionGrid">Question Grid (Exactly 9 rows × 9 digits, 0 for blank)</label>
                <textarea
                  id="questionGrid"
                  className="cyber-textarea"
                  rows="5"
                  value={newGameForm.questionGrid}
                  onChange={(e) => setNewGameForm({ ...newGameForm, questionGrid: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="answerGrid">Answer Grid (Exactly 9 rows × 9 completed digits, no blanks)</label>
                <textarea
                  id="answerGrid"
                  className="cyber-textarea"
                  rows="5"
                  value={newGameForm.answerGrid}
                  onChange={(e) => setNewGameForm({ ...newGameForm, answerGrid: e.target.value })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="startTime">Start Time</label>
                  <input
                    id="startTime"
                    type="datetime-local"
                    className="cyber-input"
                    value={newGameForm.startTime}
                    onChange={(e) => setNewGameForm({ ...newGameForm, startTime: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="endTime">End Time</label>
                  <input
                    id="endTime"
                    type="datetime-local"
                    className="cyber-input"
                    value={newGameForm.endTime}
                    onChange={(e) => setNewGameForm({ ...newGameForm, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="status">Initial Status</label>
                <select
                  id="status"
                  className="cyber-select"
                  value={newGameForm.status}
                  onChange={(e) => setNewGameForm({ ...newGameForm, status: e.target.value })}
                >
                  <option value="live">Live</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowAddGameModal(false)}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="btn-cyber"
                >
                  SAVE GAME MISSION
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PLAYER ANSWER GRID INSPECTOR */}
      {viewingSubmission && (
        <div className="modal-overlay" onClick={() => setViewingSubmission(null)}>
          <div 
            className="modal-card bracket-card" 
            onClick={(e) => e.stopPropagation()} 
            style={{ maxWidth: '640px', width: '95%', maxHeight: '92vh', overflowY: 'auto' }}
          >
            <div className="modal-header" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(168, 85, 247, 0.3)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 className="modal-title" style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>
                  🔍 PLAYER SUBMISSION GRID
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {viewingSubmission.game?.title || 'Sudoku Mission'}
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setViewingSubmission(null)}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Submission Metrics Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: '10px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '1rem'
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>PLAYER ID</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                  {viewingSubmission.sub.playerId}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>SCORE</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>
                  {viewingSubmission.sub.score} PTS
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>ACCURACY</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>
                  {viewingSubmission.sub.correctCells}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>TIME TAKEN</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>
                  {viewingSubmission.sub.timeTaken}
                </div>
              </div>
            </div>

            {/* Color Legend */}
            <div className="grid-preview-legend">
              <div className="legend-item">
                <span className="legend-color-box" style={{ background: 'rgba(30, 27, 75, 0.9)', border: '1px solid rgba(168, 85, 247, 0.6)' }}></span>
                <span style={{ color: 'white' }}>Fixed Clue</span>
              </div>
              <div className="legend-item">
                <span className="legend-color-box" style={{ background: 'rgba(16, 185, 129, 0.25)', border: '1px solid #10b981' }}></span>
                <span style={{ color: '#10b981' }}>Correct</span>
              </div>
              <div className="legend-item">
                <span className="legend-color-box" style={{ background: 'rgba(239, 68, 68, 0.25)', border: '1px solid #ef4444' }}></span>
                <span style={{ color: '#ef4444' }}>Incorrect</span>
              </div>
              <div className="legend-item">
                <span className="legend-color-box" style={{ background: 'rgba(15, 12, 35, 0.85)', border: '1px solid rgba(168, 85, 247, 0.2)' }}></span>
                <span style={{ color: 'var(--text-muted)' }}>Blank</span>
              </div>
            </div>

            {/* 9x9 Sudoku Board View */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                background: 'rgba(10, 10, 20, 0.95)',
                padding: '10px',
                borderRadius: '10px',
                border: '2px solid rgba(168, 85, 247, 0.4)',
                boxShadow: '0 0 20px rgba(0, 0, 0, 0.6)'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(9, 38px)',
                  gridTemplateRows: 'repeat(9, 38px)',
                  gap: '1px',
                  background: 'rgba(168, 85, 247, 0.25)',
                  border: '2px solid rgba(168, 85, 247, 0.6)'
                }}>
                  {Array.from({ length: 9 }).map((_, r) =>
                    Array.from({ length: 9 }).map((_, c) => {
                      const qVal = getCellChar(viewingSubmission.game?.question, r, c);
                      const aVal = getCellChar(viewingSubmission.game?.answer, r, c);
                      const pVal = getCellChar(viewingSubmission.sub?.currentGrid, r, c);

                      const isGiven = (qVal !== '0' && qVal !== '.');
                      const isFilled = (pVal !== '0' && pVal !== '.');
                      const isCorrect = isFilled && (pVal === aVal);

                      const borderRight = (c === 2 || c === 5) ? '2px solid rgba(168, 85, 247, 0.85)' : undefined;
                      const borderBottom = (r === 2 || r === 5) ? '2px solid rgba(168, 85, 247, 0.85)' : undefined;

                      let cellVal = '';
                      let cellColor = 'var(--text-muted)';
                      let cellBg = 'rgba(15, 12, 35, 0.85)';
                      let fontWeight = '500';

                      if (isGiven) {
                        cellVal = qVal;
                        cellColor = '#ffffff';
                        cellBg = 'rgba(30, 27, 75, 0.85)';
                        fontWeight = 'bold';
                      } else if (isFilled) {
                        cellVal = pVal;
                        fontWeight = '700';
                        if (isCorrect) {
                          cellColor = '#10b981';
                          cellBg = 'rgba(16, 185, 129, 0.2)';
                        } else {
                          cellColor = '#ef4444';
                          cellBg = 'rgba(239, 68, 68, 0.2)';
                        }
                      }

                      return (
                        <div
                          key={`${r}-${c}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.15rem',
                            fontFamily: 'var(--font-cyber)',
                            fontWeight,
                            color: cellColor,
                            background: cellBg,
                            borderRight,
                            borderBottom,
                            userSelect: 'none'
                          }}
                          title={isGiven ? `Fixed Clue: ${qVal}` : isFilled ? `Player: ${pVal} | Answer: ${aVal}` : `Blank | Answer: ${aVal}`}
                        >
                          {cellVal}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-cyber"
                onClick={() => setViewingSubmission(null)}
                style={{ minWidth: '180px' }}
              >
                CLOSE INSPECTOR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Dialog (No window.confirm) */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false })}
      />

      {/* In-App Floating Toast Notification (No alert) */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'info' })}
      />
    </div>
  );
}
