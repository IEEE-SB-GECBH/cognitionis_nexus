// TODO: connect to Firebase (Firestore/Auth)
export const allowedPlayers = [
  'IEEE-001',
  'IEEE-002',
  'IEEE-003',
  'MDC-2026-TEST',
  'MDC-2026-X9A2'
];

// TODO: connect to Firebase (Firestore/Auth)
export const validHostIds = [
  'HOST-IEEE-2026',
  'ADMIN-2026',
  'HOST-2026'
];

// LocalStorage Persistence Keys
const STORAGE_KEYS = {
  REGISTERED: 'mdc_registered_players',
  GAMES: 'mdc_games_db',
  SUBMISSIONS: 'mdc_submissions_db',
  LEADERBOARD: 'mdc_leaderboard_db'
};

const initialRegisteredPlayers = [
  {
    playerId: 'IEEE-001',
    email: 'agent@ieee.org',
    password: 'Password123'
  }
];

// Helper functions for registered players persistence
function getStoredRegisteredPlayers() {
  if (typeof localStorage === 'undefined') return initialRegisteredPlayers;
  const data = localStorage.getItem(STORAGE_KEYS.REGISTERED);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.REGISTERED, JSON.stringify(initialRegisteredPlayers));
    return initialRegisteredPlayers;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return initialRegisteredPlayers;
  }
}

function saveStoredRegisteredPlayers(players) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.REGISTERED, JSON.stringify(players));
  }
}

// Proxy wrapper around registeredPlayers to automatically read and persist array mutations (push, etc.)
let inMemoryRegistered = getStoredRegisteredPlayers();

// TODO: connect to Firebase (Firestore/Auth)
export const registeredPlayers = new Proxy(inMemoryRegistered, {
  get(target, prop, receiver) {
    const current = getStoredRegisteredPlayers();
    target.length = 0;
    target.push(...current);
    const value = Reflect.get(target, prop, receiver);
    if (typeof value === 'function') {
      return function (...args) {
        const result = value.apply(target, args);
        saveStoredRegisteredPlayers(target);
        return result;
      };
    }
    return value;
  },
  set(target, prop, value, receiver) {
    const res = Reflect.set(target, prop, value, receiver);
    saveStoredRegisteredPlayers(target);
    return res;
  }
});

// ==========================================
// MOCK DATA FOR GAMES, SUBMISSIONS & LEADERBOARD
// ==========================================

// TODO: connect to Firebase (Firestore/Auth)
export const initialMockGames = [
  {
    id: 'sudoku-1',
    title: 'Sudoku Matrix Decryption',
    gameType: 'Sudoku',
    difficulty: 'Medium',
    status: 'Live',
    description: 'Master 9x9 grid deduction and decrypt the quantum firewall before the terminal locks down.',
    releaseDate: '2026-06-25',
    deadline: '2026-06-30',
    attemptProgress: 100,
    solvedBy: ['IEEE-001'],
    questionGrid: [
      '530070000',
      '600195000',
      '098000060',
      '800060003',
      '400803001',
      '700020006',
      '060000280',
      '000419005',
      '000080079'
    ],
    answerGrid: [
      '534678912',
      '672195348',
      '198342567',
      '859761423',
      '426853791',
      '713924856',
      '961537284',
      '287419635',
      '345286179'
    ]
  },
  {
    id: 'quantum-1',
    title: 'Quantum Decryption Protocol',
    gameType: 'Sudoku',
    difficulty: 'Hard',
    status: 'Live',
    description: 'Decrypt the quantum firewall before the terminal locks down and alerts the network administrators.',
    releaseDate: '2026-06-26',
    deadline: '2026-07-02',
    attemptProgress: 45,
    solvedBy: [],
    questionGrid: [
      '000600400',
      '700003600',
      '000091080',
      '000000000',
      '050180003',
      '000306045',
      '040200060',
      '903000000',
      '020000100'
    ],
    answerGrid: [
      '581672439',
      '792843651',
      '364591782',
      '438957216',
      '256184973',
      '179326845',
      '845219367',
      '913765524',
      '627438195'
    ]
  },
  {
    id: 'cipher-1',
    title: 'Cipher Matrix Protocol',
    gameType: 'Sudoku',
    difficulty: 'Easy',
    status: 'Upcoming',
    description: 'Break advanced multi-layered hex ciphers using frequency analysis and key alignment.',
    releaseDate: '2026-07-05',
    deadline: '2026-07-12',
    attemptProgress: 0,
    solvedBy: [],
    questionGrid: [
      '000260701',
      '680070090',
      '190004500',
      '820100040',
      '004602900',
      '050003028',
      '009300074',
      '040050036',
      '703018000'
    ],
    answerGrid: [
      '435269781',
      '682571493',
      '197834562',
      '826195347',
      '374682915',
      '951743628',
      '519326874',
      '248957136',
      '763418259'
    ]
  }
];

// TODO: connect to Firebase (Firestore/Auth)
export const initialMockSubmissions = [
  {
    id: 'sub-1',
    playerId: 'IEEE-001',
    gameId: 'sudoku-1',
    gameTitle: 'Sudoku Matrix Decryption',
    score: 850,
    timeTaken: '04:15',
    correctCells: '81 / 81',
    solved: true,
    submittedAt: '2026-06-26 14:30'
  },
  {
    id: 'sub-2',
    playerId: 'IEEE-002',
    gameId: 'sudoku-1',
    gameTitle: 'Sudoku Matrix Decryption',
    score: 720,
    timeTaken: '05:40',
    correctCells: '81 / 81',
    solved: true,
    submittedAt: '2026-06-27 10:15'
  },
  {
    id: 'sub-3',
    playerId: 'IEEE-003',
    gameId: 'quantum-1',
    gameTitle: 'Quantum Decryption Protocol',
    score: 410,
    timeTaken: '08:12',
    correctCells: '64 / 81',
    solved: false,
    submittedAt: '2026-06-28 16:45'
  }
];

// TODO: connect to Firebase (Firestore/Auth)
export const initialMockLeaderboard = [
  { rank: 1, playerId: 'IEEE-001', name: 'Agent Alex', totalScore: 2850, gamesCompleted: 4 },
  { rank: 2, playerId: 'IEEE-002', name: 'Marcus Vance', totalScore: 2420, gamesCompleted: 3 },
  { rank: 3, playerId: 'IEEE-003', name: 'Aria Chen', totalScore: 1980, gamesCompleted: 2 },
  { rank: 4, playerId: 'MDC-2026-TEST', name: 'Devon Reed', totalScore: 1450, gamesCompleted: 2 },
  { rank: 5, playerId: 'MDC-2026-X9A2', name: 'Sophia Sterling', totalScore: 920, gamesCompleted: 1 }
];

// TODO: connect to Firebase (Firestore/Auth)
export const mockDataService = {
  getRegisteredPlayers: () => {
    return getStoredRegisteredPlayers();
  },

  addRegisteredPlayer: (newPlayer) => {
    const current = getStoredRegisteredPlayers();
    current.push(newPlayer);
    saveStoredRegisteredPlayers(current);
    return newPlayer;
  },

  getGames: () => {
    const data = localStorage.getItem(STORAGE_KEYS.GAMES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(initialMockGames));
      return initialMockGames;
    }
    try {
      return JSON.parse(data);
    } catch (e) {
      return initialMockGames;
    }
  },

  addGame: (newGame) => {
    const games = mockDataService.getGames();
    const formattedGame = {
      ...newGame,
      id: `game-${Date.now()}`,
      attemptProgress: 0,
      solvedBy: []
    };
    games.unshift(formattedGame);
    localStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(games));
    return formattedGame;
  },

  updateGameStatus: (gameId, newStatus) => {
    const games = mockDataService.getGames();
    const updated = games.map(g => g.id === gameId ? { ...g, status: newStatus } : g);
    localStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(updated));
    return updated;
  },

  getSubmissions: (gameIdFilter = 'all') => {
    const data = localStorage.getItem(STORAGE_KEYS.SUBMISSIONS);
    let submissions = initialMockSubmissions;
    if (data) {
      try {
        submissions = JSON.parse(data);
      } catch (e) {}
    } else {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(initialMockSubmissions));
    }

    if (gameIdFilter === 'all') return submissions;
    return submissions.filter(s => s.gameId === gameIdFilter);
  },

  addSubmission: (submission) => {
    const submissions = mockDataService.getSubmissions('all');
    const newSub = {
      ...submission,
      id: `sub-${Date.now()}`,
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    submissions.unshift(newSub);
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));
    return newSub;
  },

  getPlayerResults: (playerId) => {
    const submissions = mockDataService.getSubmissions('all');
    return submissions.filter(s => s.playerId.toLowerCase() === (playerId || '').toLowerCase());
  },

  getLeaderboard: (gameIdFilter = 'all') => {
    if (gameIdFilter === 'all') {
      const data = localStorage.getItem(STORAGE_KEYS.LEADERBOARD);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(initialMockLeaderboard));
        return initialMockLeaderboard;
      }
      try {
        return JSON.parse(data);
      } catch (e) {
        return initialMockLeaderboard;
      }
    }

    // Per-game leaderboard generated from submissions
    const submissions = mockDataService.getSubmissions(gameIdFilter);
    const sorted = [...submissions].sort((a, b) => b.score - a.score);
    return sorted.map((sub, index) => ({
      rank: index + 1,
      playerId: sub.playerId,
      name: sub.playerId,
      totalScore: sub.score,
      gamesCompleted: sub.solved ? 1 : 0
    }));
  }
};
