/**
 * FILE: apps/web/src/lib/firebase.ts
 *
 * PURPOSE:
 * Initializes the Firebase client SDK for FLASHLIVE authentication.
 *
 * WHY THIS FILE EXISTS:
 * Centralizes Firebase config so auth providers and services share one app.
 *
 * HOW IT WORKS:
 * Reads VITE_FIREBASE_* env vars and exports auth plus Google provider.
 *
 * USED BY:
 * AuthContext and authentication pages.
 *
 * SECURITY:
 * Firebase client config is public by design; ID tokens are verified by API.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export const firebaseApp = isFirebaseConfigured ? (getApps()[0] ?? initializeApp(firebaseConfig)) : getApps()[0] ?? null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
