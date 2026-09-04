// src/services/gameService.js
import { db } from "../firebaseConfig";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  onSnapshot
} from "firebase/firestore";

/**
 * Helper to parse a date string or timestamp safely.
 * Handles numbers, Firestore Timestamps, pure YYYY-MM-DD dates, and YYYY-MM-DDTHH:mm local datetime inputs.
 */
export function parseDateTimestamp(val, isEndOfDay = false) {
  if (!val) return Infinity;
  if (typeof val === 'number') return isNaN(val) ? Infinity : val;
  if (val.toMillis && typeof val.toMillis === 'function') return val.toMillis();
  if (val.seconds && typeof val.seconds === 'number') return val.seconds * 1000;

  try {
    const str = String(val).trim();
    if (!str) return Infinity;

    // 1. Check if format is pure date YYYY-MM-DD (e.g. "2026-09-04")
    const dateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, y, mo, d] = dateOnlyMatch;
      const dateObj = isEndOfDay
        ? new Date(Number(y), Number(mo) - 1, Number(d), 23, 59, 59, 999)
        : new Date(Number(y), Number(mo) - 1, Number(d), 0, 0, 0, 0);
      return dateObj.getTime();
    }

    // 2. Check if format is datetime-local (e.g. "2026-09-04T12:50" or "2026-09-04T12:50:00")
    const dateTimeMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (dateTimeMatch) {
      const [, y, mo, d, h, mi, s] = dateTimeMatch;
      const dateObj = new Date(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h),
        Number(mi),
        Number(s || 0),
        0
      );
      return dateObj.getTime();
    }

    // 3. Fallback standard Date parse
    const fallbackDate = new Date(str);
    return isNaN(fallbackDate.getTime()) ? Infinity : fallbackDate.getTime();
  } catch (e) {
    return Infinity;
  }
}

/**
 * Helper to determine if an instance or category has passed its deadline.
 * Note: this only triggers when someone opens the app after expiry;
 * true zero-visitor enforcement needs a scheduled Cloud Function later (Blaze plan).
 */
export function isExpired(instance, category) {
  if (!instance) return false;
  const now = Date.now();

  const rawInstEnd = instance.endTime || instance.endDate;
  const rawCatEnd = category?.endDate || category?.endTime;

  const instEnd = parseDateTimestamp(rawInstEnd, true);
  const catEnd = parseDateTimestamp(rawCatEnd, true);

  return (instEnd !== Infinity && now > instEnd) || (catEnd !== Infinity && now > catEnd);
}

// Fallback seed categories if Firestore collection is initially empty
const defaultSeedCategories = [
  {
    id: "cat-sudoku-core",
    name: "Quantum Sudoku Decryption",
    description: "Cyber deduction puzzles testing algorithmic thinking and spatial logic.",
    active: true,
    startDate: "2026-08-01",
    endDate: "2026-12-31",
    order: 0
  },
  {
    id: "cat-cipher-matrix",
    name: "Cipher Matrix Hex Decryption",
    description: "Advanced cryptographic decryption missions against rogue autonomous nodes.",
    active: false,
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    order: 1
  }
];

// Fallback seed instances with startTime/endTime
const defaultSeedGames = [
  {
    id: "sudoku-alpha-1",
    categoryId: "cat-sudoku-core",
    title: "Sudoku — Week 1 Matrix Decryption",
    question: [
      "530070000",
      "600195000",
      "098000060",
      "800060003",
      "400803001",
      "700020006",
      "060000280",
      "000419005",
      "000080079"
    ],
    answer: [
      "534678912",
      "672195348",
      "198342567",
      "859761423",
      "426853791",
      "713924856",
      "961537284",
      "287419635",
      "345286179"
    ],
    startTime: "2026-08-01T09:00",
    endTime: "2026-12-31T23:59",
    status: "live"
  },
  {
    id: "sudoku-beta-2",
    categoryId: "cat-sudoku-core",
    title: "Sudoku — Week 2 Quantum Protocol",
    question: [
      "000600400",
      "700003600",
      "000091080",
      "000000000",
      "050180003",
      "000306045",
      "040200060",
      "903000000",
      "020000100"
    ],
    answer: [
      "581672439",
      "792843651",
      "364591782",
      "438957216",
      "256184973",
      "179326845",
      "845219367",
      "913765524",
      "627438195"
    ],
    startTime: "2026-08-15T09:00",
    endTime: "2026-12-31T23:59",
    status: "live"
  }
];

export const gameService = {
  isExpired,

  // ==========================================
  // CATEGORIES
  // ==========================================
  async getCategories() {
    try {
      const snap = await getDocs(collection(db, "gameCategories"));
      let cats = [];
      if (!snap.empty) {
        cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else {
        // Seed default categories if empty
        for (const cat of defaultSeedCategories) {
          const { id, ...data } = cat;
          await setDoc(doc(db, "gameCategories", id), data);
        }
        cats = [...defaultSeedCategories];
      }

      // Sort consistently by order
      cats.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return cats;
    } catch (err) {
      console.warn("Using local fallback categories:", err);
      return defaultSeedCategories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
  },

  async addCategory(categoryData) {
    const categories = await this.getCategories();
    const maxOrder = categories.length > 0
      ? Math.max(...categories.map(c => c.order ?? 0))
      : -1;

    const newId = `cat-${Date.now()}`;
    const data = {
      name: categoryData.name || "Untitled Category",
      description: categoryData.description || "",
      active: !!categoryData.active,
      startDate: categoryData.startDate || new Date().toISOString().split("T")[0],
      endDate: categoryData.endDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      order: maxOrder + 1
    };
    await setDoc(doc(db, "gameCategories", newId), data);
    return { id: newId, ...data };
  },

  async updateCategory(categoryId, updates) {
    const ref = doc(db, "gameCategories", categoryId);
    await updateDoc(ref, updates);
    return { id: categoryId, ...updates };
  },

  async reorderCategories(orderedCategories) {
    // updates order for each category in Firestore
    for (let i = 0; i < orderedCategories.length; i++) {
      const cat = orderedCategories[i];
      try {
        const ref = doc(db, "gameCategories", cat.id);
        await updateDoc(ref, { order: i });
      } catch (e) {
        console.warn(`Failed to update order for category ${cat.id}:`, e);
      }
    }
    return orderedCategories.map((c, idx) => ({ ...c, order: idx }));
  },

  async deleteCategory(categoryId) {
    // 1. Delete category document
    const catRef = doc(db, "gameCategories", categoryId);
    await deleteDoc(catRef);

    // 2. Delete all child game instances belonging to this category
    try {
      const q = query(collection(db, "games"), where("categoryId", "==", categoryId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, "games", d.id));
      }
    } catch (e) {
      console.warn("Error cleaning up child games for deleted category:", e);
    }
    return true;
  },

  // ==========================================
  // GAMES / INSTANCES
  // ==========================================
  async getInstancesByCategory(categoryId) {
    try {
      // Fetch category data first to check overall category window
      let category = null;
      try {
        const catSnap = await getDoc(doc(db, "gameCategories", categoryId));
        if (catSnap.exists()) {
          category = catSnap.data();
        }
      } catch (e) {
        console.warn("Could not fetch category:", e);
      }

      // Fetch all games from collection
      const allGamesSnap = await getDocs(collection(db, "games"));
      let games = [];

      if (!allGamesSnap.empty) {
        const allDocs = allGamesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        games = allDocs.filter(g => String(g.categoryId).trim() === String(categoryId).trim());
      } else {
        // Seed default games if empty
        const seeds = defaultSeedGames.filter(g => g.categoryId === categoryId);
        for (const g of seeds) {
          const { id, ...data } = g;
          await setDoc(doc(db, "games", id), data);
        }
        games = seeds;
      }

      // Check expiry and self-heal expired ones
      const processed = games.map(instance => {
        if (isExpired(instance, category) && (instance.status || '').toLowerCase() !== 'closed') {
          // Self-heal in background: update Firestore status to "closed"
          this.updateGameStatus(instance.id, "closed").catch(err => {
            console.error("Failed to auto-close expired game:", instance.id, err);
          });
          return { ...instance, status: "closed" };
        }
        return instance;
      });

      return processed;
    } catch (err) {
      console.warn("Error fetching instances:", err);
      return defaultSeedGames.filter(g => g.categoryId === categoryId);
    }
  },

  async getLiveGamesByCategory(categoryId) {
    return this.getInstancesByCategory(categoryId);
  },

  async getUpcomingGames() {
    try {
      const snap = await getDocs(collection(db, "games"));
      if (!snap.empty) {
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return all.filter(g => (g.status || '').toLowerCase() === 'upcoming');
      }
      return defaultSeedGames.filter(g => (g.status || '').toLowerCase() === 'upcoming');
    } catch (err) {
      return [];
    }
  },

  async getGamesByCategory(categoryId) {
    return this.getInstancesByCategory(categoryId);
  },

  async getAllGames() {
    try {
      // Fetch categories map for deadline cross-checking
      let categoriesMap = {};
      try {
        const catSnap = await getDocs(collection(db, "gameCategories"));
        catSnap.docs.forEach(d => {
          categoriesMap[d.id] = d.data();
        });
      } catch (e) {
        console.warn("Could not load categories for expiry map:", e);
      }

      const snap = await getDocs(collection(db, "games"));
      let games = [];
      if (!snap.empty) {
        games = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else {
        games = [...defaultSeedGames];
      }

      // Self-heal any expired games
      return games.map(g => {
        const cat = categoriesMap[g.categoryId];
        if (isExpired(g, cat) && (g.status || '').toLowerCase() !== 'closed') {
          this.updateGameStatus(g.id, 'closed').catch(err => {
            console.error("Failed to auto-close expired game:", g.id, err);
          });
          return { ...g, status: 'closed' };
        }
        return g;
      });
    } catch (err) {
      return defaultSeedGames;
    }
  },

  async getGameById(gameId) {
    try {
      let game = null;
      const snap = await getDoc(doc(db, "games", gameId));
      if (snap.exists()) {
        game = { id: snap.id, ...snap.data() };
      } else {
        game = defaultSeedGames.find(g => g.id === gameId) || null;
      }

      if (game) {
        let cat = null;
        if (game.categoryId) {
          const catSnap = await getDoc(doc(db, "gameCategories", game.categoryId));
          if (catSnap.exists()) cat = catSnap.data();
        }
        if (isExpired(game, cat) && (game.status || '').toLowerCase() !== 'closed') {
          this.updateGameStatus(game.id, 'closed').catch(err => {
            console.error("Failed to auto-close expired game:", game.id, err);
          });
          game = { ...game, status: 'closed' };
        }
      }

      return game;
    } catch (err) {
      return defaultSeedGames.find(g => g.id === gameId) || null;
    }
  },

  async addGame(gameData) {
    const newId = `game-${Date.now()}`;
    const data = {
      categoryId: String(gameData.categoryId || "cat-sudoku-core").trim(),
      title: gameData.title || "Untitled Puzzle",
      question: gameData.question || [],
      answer: gameData.answer || [],
      startTime: gameData.startTime || new Date().toISOString().substring(0, 16),
      endTime: gameData.endTime || new Date(Date.now() + 14 * 86400000).toISOString().substring(0, 16),
      status: (gameData.status || "live").toLowerCase()
    };
    await setDoc(doc(db, "games", newId), data);
    return { id: newId, ...data };
  },

  async updateGame(gameId, updates) {
    const ref = doc(db, "games", gameId);
    await updateDoc(ref, updates);
    return { id: gameId, ...updates };
  },

  async updateGameStatus(gameId, status) {
    const ref = doc(db, "games", gameId);
    await updateDoc(ref, { status: (status || "live").toLowerCase() });
    return { id: gameId, status: (status || "live").toLowerCase() };
  },

  async deleteGame(gameId) {
    const ref = doc(db, "games", gameId);
    await deleteDoc(ref);
    return true;
  },

  // ==========================================
  // ATTEMPTS & PROGRESS (1 true attempt per player per game)
  // ==========================================
  getAttemptDocId(playerId, gameId) {
    return `${playerId}_${gameId}`.replace(/[\/\s]/g, "_");
  },

  async getAttempt(playerId, gameId) {
    if (!playerId || !gameId) return null;
    const docId = this.getAttemptDocId(playerId, gameId);
    const snap = await getDoc(doc(db, "attempts", docId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  },

  async startOrResumeAttempt(playerId, gameId, initialGrid) {
    const docId = this.getAttemptDocId(playerId, gameId);
    const snap = await getDoc(doc(db, "attempts", docId));

    if (snap.exists()) {
      const data = snap.data();
      return { id: snap.id, ...data };
    }

    // Create fresh attempt with server timestamp
    const now = Date.now();
    const newAttempt = {
      playerId,
      gameId,
      attemptStartedAt: Timestamp.fromMillis(now),
      attemptStartedAtMillis: now, // cached client millis for instant calculation
      currentGrid: initialGrid,
      status: "in_progress",
      score: 0,
      correctCells: 0,
      totalBlanks: 0,
      timeTakenSec: 0,
      submittedAt: null
    };

    await setDoc(doc(db, "attempts", docId), newAttempt);
    return { id: docId, ...newAttempt };
  },

  async saveProgress(playerId, gameId, currentGrid) {
    if (!playerId || !gameId) return;
    const docId = this.getAttemptDocId(playerId, gameId);
    const ref = doc(db, "attempts", docId);
    await updateDoc(ref, {
      currentGrid,
      lastSavedAt: serverTimestamp()
    });
  },

  async submitAttempt(playerId, gameId, currentGrid, answerGrid) {
    const docId = this.getAttemptDocId(playerId, gameId);
    const snap = await getDoc(doc(db, "attempts", docId));

    let startedMillis = Date.now();
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === "submitted") {
        return { id: snap.id, ...data };
      }
      if (data.attemptStartedAt?.toMillis) {
        startedMillis = data.attemptStartedAt.toMillis();
      } else if (data.attemptStartedAtMillis) {
        startedMillis = data.attemptStartedAtMillis;
      }
    }

    const elapsedSeconds = Math.max(1, Math.floor((Date.now() - startedMillis) / 1000));

    // Evaluation of 9x9 Sudoku
    let correctCells = 0;
    let totalCells = 81;

    for (let r = 0; r < 9; r++) {
      const userRow = (currentGrid && currentGrid[r]) ? currentGrid[r] : "000000000";
      const ansRow = (answerGrid && answerGrid[r]) ? answerGrid[r] : "000000000";
      for (let c = 0; c < 9; c++) {
        const uChar = userRow[c];
        const aChar = ansRow[c];
        if (uChar !== "0" && uChar !== ".") {
          if (uChar === aChar) {
            correctCells++;
          }
        }
      }
    }

    // Score calculation: 1000 base points with accuracy and speed bonus
    const isFullySolved = correctCells === 81;
    const timeBonus = isFullySolved ? Math.max(0, 300 - elapsedSeconds) : 0;
    const accuracyScore = Math.round((correctCells / totalCells) * 1000);
    const finalScore = accuracyScore + timeBonus;

    const submissionData = {
      currentGrid,
      status: "submitted",
      score: finalScore,
      correctCells,
      totalBlanks: 81,
      timeTakenSec: elapsedSeconds,
      submittedAt: serverTimestamp(),
      submittedAtString: new Date().toISOString().replace("T", " ").substring(0, 16)
    };

    const ref = doc(db, "attempts", docId);
    await updateDoc(ref, submissionData);

    return {
      id: docId,
      playerId,
      gameId,
      ...submissionData
    };
  },

  // ==========================================
  // RESULTS & LEADERBOARD
  // ==========================================
  async getResultsForGame(gameId) {
    try {
      const q = query(
        collection(db, "attempts"),
        where("gameId", "==", gameId),
        where("status", "==", "submitted")
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Sort by score desc, then timeTakenSec asc
      results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.timeTakenSec || 0) - (b.timeTakenSec || 0);
      });

      return results.map((r, idx) => ({
        rank: idx + 1,
        id: r.id,
        playerId: r.playerId,
        score: r.score || 0,
        correctCells: `${r.correctCells || 0} / 81`,
        rawCorrectCells: r.correctCells || 0,
        currentGrid: r.currentGrid || [],
        timeTaken: this.formatSeconds(r.timeTakenSec || 0),
        timeTakenSec: r.timeTakenSec || 0,
        solved: r.correctCells === 81,
        submittedAt: r.submittedAtString || (r.submittedAt?.toDate ? r.submittedAt.toDate().toISOString().substring(0, 16).replace("T", " ") : "Recently")
      }));
    } catch (err) {
      console.warn("Could not load results for game:", gameId, err);
      return [];
    }
  },

  async getPlayerAttempts(playerId) {
    try {
      // Fetch all games & categories for enriching attempt records
      let gamesMap = {};
      let catsMap = {};
      try {
        const [gamesSnap, catsSnap] = await Promise.all([
          getDocs(collection(db, "games")),
          getDocs(collection(db, "gameCategories"))
        ]);
        gamesSnap.docs.forEach(d => { gamesMap[d.id] = { id: d.id, ...d.data() }; });
        catsSnap.docs.forEach(d => { catsMap[d.id] = { id: d.id, ...d.data() }; });
      } catch (e) {
        console.warn("Could not load games/categories map for attempts enrichment:", e);
      }

      const q = query(
        collection(db, "attempts"),
        where("playerId", "==", playerId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data();
        const game = gamesMap[data.gameId] || defaultSeedGames.find(g => g.id === data.gameId);
        const cat = game ? (catsMap[game.categoryId] || defaultSeedCategories.find(c => c.id === game.categoryId)) : null;

        const gameTitle = game?.title || data.gameId;
        const categoryName = cat?.name || "General";

        return {
          id: d.id,
          ...data,
          gameTitle,
          categoryName,
          displayLabel: `${gameTitle} (${categoryName})`
        };
      });
    } catch (err) {
      return [];
    }
  },

  async getOverallLeaderboard() {
    try {
      const q = query(
        collection(db, "attempts"),
        where("status", "==", "submitted")
      );
      const snap = await getDocs(q);
      const attempts = snap.docs.map(d => d.data());

      // Aggregate by playerId
      const playerMap = {};
      for (const att of attempts) {
        const pid = att.playerId;
        if (!playerMap[pid]) {
          playerMap[pid] = {
            playerId: pid,
            name: pid,
            totalScore: 0,
            gamesCompleted: 0,
            totalTimeSec: 0
          };
        }
        playerMap[pid].totalScore += (att.score || 0);
        playerMap[pid].gamesCompleted += 1;
        playerMap[pid].totalTimeSec += (att.timeTakenSec || 0);
      }

      const leaderboard = Object.values(playerMap);
      leaderboard.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return a.totalTimeSec - b.totalTimeSec;
      });

      return leaderboard.map((item, idx) => ({
        rank: idx + 1,
        ...item
      }));
    } catch (err) {
      console.warn("Could not load overall leaderboard:", err);
      return [];
    }
  },

  formatSeconds(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  },

  // ==========================================
  // BROADCAST MESSAGING
  // ==========================================
  async sendBroadcast({ title, message, type = "announcement" }) {
    const newId = `broadcast-${Date.now()}`;
    const now = new Date();
    const data = {
      title: (title || "Official Announcement").trim(),
      message: (message || "").trim(),
      type: type || "announcement", // 'announcement' | 'warning' | 'urgent' | 'info'
      createdAt: serverTimestamp(),
      createdAtMillis: Date.now(),
      createdAtString: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    await setDoc(doc(db, "broadcasts", newId), data);
    return { id: newId, ...data };
  },

  async getBroadcasts() {
    try {
      const snap = await getDocs(collection(db, "broadcasts"));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0));
        return list;
      }
      return [];
    } catch (e) {
      console.warn("Error fetching broadcasts:", e);
      return [];
    }
  },

  async deleteBroadcast(broadcastId) {
    try {
      await deleteDoc(doc(db, "broadcasts", broadcastId));
      return true;
    } catch (e) {
      console.warn("Error deleting broadcast:", e);
      throw e;
    }
  },

  listenToBroadcasts(callback) {
    try {
      const unsubscribe = onSnapshot(collection(db, "broadcasts"), (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAtMillis || 0) - (a.createdAtMillis || 0));
        callback(list);
      }, (error) => {
        console.warn("Real-time broadcast listener error:", error);
      });
      return unsubscribe;
    } catch (e) {
      console.warn("Could not attach broadcast snapshot listener:", e);
      return () => {};
    }
  }
};
