/**
 * FILE: apps/web/src/app/providers.tsx
 *
 * PURPOSE:
 * Wraps the application with global providers.
 *
 * USED BY:
 * app/App.tsx.
 */

import type { ReactNode } from 'react';
import { AuthProvider } from '@/features/auth/AuthContext';

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
