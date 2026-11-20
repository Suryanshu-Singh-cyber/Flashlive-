/**
 * FILE: apps/web/src/pages/auth/VerifyEmailPage.tsx
 *
 * PURPOSE:
 * Guides users to verify their Firebase email and resend verification.
 *
 * USED BY:
 * /verify-email route.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MailCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';

export function VerifyEmailPage() {
  const { firebaseUser, resendVerification, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const resend = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await resendVerification();
      setMessage('Verification email sent again.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not resend email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="surface-elevated w-full max-w-md p-8 text-center">
        <Logo className="mx-auto" />
        <MailCheck className="mx-auto mt-8 h-12 w-12 text-primary" />
        <h1 className="mt-5 font-condensed text-4xl font-bold uppercase">Verify your email</h1>
        <p className="mt-3 text-sm text-muted">We sent a verification link to <span className="text-ink">{firebaseUser?.email ?? 'your email'}</span>. Verify it to secure your account.</p>
        {message && <div className="mt-4 rounded-xl border border-line bg-surface p-3 text-sm text-muted">{message}</div>}
        <div className="mt-6 grid gap-3">
          <Button onClick={resend} loading={loading}><RefreshCw className="h-4 w-4" /> Resend verification</Button>
          <Button variant="secondary" onClick={() => void logout()}>Sign out</Button>
          <Link to="/dashboard" className="text-sm text-muted hover:text-primary">Continue to dashboard</Link>
        </div>
      </motion.div>
    </div>
  );
}
