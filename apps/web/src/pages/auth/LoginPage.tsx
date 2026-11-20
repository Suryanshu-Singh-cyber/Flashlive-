/**
 * FILE: apps/web/src/pages/auth/LoginPage.tsx
 *
 * PURPOSE:
 * Cinematic FLASHLIVE sign-in experience with Google and email/password auth.
 *
 * WHY THIS FILE EXISTS:
 * Authentication is a flagship UX surface and must feel premium while remaining
 * accessible and functional.
 *
 * HOW IT WORKS:
 * Uses Firebase Auth through AuthContext, validates fields, shows loading and
 * inline errors, and navigates to /dashboard after sign-in.
 *
 * USED BY:
 * /login route.
 *
 * SECURITY:
 * Credentials go only to Firebase; backend verifies ID tokens separately.
 */

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Github, Lock, Mail, Zap } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ParticleField } from '@/components/three/ParticleField';

export function LoginPage() {
  const { signInWithEmail, signInWithGoogle, configured, error: authError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }
    setLoading('email');
    try {
      await signInWithEmail(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(null);
    }
  };

  const google = async () => {
    setError(null);
    setLoading('google');
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-line bg-surface/40 lg:block">
        <ParticleField className="absolute inset-0 h-full w-full opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(232,255,0,0.16),transparent_35%),radial-gradient(circle_at_75%_70%,rgba(0,204,255,0.12),transparent_35%)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-primary">Deploy smarter. Build concurrently.</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="max-w-xl font-display text-7xl uppercase leading-[0.9] text-ink">
              Push code.<br /><span className="text-primary text-glow">Go live.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }} className="mt-6 max-w-md text-muted">
              Connect GitHub, watch concurrent Docker builds, stream real logs and publish static sites from one dashboard.
            </motion.p>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-muted"><span className="h-2 w-2 animate-pulseGlow rounded-full bg-primary" /> PostgreSQL queue · 3 build slots · automatic recovery</div>
        </div>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="surface-elevated w-full max-w-md p-7 md:p-9">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Welcome back</p>
          <h2 className="mt-2 font-condensed text-4xl font-bold uppercase text-ink">Sign in to FLASHLIVE</h2>
          <p className="mt-2 text-sm text-muted">Deployments, queues and live logs are waiting.</p>

          {!configured && <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">Firebase is not configured. Add VITE_FIREBASE_* values to enable authentication.</div>}
          {(error || authError) && <div className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error ?? authError}</div>}

          <Button variant="secondary" className="mt-6 w-full" onClick={google} loading={loading === 'google'} disabled={!configured}>
            <Github className="h-4 w-4" /> Continue with Google
          </Button>
          <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-muted"><span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" /></div>

          <form onSubmit={submit} className="grid gap-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" icon={<Mail className="h-4 w-4" />} autoComplete="email" />
            <Input label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" icon={<Lock className="h-4 w-4" />} autoComplete="current-password" />
            <button type="button" className="-mt-2 flex items-center gap-2 text-xs text-muted hover:text-primary" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {showPassword ? 'Hide password' : 'Show password'}
            </button>
            <div className="flex justify-end"><Link to="/forgot-password" className="text-xs text-muted hover:text-primary">Forgot password?</Link></div>
            <Button type="submit" loading={loading === 'email'} disabled={!configured} className="w-full"><Zap className="h-4 w-4" /> Sign in</Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">New to FLASHLIVE? <Link to="/register" className="font-semibold text-primary hover:underline">Create an account</Link></p>
          <p className="mt-3 text-center text-[11px] text-muted/70">By continuing you agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy</Link>.</p>
        </motion.div>
      </section>
    </div>
  );
}
