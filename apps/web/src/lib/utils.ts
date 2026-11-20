/**
 * FILE: apps/web/src/lib/utils.ts
 *
 * PURPOSE:
 * Provides small shared UI and formatting helpers.
 *
 * WHY THIS FILE EXISTS:
 * Avoids repeating class merging and user-facing value formatting.
 *
 * USED BY:
 * Components, pages and feature modules.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export function formatDuration(ms?: number | null) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

export function statusTone(status?: string) {
  switch (status) {
    case 'deployed': return 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10';
    case 'building': return 'text-primary border-primary/40 bg-primary/10';
    case 'queued': return 'text-amber-300 border-amber-400/30 bg-amber-400/10';
    case 'failed': return 'text-red-300 border-red-400/30 bg-red-400/10';
    case 'cancelled': return 'text-zinc-300 border-zinc-400/30 bg-zinc-400/10';
    default: return 'text-muted border-line bg-surface';
  }
}
