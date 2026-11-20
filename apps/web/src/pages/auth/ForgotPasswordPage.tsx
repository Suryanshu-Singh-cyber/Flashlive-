/**
 * FILE: apps/web/src/pages/auth/ForgotPasswordPage.tsx
 *
 * PURPOSE:
 * Sends Firebase password reset emails with validation and feedback.
 *
 * USED BY:
 * /forgot-password route.
 */

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Zap } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ParticleField } from '@/components/three/ParticleField';

export function ForgotPasswordPage() {
  const { resetPassword, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email) return setError('Email is required.');
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5">
      <ParticleField className="absolute inset-0 h-full w-full opacity-50" />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated relative w-full max-w-md p-8">
        <Logo />
        <h1 className="mt-8 font-condensed text-4xl font-bold uppercase">Reset password</h1>
        <p className="mt-2 text-sm text-muted">Enter your account email and we will send a secure reset link.</p>
        {sent ? (
          <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">Reset email sent. Check your inbox and spam folder.</div>
        ) : (
          <form onSubmit={submit} className="mt-6 grid gap-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail className="h-4 w-4" />} autoComplete="email" />
            {error && <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
            <Button type="submit" loading={loading} disabled={!configured} className="w-full"><Zap className="h-4 w-4" /> Send reset link</Button>
          </form>
        )}
        <Link to="/login" className="mt-6 inline-block text-sm text-muted hover:text-primary">Back to sign in</Link>
      </motion.div>
    </div>
  );
}
