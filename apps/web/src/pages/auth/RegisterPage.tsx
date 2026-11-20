/**
 * FILE: apps/web/src/pages/auth/RegisterPage.tsx
 *
 * PURPOSE:
 * Animated FLASHLIVE registration page with password strength feedback.
 *
 * WHY THIS FILE EXISTS:
 * Provides account creation with Firebase email/password and Google signup.
 *
 * HOW IT WORKS:
 * Validates name/email/password/confirm, creates Firebase user, updates profile,
 * sends verification email and routes to dashboard.
 *
 * USED BY:
 * /register route.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Github, Lock, Mail, User, Zap } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ParticleField } from '@/components/three/ParticleField';

function strength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function RegisterPage() {
  const { registerWithEmail, signInWithGoogle, configured, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState<'email' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const score = useMemo(() => strength(password), [password]);
  useEffect(() => {
    if (user && loading !== 'email') navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!name.trim() || !email || !password) return setError('All fields are required.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    if (!terms) return setError('You must agree to the terms to continue.');
    setLoading('email');
    try {
      await registerWithEmail(name.trim(), email, password);
      navigate('/verify-email');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden overflow-hidden lg:block">
        <ParticleField className="absolute inset-0 h-full w-full opacity-60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(0,204,255,0.14),transparent_35%),radial-gradient(circle_at_20%_80%,rgba(232,255,0,0.14),transparent_35%)]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div>
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="font-display text-7xl uppercase leading-[0.9]">Build in<br /><span className="text-primary text-glow">parallel.</span></motion.h1>
            <p className="mt-6 max-w-md text-muted">Create your FLASHLIVE workspace and deploy your first React + Vite project with concurrent workers.</p>
          </div>
        </div>
      </section>
      <section className="flex items-center justify-center px-5 py-12">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="surface-elevated w-full max-w-lg p-7 md:p-9">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Create account</p>
          <h2 className="mt-2 font-condensed text-4xl font-bold uppercase">Start deploying</h2>
          {error && <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}
          <Button variant="secondary" className="mt-6 w-full" disabled={!configured} onClick={async () => { setLoading('google'); try { await signInWithGoogle(); } catch (err) { setError(err instanceof Error ? err.message : 'Google sign-up failed.'); } finally { setLoading(null); } }} loading={loading === 'google'}>
            <Github className="h-4 w-4" /> Continue with Google
          </Button>
          <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-muted"><span className="h-px flex-1 bg-line" /> or email <span className="h-px flex-1 bg-line" /></div>
          <form onSubmit={submit} className="grid gap-4">
            <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" icon={<User className="h-4 w-4" />} autoComplete="name" />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" icon={<Mail className="h-4 w-4" />} autoComplete="email" />
            <Input label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} icon={<Lock className="h-4 w-4" />} autoComplete="new-password" />
            {password && <div className="-mt-2"><div className="h-1.5 overflow-hidden rounded-full bg-surface-hover"><div className={`h-full transition-all ${score <= 1 ? 'bg-red-400' : score === 2 ? 'bg-amber-300' : 'bg-primary'}`} style={{ width: `${score * 25}%` }} /></div><p className="mt-1 text-[11px] text-muted">{score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong'}</p></div>}
            <Input label="Confirm password" type={showPassword ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} icon={<Lock className="h-4 w-4" />} autoComplete="new-password" />
            <button type="button" className="-mt-2 flex items-center gap-2 text-xs text-muted hover:text-primary" onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />} {showPassword ? 'Hide passwords' : 'Show passwords'}</button>
            <label className="flex items-start gap-3 text-sm text-muted"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-1 accent-[#E8FF00]" /><span>I agree to the <Link to="/terms" className="text-primary">Terms</Link> and <Link to="/privacy" className="text-primary">Privacy Policy</Link>.</span></label>
            <Button type="submit" loading={loading === 'email'} disabled={!configured} className="w-full"><Zap className="h-4 w-4" /> Create account</Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Sign in</Link></p>
        </motion.div>
      </section>
    </div>
  );
}
