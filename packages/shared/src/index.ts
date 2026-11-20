/**
 * FILE: packages/shared/src/index.ts
 *
 * PURPOSE:
 * Public entrypoint for FLASHLIVE shared contracts used by the web app,
 * API and worker.
 *
 * WHY THIS FILE EXISTS:
 * Keeps status values, validation schemas and API-facing types consistent
 * across independently deployed services.
 *
 * HOW IT WORKS:
 * Re-exports type, schema and constant modules through stable package paths.
 *
 * USED BY:
 * apps/web, apps/api and apps/worker.
 */

export * from './types/index.js';
export * from './constants/index.js';
export * from './schemas/index.js';
