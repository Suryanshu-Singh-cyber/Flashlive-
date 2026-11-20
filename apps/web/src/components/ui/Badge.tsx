/**
 * FILE: apps/web/src/components/ui/Badge.tsx
 *
 * PURPOSE:
 * Small status badge used for deployment and worker states.
 *
 * USED BY:
 * Deployment, queue and dashboard pages.
 */

import type { HTMLAttributes } from 'react';
import { cn, statusTone } from '@/lib/utils';

export function Badge({ className, status, children, ...props }: HTMLAttributes<HTMLSpanElement> & { status?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]', statusTone(status), className)} {...props}>
      {children}
    </span>
  );
}
