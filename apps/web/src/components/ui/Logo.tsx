/**
 * FILE: apps/web/src/components/ui/Logo.tsx
 *
 * PURPOSE:
 * FLASHLIVE brand mark and wordmark.
 *
 * USED BY:
 * Navbar, auth pages, loading states and footer.
 */

import { cn } from '@/lib/utils';
import { Zap } from 'lucide-react';

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-black shadow-glow">
        <Zap className="h-5 w-5" fill="currentColor" />
      </span>
      {!compact && (
        <span className="font-display text-2xl tracking-[0.08em] text-ink">
          FLASH<span className="text-primary">LIVE</span>
        </span>
      )}
    </span>
  );
}
