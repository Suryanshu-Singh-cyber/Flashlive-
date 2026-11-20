/**
 * FILE: apps/web/src/components/animations/Reveal.tsx
 *
 * PURPOSE:
 * Scroll-triggered reveal wrapper built with Framer Motion.
 *
 * WHY THIS FILE EXISTS:
 * Provides consistent cinematic section entrances without hijacking scroll.
 *
 * USED BY:
 * Landing, dashboard and auth layouts.
 */

import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

interface RevealProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  delay?: number;
}

export function Reveal({ children, delay = 0, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.55 } } }}
    >
      {children}
    </motion.div>
  );
}

export function TextReveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <span className={className} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom' }}>
      <motion.span
        className="inline-block"
        initial={{ y: '110%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.span>
    </span>
  );
}

export function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: ReactNode; description?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-3xl text-center">
      <Reveal>
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.28em] text-primary">{eyebrow}</p>
        <h2 className="font-condensed text-4xl font-bold uppercase leading-none text-ink md:text-5xl">{title}</h2>
        {description && <p className="mt-4 text-muted">{description}</p>}
      </Reveal>
    </div>
  );
}
