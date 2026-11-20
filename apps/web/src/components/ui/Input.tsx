/**
 * FILE: apps/web/src/components/ui/Input.tsx
 *
 * PURPOSE:
 * Styled form input with label, error and icon support.
 *
 * USED BY:
 * Auth forms, project settings and environment variable editors.
 */

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, icon, id, ...props },
  ref,
) {
  const inputId = id ?? props.name ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</span>}
      <span className="relative block">
        {icon && <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">{icon}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink transition-colors placeholder:text-muted/60',
            'focus:border-primary/70 focus:outline-none focus:ring-2 focus:ring-primary/15',
            icon && 'pl-11',
            error && 'border-red-400/60',
            className,
          )}
          {...props}
        />
      </span>
      {error && <span className="mt-2 block text-xs text-red-300">{error}</span>}
    </label>
  );
});
