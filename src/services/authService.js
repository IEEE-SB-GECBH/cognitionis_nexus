// src/services/authService.js
import { auth, db } from "../firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

async function register({ playerId, email, password }) {
  console.log("RAW PLAYER ID:", JSON.stringify(playerId)); // TEMP DEBUG — remove later

  const allowedRef = doc(db, "allowedPlayers", playerId);
  const allowedSnap = await getDoc(allowedRef);

  console.log("DOC EXISTS?", allowedSnap.exists()); // TEMP DEBUG — remove later

  if (!allowedSnap.exists()) {
    throw new Error("Invalid player ID — not recognized. Contact the organizers.");
  }
  if (allowedSnap.data().used) {
    throw new Error("This ID is already registered. Try logging in instead.");
  }

  const cred = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, "players", playerId), {
    playerId,
    email,
    uid: cred.user.uid,
    registeredAt: new Date().toISOString(),
  });

  await setDoc(allowedRef, { ...allowedSnap.data(), used: true }, { merge: true });

  return { success: true };
}

async function login({ playerId, password }) {
  const playerSnap = await getDoc(doc(db, "players", playerId));

  if (!playerSnap.exists()) {
    throw new Error("Invalid player ID or password.");
  }

  const playerData = playerSnap.data();
  const { email } = playerData;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const player = { playerId, email, ...playerData };
    return { success: true, user: cred.user, playerId, player };
  } catch (err) {
    throw new Error("Invalid player ID or password.");
  }
}

async function requestPasswordReset(param) {
  const target = typeof param === "object" && param !== null ? (param.email || param.playerId) : param;
  if (!target) return { message: "If this email is registered, a password reset link has been sent." };

  let email = target;
  if (!target.includes('@')) {
    const playerSnap = await getDoc(doc(db, "players", target));
    if (playerSnap.exists()) {
      email = playerSnap.data().email;
    } else {
      return { message: "If this email is registered, a password reset link has been sent." };
    }
  }

  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    // swallow — don't leak whether it succeeded/failed for privacy
  }
  return { message: "If this email is registered, a password reset link has been sent." };
}

async function hostLogin(param) {
  const hostId = typeof param === "object" && param !== null ? param.hostId : param;
  if (!hostId) {
    throw new Error("Invalid host ID.");
  }
  const hostSnap = await getDoc(doc(db, "validHosts", hostId));
  if (!hostSnap.exists()) {
    throw new Error("Invalid host ID.");
  }
  sessionStorage.setItem("hostSession", hostId);
  return { success: true, hostId };
}

function isHostLoggedIn() {
  return !!sessionStorage.getItem("hostSession");
}

function hostLogout() {
  sessionStorage.removeItem("hostSession");
}

async function logout() {
  await signOut(auth);
}

export const authService = {
  register,
  login,
  requestPasswordReset,
  hostLogin,
  isHostLoggedIn,
  hostLogout,
  logout,
};