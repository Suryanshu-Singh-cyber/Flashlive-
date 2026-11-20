/**
 * FILE: apps/web/src/features/auth/AuthContext.tsx
 *
 * PURPOSE:
 * Manages Firebase authentication state and FLASHLIVE profile synchronization.
 *
 * WHY THIS FILE EXISTS:
 * Provides one auth source for protected routes, API calls and UI state.
 *
 * HOW IT WORKS:
 * Listens to Firebase onAuthStateChanged, fetches /api/auth/me when signed in,
 * exposes login/register/Google/password-reset/logout helpers.
 *
 * USED BY:
 * providers.tsx, protected routes and auth pages.
 *
 * SECURITY:
 * Session persistence is handled by Firebase; backend verifies ID tokens.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  getRedirectResult,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { PublicUser } from '@flashlive/shared';
import { apiService } from '@/services/api';
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase';
import { authErrorMessage } from '@/lib/authErrors';

function verificationActionCodeSettings() {
  return { url: `${window.location.origin}/verify-email`, handleCodeInApp: false };
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  user: PublicUser | null;
  loading: boolean;
  configured: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    if (!auth?.currentUser) {
      setUser(null);
      return;
    }
    try {
      setUser(await apiService.me());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile.');
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        setUser(await apiService.me());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to sync profile.');
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!auth) return;
    let active = true;
    void getRedirectResult(auth)
      .then((result) => {
        if (active && result?.user) setError(null);
      })
      .catch((err) => {
        if (active) setError(authErrorMessage(err));
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    firebaseUser,
    user,
    loading,
    configured: isFirebaseConfigured,
    error,
    refreshUser,
    signInWithGoogle: async () => {
      if (!auth) throw new Error('Firebase is not configured.');
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (err) {
        throw new Error(authErrorMessage(err));
      }
    },
    signInWithEmail: async (email, password) => {
      if (!auth) throw new Error('Firebase is not configured.');
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        throw new Error(authErrorMessage(err));
      }
    },
    registerWithEmail: async (name, email, password) => {
      if (!auth) throw new Error('Firebase is not configured.');
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name });
        await sendEmailVerification(credential.user, verificationActionCodeSettings());
      } catch (err) {
        throw new Error(authErrorMessage(err));
      }
    },
    resetPassword: async (email) => {
      if (!auth) throw new Error('Firebase is not configured.');
      try {
        await sendPasswordResetEmail(auth, email);
      } catch (err) {
        throw new Error(authErrorMessage(err));
      }
    },
    resendVerification: async () => {
      if (!auth?.currentUser) throw new Error('No signed-in user.');
      try {
        await sendEmailVerification(auth.currentUser, verificationActionCodeSettings());
      } catch (err) {
        throw new Error(authErrorMessage(err));
      }
    },
    logout: async () => {
      if (!auth) return;
      await signOut(auth);
      setUser(null);
    },
  }), [firebaseUser, user, loading, error, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
