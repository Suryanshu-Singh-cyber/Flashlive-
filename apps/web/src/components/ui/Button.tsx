/**
 * FILE: apps/web/src/components/ui/Button.tsx
 *
 * PURPOSE:
 * Reusable FLASHLIVE button with loading, disabled and visual variants.
 *
 * USED BY:
 * Landing, auth and dashboard pages.
 */

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', loading, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-condensed text-sm font-semibold uppercase tracking-[0.14em] transition-all duration-200',
        'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]',
        variant === 'primary' && 'bg-primary text-black hover:shadow-glow hover:brightness-110',
        variant === 'secondary' && 'border border-line bg-surface text-ink hover:border-primary/50 hover:text-primary',
        variant === 'ghost' && 'text-muted hover:bg-surface-hover hover:text-ink',
        variant === 'danger' && 'border border-red-400/30 bg-red-400/10 text-red-200 hover:bg-red-400/20',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
