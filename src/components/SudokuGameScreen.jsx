import React, { useState, useEffect, useRef } from 'react';
import { gameService, isExpired } from '../services/gameService';
import ConfirmDialog from './ConfirmDialog';

export default function SudokuGameScreen({ player, gameId, onBackToMissions }) {
  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState(null);
  const [category, setCategory] = useState(null);
  const [expiredBlocked, setExpiredBlocked] = useState(false);
  const [attempt, setAttempt] = useState(null);
  const [grid, setGrid] = useState([]); // 9 rows of 9 characters
  const [selectedCell, setSelectedCell] = useState([0, 0]); // [row, col]
  const [elapsedSec, setElapsedSec] = useState(0);
  const [savingStatus, setSavingStatus] = useState('synced'); // 'synced' | 'saving'
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const saveTimerRef = useRef(null);
  const startTimeMillisRef = useRef(null);

  const playerId = player?.playerId || 'IEEE-001';

  // 1. Initial Load & Attempt Verification
  useEffect(() => {
    let mounted = true;

    async function initGame() {
      setLoading(true);
      setErrorMessage('');
      try {
        const gameData = await gameService.getGameById(gameId);
        if (!gameData) {
          if (mounted) {
            setErrorMessage('Mission puzzle data could not be located.');
            setLoading(false);
          }
          return;
        }

        // Fetch category to check overall series deadline
        let catData = null;
        if (gameData.categoryId) {
          const categories = await gameService.getCategories();
          catData = categories.find(c => c.id === gameData.categoryId) || null;
        }

        if (mounted) {
          setGame(gameData);
          setCategory(catData);
        }

        // Check isExpired before starting or resuming
        if (isExpired(gameData, catData)) {
          if (mounted) {
            setExpiredBlocked(true);
            setLoading(false);
          }
          return;
        }

        // Check if an attempt already exists
        const existingAttempt = await gameService.getAttempt(playerId, gameId);

        if (existingAttempt) {
          if (mounted) {
            setAttempt(existingAttempt);
            if (existingAttempt.status === 'submitted') {
              setSubmissionResult(existingAttempt);
              setLoading(false);
              return;
            }

            // Resume in_progress attempt
            let current = existingAttempt.currentGrid;
            if (!current || !Array.isArray(current) || current.length !== 9) {
              current = gameData.question || Array(9).fill('000000000');
            }
            setGrid(current);

            // Establish real elapsed time
            let start = Date.now();
            if (existingAttempt.attemptStartedAt?.toMillis) {
              start = existingAttempt.attemptStartedAt.toMillis();
            } else if (existingAttempt.attemptStartedAtMillis) {
              start = existingAttempt.attemptStartedAtMillis;
            }
            startTimeMillisRef.current = start;
            setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
            setLoading(false);
          }
        } else {
          // Start fresh attempt
          const initialGrid = Array.isArray(gameData.question)
            ? [...gameData.question]
            : Array(9).fill('000000000');

          const newAttempt = await gameService.startOrResumeAttempt(playerId, gameId, initialGrid);

          if (mounted) {
            setAttempt(newAttempt);
            setGrid(newAttempt.currentGrid || initialGrid);

            let start = Date.now();
            if (newAttempt.attemptStartedAt?.toMillis) {
              start = newAttempt.attemptStartedAt.toMillis();
            } else if (newAttempt.attemptStartedAtMillis) {
              start = newAttempt.attemptStartedAtMillis;
            }
            startTimeMillisRef.current = start;
            setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error initializing Sudoku session:', err);
        if (mounted) {
          setErrorMessage('Failed to initialize mission session.');
          setLoading(false);
        }
      }
    }

    initGame();

    return () => {
      mounted = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [gameId, playerId]);

  // 2. Continuous real-elapsed timer & live expiry check (never resets on refresh)
  useEffect(() => {
    if (loading || expiredBlocked || submissionResult) return;

    const timer = setInterval(() => {
      // Live expiry check: if the game or category expires during play, lock immediately
      if (game && isExpired(game, category)) {
        setExpiredBlocked(true);
        return;
      }

      if (startTimeMillisRef.current) {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((now - startTimeMillisRef.current) / 1000));
        setElapsedSec(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, expiredBlocked, submissionResult, game, category]);

  // 3. Auto-save debounced handler (~1s after typing stops)
  const triggerAutoSave = (newGrid) => {
    setSavingStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        await gameService.saveProgress(playerId, gameId, newGrid);
        setSavingStatus('synced');
      } catch (e) {
        console.warn('Auto-save warning:', e);
        setSavingStatus('synced');
      }
    }, 1000);
  };

  // Cell modification
  const handleCellInput = (row, col, value) => {
    if (isGivenCell(row, col) || submissionResult || expiredBlocked) return;

    const char = (value >= '1' && value <= '9') ? value : '0';
    const newGrid = [...grid];
    const currentRow = newGrid[row] || '000000000';
    const updatedRow = currentRow.substring(0, col) + char + currentRow.substring(col + 1);
    newGrid[row] = updatedRow;

    setGrid(newGrid);
    triggerAutoSave(newGrid);
  };

  const isGivenCell = (row, col) => {
    if (!game || !game.question || !game.question[row]) return false;
    const ch = game.question[row][col];
    return ch !== '0' && ch !== '.';
  };

  // Keyboard support for arrow keys and digits
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (loading || expiredBlocked || submissionResult || showSubmitConfirm) return;
      const [r, c] = selectedCell;

      if (e.key >= '1' && e.key <= '9') {
        handleCellInput(r, c, e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        handleCellInput(r, c, '0');
      } else if (e.key === 'ArrowUp' && r > 0) {
        setSelectedCell([r - 1, c]);
      } else if (e.key === 'ArrowDown' && r < 8) {
        setSelectedCell([r + 1, c]);
      } else if (e.key === 'ArrowLeft' && c > 0) {
        setSelectedCell([r, c - 1]);
      } else if (e.key === 'ArrowRight' && c < 8) {
        setSelectedCell([r, c + 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, grid, loading, expiredBlocked, submissionResult, showSubmitConfirm]);

  // Execute Submission with in-app confirmation
  const handleConfirmSubmit = async () => {
    setShowSubmitConfirm(false);
    setSubmitting(true);
    try {
      const res = await gameService.submitAttempt(playerId, gameId, grid, game?.answer);
      setSubmissionResult(res);
    } catch (err) {
      setErrorMessage(err.message || 'Error submitting puzzle attempt.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // RENDER: Loading State
  if (loading) {
    return (
      <div className="tab-pane" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="cyber-loader" style={{ margin: '0 auto 1.5rem', width: '40px', height: '40px' }}></div>
        <h2 style={{ fontFamily: 'var(--font-cyber)', color: 'var(--accent-cyan)' }}>INITIALIZING QUANTUM GRID...</h2>
        <p style={{ color: 'var(--text-muted)' }}>Retrieving cryptographic coordinates and verifying node session.</p>
      </div>
    );
  }

  // RENDER: Expired Blocked State (Inline message replacing board)
  if (expiredBlocked) {
    return (
      <div className="tab-pane">
        <div className="bracket-card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <h2 style={{ fontFamily: 'var(--font-cyber)', color: '#ef4444', marginBottom: '1rem' }}>
            THIS PUZZLE HAS CLOSED.
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
            The designated mission window for <strong>{game?.title || 'this puzzle'}</strong> has expired. Submissions and grid access are permanently closed.
          </p>
          <button
            type="button"
            className="btn-back-nav btn-back-nav-prominent"
            onClick={onBackToMissions}
            style={{ margin: '0 auto' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>RETURN TO MISSIONS</span>
          </button>
        </div>
      </div>
    );
  }

  // RENDER: Locked Result View (If already submitted or just submitted)
  if (submissionResult) {
    return (
      <div className="tab-pane">
        <div className="bracket-card" style={{ maxWidth: '650px', margin: '2rem auto', textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏆</div>
          <span className="pill-badge badge-solved" style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
            MISSION PERMANENTLY COMPLETED & LOCKED
          </span>
          <h2 style={{ fontFamily: 'var(--font-cyber)', color: 'var(--accent-light)', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
            {game?.title}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Your cryptographic signature and decryption metrics have been recorded in the central database.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>SCORE</div>
              <div style={{ fontSize: '1.75rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{submissionResult.score || 0}</div>
            </div>

            <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>ACCURACY</div>
              <div style={{ fontSize: '1.75rem', color: '#10b981', fontWeight: 'bold' }}>
                {submissionResult.correctCells || 0} / 81
              </div>
            </div>

            <div style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>TIME TAKEN</div>
              <div style={{ fontSize: '1.75rem', color: 'white', fontWeight: 'bold' }}>
                {formatTimer(submissionResult.timeTakenSec || 0)}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-back-nav btn-back-nav-prominent"
            onClick={onBackToMissions}
            style={{ width: '100%', maxWidth: '320px', margin: '0 auto', justifyContent: 'center' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>BACK TO MISSIONS</span>
          </button>
        </div>
      </div>
    );
  }

  // RENDER: Active Sudoku Gameplay Board
  return (
    <div className="tab-pane" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Inline Error Banner if any */}
      {errorMessage && (
        <div className="status-msg status-msg-error" style={{ marginBottom: '1.5rem' }}>
          <span className="status-icon">⚡</span>
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Top Header Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(168, 85, 247, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            className="btn-back-nav"
            onClick={onBackToMissions}
            title="Back to Missions"
            aria-label="Back to Missions"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>BACK</span>
          </button>
          <h2 style={{ fontFamily: 'var(--font-cyber)', color: 'white', margin: 0, fontSize: '1.4rem' }}>
            {game?.title}
          </h2>
        </div>

        {/* Real Timer & Auto-Save Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0,0,0,0.4)',
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px solid rgba(168, 85, 247, 0.3)'
          }}>
            <span style={{ fontSize: '1rem' }}>⏱️</span>
            <span style={{ fontFamily: 'var(--font-cyber)', fontSize: '1.25rem', color: 'var(--accent-cyan)', fontWeight: 'bold', letterSpacing: '1px' }}>
              {formatTimer(elapsedSec)}
            </span>
          </div>

          <div style={{
            fontSize: '0.82rem',
            fontFamily: 'var(--font-cyber)',
            color: savingStatus === 'saving' ? '#fbbf24' : '#10b981',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span>●</span> {savingStatus === 'saving' ? 'AUTOSAVING...' : 'CLOUD SYNCED'}
          </div>
        </div>
      </div>

      {/* Main Game Interface with Grid & Numeric Pad */}
      <div style={{
        display: 'flex',
        gap: '2rem',
        justifyContent: 'center',
        alignItems: 'flex-start',
        flexWrap: 'wrap'
      }}>
        {/* 9x9 Sudoku Grid Container */}
        <div className="sudoku-board-container">
          <div className="sudoku-board-grid">
            {Array.from({ length: 9 }).map((_, r) =>
              Array.from({ length: 9 }).map((_, c) => {
                const isGiven = isGivenCell(r, c);
                const isSelected = selectedCell[0] === r && selectedCell[1] === c;
                const char = (grid[r] && grid[r][c]) ? grid[r][c] : '0';
                const displayVal = (char !== '0' && char !== '.') ? char : '';

                // Border accents for 3x3 Sudoku subgrids
                const borderRight = (c === 2 || c === 5) ? '2px solid rgba(168, 85, 247, 0.8)' : undefined;
                const borderBottom = (r === 2 || r === 5) ? '2px solid rgba(168, 85, 247, 0.8)' : undefined;

                return (
                  <div
                    key={`${r}-${c}`}
                    className="sudoku-cell"
                    onClick={() => setSelectedCell([r, c])}
                    style={{
                      fontWeight: isGiven ? 'bold' : '600',
                      color: isGiven ? 'white' : 'var(--accent-cyan)',
                      background: isSelected
                        ? 'rgba(6, 182, 212, 0.25)'
                        : isGiven
                          ? 'rgba(30, 27, 75, 0.7)'
                          : 'rgba(15, 12, 35, 0.85)',
                      borderRight,
                      borderBottom,
                      cursor: isGiven ? 'default' : 'pointer'
                    }}
                  >
                    {displayVal}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Action Controls & Cyber Numpad */}
        <div style={{ minWidth: '220px', maxWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="bracket-card" style={{ padding: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-cyber)', color: 'var(--accent-light)', marginBottom: '0.75rem' }}>
              INPUT COORDINATE (1-9)
            </div>

            {/* Numeric Pad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleCellInput(selectedCell[0], selectedCell[1], String(num))}
                  style={{
                    padding: '12px 0',
                    background: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '6px',
                    color: 'white',
                    fontFamily: 'var(--font-cyber)',
                    fontSize: '1.1rem',
                    cursor: 'pointer'
                  }}
                >
                  {num}
                </button>
              ))}
            </div>

            {/* Clear Cell Button */}
            <button
              type="button"
              onClick={() => handleCellInput(selectedCell[0], selectedCell[1], '0')}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '10px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '6px',
                color: '#f87171',
                fontFamily: 'var(--font-cyber)',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              ⌫ ERASE CELL
            </button>
          </div>

          {/* Submit Button Triggering In-App Confirmation */}
          <button
            type="button"
            className="btn-cyber"
            onClick={() => setShowSubmitConfirm(true)}
            disabled={submitting}
            style={{
              padding: '14px',
              fontSize: '0.95rem',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              borderColor: '#10b981'
            }}
          >
            {submitting ? 'FINALIZING SUBMISSION...' : '✓ SUBMIT FINAL PUZZLE'}
          </button>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
            * Note: Submission permanently locks this mission instance. Real timer never pauses when navigating away or refreshing.
          </p>
        </div>
      </div>

      {/* In-App Confirmation Dialog for Submission (No window.confirm) */}
      <ConfirmDialog
        isOpen={showSubmitConfirm}
        title="SUBMIT PUZZLE SOLUTION"
        message="Are you ready to submit your decryption grid? Once submitted, this mission instance will be permanently locked and evaluated."
        confirmText="SUBMIT NOW"
        cancelText="KEEP SOLVING"
        onConfirm={handleConfirmSubmit}
        onCancel={() => setShowSubmitConfirm(false)}
      />
    </div>
  );
}
