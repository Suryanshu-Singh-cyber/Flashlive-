/**
 * FILE: apps/api/src/config/env.ts
 *
 * PURPOSE:
 * Loads and validates FLASHLIVE API environment configuration.
 *
 * WHY THIS FILE EXISTS:
 * Centralizes required runtime settings so modules fail fast with clear
 * configuration errors instead of undefined behavior.
 *
 * HOW IT WORKS:
 * Reads process.env, applies safe defaults, normalizes Firebase private-key
 * newlines, and exposes a typed immutable config object.
 *
 * USED BY:
 * server.ts, database pool, auth, GitHub OAuth, Socket.IO and internal routes.
 *
 * SECURITY:
 * Secrets are read only from environment variables and are never logged.
 */

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  PUBLIC_SITE_URL: z.string().url().default('http://localhost:8080'),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  INTERNAL_API_TOKEN: z.string().min(32),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),
  FLASHLIVE_BUILD_SLOTS: z.coerce.number().int().min(1).max(20).default(3),
  FLASHLIVE_ARTIFACT_DIR: z.string().min(1).default('../worker/artifacts'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid API environment configuration: ${issues}`);
}

const raw = parsed.data;

function normalizePrivateKey(value: string | undefined): string | undefined {
  return value?.replace(/\\n/g, '\n');
}

export const env = {
  ...raw,
  FIREBASE_PRIVATE_KEY: normalizePrivateKey(raw.FIREBASE_PRIVATE_KEY),
} as const;

export const isFirebaseConfigured = Boolean(
  env.FIREBASE_SERVICE_ACCOUNT_JSON || (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY),
);

export const isGitHubConfigured = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_CALLBACK_URL);
