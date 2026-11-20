/**
 * FILE: apps/web/tailwind.config.js
 *
 * PURPOSE:
 * Defines FLASHLIVE design tokens and Tailwind utility mapping.
 *
 * WHY THIS FILE EXISTS:
 * Keeps colors, fonts, radii and shadows consistent across the premium dark UI.
 *
 * HOW IT WORKS:
 * Exposes CSS-variable-backed colors plus font families and animation helpers.
 *
 * USED BY:
 * apps/web/src/styles/index.css and all React components.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        elevated: 'var(--surface-elevated)',
        hover: 'var(--surface-hover)',
        primary: 'var(--primary)',
        'primary-glow': 'var(--primary-glow)',
        secondary: 'var(--secondary)',
        ink: 'var(--text-primary)',
        muted: 'var(--text-secondary)',
        line: 'var(--border)',
      },
      fontFamily: {
        sans: ['Barlow', 'Inter', 'system-ui', 'sans-serif'],
        condensed: ['Barlow Condensed', 'Arial Narrow', 'sans-serif'],
        mono: ['Space Mono', 'IBM Plex Mono', 'monospace'],
        display: ['Bebas Neue', 'Barlow Condensed', 'sans-serif'],
      },
      borderRadius: {
        card: '1rem',
      },
      boxShadow: {
        glow: '0 0 24px rgba(232, 255, 0, 0.22)',
        card: '0 18px 50px rgba(0, 0, 0, 0.35)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        pulseGlow: 'pulseGlow 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
