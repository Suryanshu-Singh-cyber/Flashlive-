/**
 * FILE: apps/worker/src/config/env.ts
 *
 * PURPOSE:
 * Loads and validates FLASHLIVE worker environment configuration.
 *
 * WHY THIS FILE EXISTS:
 * Worker processes need database, API callback, Docker and recovery settings
 * without hardcoded values.
 *
 * HOW IT WORKS:
 * Parses process.env with safe defaults for local development.
 *
 * USED BY:
 * Worker scheduler, Docker runner, recovery reaper and log shipper.
 *
 * SECURITY:
 * Secrets are environment-only and never logged.
 */

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  API_INTERNAL_URL: z.string().url().default('http://localhost:4000'),
  INTERNAL_API_TOKEN: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  FLASHLIVE_WORKER_NAME: z.string().min(1).default('worker-local'),
  FLASHLIVE_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),
  FLASHLIVE_BUILD_SLOTS: z.coerce.number().int().min(1).max(20).default(3),
  FLASHLIVE_ARTIFACT_DIR: z.string().min(1).default('./artifacts'),
  FLASHLIVE_WORKSPACE_DIR: z.string().min(1).default('./workspaces'),
  FLASHLIVE_DOCKER_IMAGE: z.string().min(1).default('node:20-alpine'),
  FLASHLIVE_BUILD_TIMEOUT_MS: z.coerce.number().int().min(1000).default(300000),
  FLASHLIVE_BUILD_MEMORY_MB: z.coerce.number().int().min(256).max(16384).default(2048),
  FLASHLIVE_NPM_CACHE_DIR: z.string().min(1).default('./.npm-cache'),
  FLASHLIVE_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).default(10000),
  FLASHLIVE_LEASE_DURATION_MS: z.coerce.number().int().min(5000).default(45000),
  FLASHLIVE_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(2000),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid worker environment configuration: ${issues}`);
}

export const env = parsed.data;
