/**
 * FILE: apps/web/src/components/ui/Spinner.tsx
 *
 * PURPOSE:
 * FLASHLIVE loading spinner and skeleton primitives.
 *
 * USED BY:
 * Buttons, pages and async states.
 */

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-primary', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-elevated', className)} />;
}
