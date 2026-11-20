/**
 * FILE: apps/web/src/layouts/PublicLayout.tsx
 *
 * PURPOSE:
 * Provides the public marketing shell with animated navbar, mobile drawer and footer.
 *
 * WHY THIS FILE EXISTS:
 * Keeps landing/auth public pages consistent while protected app uses DashboardLayout.
 *
 * USED BY:
 * Public routes in router.tsx.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, Github, Twitter, Mail } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const links = [
  { label: 'Product', to: '/#features' },
  { label: 'Features', to: '/#features' },
  { label: 'How It Works', to: '/#how-it-works' },
  { label: 'Architecture', to: '/#architecture' },
  { label: 'Documentation', to: '/docs' },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 transition-all duration-300', scrolled ? 'border-b border-line bg-background/85 backdrop-blur-xl' : 'bg-transparent')}>
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8" aria-label="Primary">
        <Link to="/" aria-label="FLASHLIVE home"><Logo /></Link>
        <div className="hidden items-center gap-7 lg:flex">
          {links.map((link) => (
            <a key={link.label} href={link.to} className="relative text-sm font-medium text-muted transition-colors hover:text-ink after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-primary after:transition-all hover:after:w-full">
              {link.label}
            </a>
          ))}
        </div>
        <div className="hidden items-center gap-3 lg:flex">
          <Button variant="ghost" onClick={() => { window.location.href = '/login'; }} className="px-4">Sign In</Button>
          <Button onClick={() => { window.location.href = '/register'; }}>Get Started</Button>
        </div>
        <button className="rounded-lg border border-line p-2 text-ink lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="border-b border-line bg-background/95 px-5 pb-5 backdrop-blur-xl lg:hidden">
            <div className="flex flex-col gap-3 pt-2">
              {links.map((link) => <a key={link.label} href={link.to} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-hover hover:text-ink">{link.label}</a>)}
              <div className="mt-2 grid gap-2">
                <Button variant="secondary" onClick={() => { window.location.href = '/login'; }}>Sign In</Button>
                <Button onClick={() => { window.location.href = '/register'; }}>Get Started</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-surface/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-4 lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted">Deploy smarter. Build concurrently. Recover automatically.</p>
        </div>
        <div>
          <h3 className="mb-4 font-condensed text-lg uppercase text-ink">Product</h3>
          <div className="grid gap-2 text-sm text-muted">
            <a href="/#features" className="hover:text-primary">Features</a>
            <a href="/#how-it-works" className="hover:text-primary">How it works</a>
            <a href="/#architecture" className="hover:text-primary">Architecture</a>
            <Link to="/docs" className="hover:text-primary">Documentation</Link>
          </div>
        </div>
        <div>
          <h3 className="mb-4 font-condensed text-lg uppercase text-ink">Company</h3>
          <div className="grid gap-2 text-sm text-muted">
            <Link to="/contact" className="hover:text-primary">Contact</Link>
            <Link to="/privacy" className="hover:text-primary">Privacy</Link>
            <Link to="/terms" className="hover:text-primary">Terms</Link>
          </div>
        </div>
        <div>
          <h3 className="mb-4 font-condensed text-lg uppercase text-ink">Connect</h3>
          <div className="flex gap-3 text-muted">
            <a href="https://github.com" target="_blank" rel="noreferrer" aria-label="GitHub" className="rounded-lg border border-line p-2 hover:border-primary/50 hover:text-primary"><Github className="h-4 w-4" /></a>
            <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter" className="rounded-lg border border-line p-2 hover:border-primary/50 hover:text-primary"><Twitter className="h-4 w-4" /></a>
            <Link to="/contact" aria-label="Email" className="rounded-lg border border-line p-2 hover:border-primary/50 hover:text-primary"><Mail className="h-4 w-4" /></Link>
          </div>
        </div>
      </div>
      <div className="border-t border-line px-5 py-5 text-center font-mono text-xs text-muted">© {new Date().getFullYear()} FLASHLIVE. Built for developers.</div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background text-ink">
      <Navbar />
      <main className="pt-18"><Outlet /></main>
      <Footer />
    </div>
  );
}
