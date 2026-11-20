/**
 * FILE: apps/worker/src/api/client.ts
 *
 * PURPOSE:
 * Calls FLASHLIVE API internal endpoints for heartbeats, publish fencing and
 * terminal deployment completion.
 *
 * WHY THIS FILE EXISTS:
 * Centralizes server-to-server HTTP calls and shared internal authentication.
 *
 * HOW IT WORKS:
 * Sends JSON POST requests with x-internal-token and lease tokens, and maps
 * non-2xx responses to errors.
 *
 * USED BY:
 * Docker runner, worker scheduler and recovery tests.
 *
 * SECURITY:
 * Uses INTERNAL_API_TOKEN and per-deployment lease tokens; no user tokens.
 */

import { env } from '../config/env.js';

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${env.API_INTERNAL_URL}/api${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': env.INTERNAL_API_TOKEN,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload?.error?.message ?? `API request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

export async function heartbeat(deploymentId: string, leaseToken: string, workerId: string): Promise<{ ok: boolean; cancelRequested: boolean }> {
  return post(`/internal/deployments/${deploymentId}/heartbeat`, { leaseToken, workerId });
}

export async function prepareSuccess(deploymentId: string, leaseToken: string): Promise<{ ok: boolean; cancelled?: boolean; attemptCount?: number }> {
  return post(`/internal/deployments/${deploymentId}/prepare-success`, { leaseToken });
}

export async function completeDeployment(
  deploymentId: string,
  leaseToken: string,
  outcome: 'deployed' | 'failed' | 'cancelled',
  errorMessage?: string,
  buildDurationMs?: number,
): Promise<{ ok: boolean; status: string; liveUrl: string | null }> {
  return post(`/internal/deployments/${deploymentId}/complete`, {
    leaseToken,
    outcome,
    ...(errorMessage ? { errorMessage } : {}),
    ...(buildDurationMs !== undefined ? { buildDurationMs } : {}),
  });
}
