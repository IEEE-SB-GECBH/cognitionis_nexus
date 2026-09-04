import React, { useState, useEffect } from 'react';
import { gameService } from '../services/gameService';
import Toast from './Toast';

export default function LeaderboardView({ role = 'player' }) {
  const [viewMode, setViewMode] = useState('overall'); // 'overall' | 'per-game'
  const [selectedGameId, setSelectedGameId] = useState('');
  const [games, setGames] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    async function fetchGames() {
      try {
        const loadedGames = await gameService.getAllGames();
        setGames(loadedGames);
        if (loadedGames.length > 0) {
          setSelectedGameId(loadedGames[0].id);
        }
      } catch (err) {
        console.warn('Error loading games for leaderboard:', err);
      }
    }
    fetchGames();
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        if (viewMode === 'overall') {
          const data = await gameService.getOverallLeaderboard();
          setLeaderboardData(data);
        } else if (selectedGameId) {
          const data = await gameService.getResultsForGame(selectedGameId);
          // Format per-game data for display
          const formatted = data.map(r => ({
            rank: r.rank,
            playerId: r.playerId,
            name: r.playerId,
            totalScore: r.score,
            gamesCompleted: r.solved ? 'Solved' : 'Incomplete',
            timeTaken: r.timeTaken,
            correctCells: r.correctCells
          }));
          setLeaderboardData(formatted);
        }
      } catch (err) {
        console.warn('Error loading leaderboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [viewMode, selectedGameId]);

  const handleExportCSV = () => {
    setToastMessage('Export to CSV coming soon. Records compiled.');
  };

  const getRankBadgeClass = (rank) => {
    if (rank === 1) return 'rank-gold';
    if (rank === 2) return 'rank-silver';
    if (rank === 3) return 'rank-bronze';
    return '';
  };

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header-bar">
        <div className="leaderboard-controls-group">
          {/* Overall vs Per-Game Toggle */}
          <div className="mode-toggle-pill">
            <button
              type="button"
              className={`mode-toggle-btn ${viewMode === 'overall' ? 'active' : ''}`}
              onClick={() => setViewMode('overall')}
            >
              OVERALL RANKINGS
            </button>
            <button
              type="button"
              className={`mode-toggle-btn ${viewMode === 'per-game' ? 'active' : ''}`}
              onClick={() => setViewMode('per-game')}
            >
              PER-GAME RANKINGS
            </button>
          </div>

          {/* Game selector if per-game mode */}
          {viewMode === 'per-game' && (
            <div className="game-select-wrapper">
              <select
                className="game-dropdown-select"
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
              >
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Host CSV Export Button Stub with In-App Toast (No alert) */}
        {role === 'host' && (
          <button
            type="button"
            className="btn-export-csv"
            onClick={handleExportCSV}
          >
            📥 EXPORT TO CSV
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div className="cyber-loader" style={{ margin: '0 auto 1rem' }}></div>
          <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-cyber)' }}>
            COMPILING CENTRAL LEADERBOARD...
          </span>
        </div>
      ) : leaderboardData.length === 0 ? (
        <div className="empty-state-card">
          <p className="empty-state-title">NO LEADERBOARD RECORDS YET</p>
          <p className="empty-state-desc">Rankings will update as players complete live missions.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="desktop-table-container">
            <table className="cyber-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>PLAYER ID</th>
                  <th>TOTAL SCORE</th>
                  <th>{viewMode === 'overall' ? 'GAMES COMPLETED' : 'STATUS'}</th>
                  {viewMode === 'per-game' && <th>TIME TAKEN</th>}
                </tr>
              </thead>
              <tbody>
                {leaderboardData.map((item) => {
                  const rankClass = getRankBadgeClass(item.rank);
                  return (
                    <tr key={`${item.playerId}-${item.rank}`} className={`table-row ${rankClass}`}>
                      <td>
                        <span className={`rank-badge ${rankClass}`}>
                          {item.rank === 1 ? '🥇 #1' : item.rank === 2 ? '🥈 #2' : item.rank === 3 ? '🥉 #3' : `#${item.rank}`}
                        </span>
                      </td>
                      <td className="player-col">
                        <div className="player-id-text">{item.playerId}</div>
                      </td>
                      <td className="score-col">{(item.totalScore || 0).toLocaleString()} PTS</td>
                      <td className="completed-col">{item.gamesCompleted}</td>
                      {viewMode === 'per-game' && <td>{item.timeTaken || 'N/A'}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View */}
          <div className="mobile-cards-container">
            {leaderboardData.map((item) => {
              const rankClass = getRankBadgeClass(item.rank);
              return (
                <div key={`${item.playerId}-${item.rank}`} className={`mobile-table-card ${rankClass}`}>
                  <div className="mobile-card-header">
                    <span className={`rank-badge ${rankClass}`}>
                      {item.rank === 1 ? '🥇 RANK #1' : item.rank === 2 ? '🥈 RANK #2' : item.rank === 3 ? '🥉 RANK #3' : `RANK #${item.rank}`}
                    </span>
                    <span className="mobile-card-score">{(item.totalScore || 0).toLocaleString()} PTS</span>
                  </div>
                  <div className="mobile-card-body">
                    <div className="mobile-field-row">
                      <span className="field-label">PLAYER ID:</span>
                      <span className="field-val highlight">{item.playerId}</span>
                    </div>
                    <div className="mobile-field-row">
                      <span className="field-label">
                        {viewMode === 'overall' ? 'GAMES COMPLETED:' : 'STATUS:'}
                      </span>
                      <span className="field-val">{item.gamesCompleted}</span>
                    </div>
                    {viewMode === 'per-game' && item.timeTaken && (
                      <div className="mobile-field-row">
                        <span className="field-label">TIME:</span>
                        <span className="field-val">{item.timeTaken}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* In-App Toast Feedback */}
      <Toast
        message={toastMessage}
        type="info"
        onClose={() => setToastMessage('')}
      />
    </div>
  );
}
