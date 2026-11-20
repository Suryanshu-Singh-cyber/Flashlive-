/**
 * FILE: apps/web/src/layouts/DashboardLayout.tsx
 *
 * PURPOSE:
 * Authenticated application shell with sidebar navigation and user controls.
 *
 * WHY THIS FILE EXISTS:
 * Separates developer dashboard UX from public marketing pages.
 *
 * USED BY:
 * Protected routes in router.tsx.
 */

import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, FolderGit2, Rocket, ListOrdered, BarChart3, Settings, UserCircle, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderGit2 },
  { to: '/deployments', label: 'Deployments', icon: Rocket },
  { to: '/queue', label: 'Build Queue', icon: ListOrdered },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/profile', label: 'Profile', icon: UserCircle },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-18 items-center border-b border-line px-5"><Link to="/dashboard" onClick={onNavigate}><Logo compact className="[&_span:last-child]:hidden" /></Link></div>
      <nav className="flex-1 space-y-1 overflow-auto p-4">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end ?? false} onClick={onNavigate} className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors', isActive ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-surface-hover hover:text-ink')}>
            <Icon className="h-4 w-4" />{label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-line p-4">
        <div className="mb-3 truncate text-sm text-muted">{user?.displayName ?? user?.email}</div>
        <Button variant="secondary" className="w-full justify-start" onClick={async () => { await logout(); navigate('/login'); }}>
          <LogOut className="h-4 w-4" />Sign out
        </Button>
      </div>
    </div>
  );
}

export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-ink">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-surface/70 backdrop-blur-xl lg:block"><SidebarContent /></aside>
      <div className="lg:pl-64">
        <div className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-background/85 px-5 backdrop-blur-xl lg:hidden">
          <Logo compact />
          <button className="rounded-lg border border-line p-2" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></button>
        </div>
        <main className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8"><Outlet /></main>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-black/60 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.aside className="h-full w-72 border-r border-line bg-surface" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} onClick={(e) => e.stopPropagation()}>
              <button className="absolute right-4 top-4 rounded-lg border border-line p-2" onClick={() => setOpen(false)} aria-label="Close navigation"><X className="h-4 w-4" /></button>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
