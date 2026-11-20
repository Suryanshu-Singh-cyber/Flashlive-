/**
 * FILE: apps/web/src/features/auth/ProtectedRoute.tsx
 *
 * PURPOSE:
 * Guards authenticated routes until Firebase and profile sync complete.
 *
 * USED BY:
 * app/router.tsx.
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Spinner } from '@/components/ui/Spinner';

export function ProtectedRoute() {
  const { user, loading, configured } = useAuth();
  if (!configured) return <Navigate to="/login" replace />;
  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
