/**
 * FILE: apps/web/src/components/ui/Card.tsx
 *
 * PURPOSE:
 * Surface card primitive for dashboard and marketing sections.
 *
 * USED BY:
 * Pages and feature cards.
 */

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('surface p-5', className)} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-4 flex items-start justify-between gap-4', className)} {...props} />;
}
