/**
 * FILE: apps/web/postcss.config.js
 *
 * PURPOSE:
 * Wires Tailwind CSS and Autoprefixer into the Vite CSS pipeline.
 *
 * WHY THIS FILE EXISTS:
 * Vite requires PostCSS configuration to process Tailwind utilities.
 *
 * USED BY:
 * apps/web/src/styles/index.css during dev and production builds.
 */

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
