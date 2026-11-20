/**
 * FILE: apps/web/src/lib/authErrors.ts
 *
 * PURPOSE:
 * Converts Firebase Auth error codes into user-friendly FLASHLIVE messages.
 *
 * USED BY:
 * AuthContext auth helpers.
 */

const FIREBASE_AUTH_MESSAGES: Record<string, string> = {
  'auth/configuration-not-found': 'Firebase Authentication is not enabled for this project. Enable it in Firebase Console → Authentication.',
  'auth/operation-not-allowed': 'This sign-in provider is not enabled. Enable Email/Password or Google in Firebase Console → Authentication.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/user-not-found': 'No account exists for this email.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Password must be at least 8 characters.',
  'auth/email-already-in-use': 'An account already exists for this email.',
  'auth/missing-email': 'Email is required.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
  'auth/popup-blocked': 'Allow pop-ups to continue with Google sign-in.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/requires-recent-login': 'Please sign in again before continuing.',
};

export function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return `Domain ${host} is not authorized for Firebase Auth. Add it under Authentication → Settings → Authorized domains.`;
  }
  if (code && FIREBASE_AUTH_MESSAGES[code]) return FIREBASE_AUTH_MESSAGES[code];
  return error instanceof Error ? error.message : 'Authentication failed.';
}
