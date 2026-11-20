/**
 * FILE: apps/worker/src/recovery/reaper.ts
 *
 * PURPOSE:
 * Detects stale worker leases and safely recovers interrupted deployments.
 *
 * WHY THIS FILE EXISTS:
 * Workers can crash after claiming a slot. The reaper enforces lease expiry,
 * releases slots and requeues or fails deployments without double ownership.
 *
 * HOW IT WORKS:
 * Periodically scans building deployments whose heartbeat is older than the
 * lease duration, verifies slot ownership, invalidates the old lease, releases
 * the slot, retries within MAX_ATTEMPT_COUNT, and records recovery events.
 *
 * USED BY:
 * main.ts alongside the worker pool.
 *
 * SECURITY:
 * Uses row locks and lease/slot verification so an old worker cannot publish
 * after recovery.
 */

import { MAX_ATTEMPT_COUNT } from '@flashlive/shared';
import { query, withTransaction } from '../db/pool.js';
import { env } from '../config/env.js';

const SCAN_INTERVAL_MS = 15_000;

async function recoverStaleDeployments() {
  const stale = await query<{ id: string }>(
    `SELECT id FROM deployments
     WHERE status = 'building'
       AND heartbeat_at IS NOT NULL
       AND heartbeat_at < NOW() - ($1 || ' milliseconds')::interval
     ORDER BY heartbeat_at ASC
     LIMIT 20`,
    [String(env.FLASHLIVE_LEASE_DURATION_MS)],
  );

  for (const row of stale.rows) {
    try {
      await withTransaction(async (client) => {
        const deploymentResult = await client.query<{
          id: string; user_id: string; project_id: string; slot_id: string | null;
          worker_id: string | null; lease_token: string | null; attempt_count: number;
          cancel_requested_at: string | null;
        }>(
          `SELECT id, user_id, project_id, slot_id, worker_id, lease_token,
             attempt_count, cancel_requested_at
           FROM deployments WHERE id = $1 AND status = 'building'
           FOR UPDATE SKIP LOCKED`,
          [row.id],
        );
        const deployment = deploymentResult.rows[0];
        if (!deployment) return;

        const slotResult = deployment.slot_id
          ? await client.query<{ id: string; deployment_id: string | null; lease_token: string | null }>(
              `SELECT id, deployment_id, lease_token FROM worker_slots WHERE id = $1 FOR UPDATE`,
              [deployment.slot_id],
            )
          : { rows: [] };
        const slot = slotResult.rows[0];

        const shouldRetry = !deployment.cancel_requested_at && deployment.attempt_count < MAX_ATTEMPT_COUNT;
        const nextStatus = deployment.cancel_requested_at ? 'cancelled' : shouldRetry ? 'queued' : 'failed';
        const errorMessage = deployment.cancel_requested_at
          ? 'Deployment cancelled.'
          : shouldRetry
            ? 'Worker lease expired; deployment requeued.'
            : 'Worker lease expired; retry limit reached.';

        await client.query(
          `UPDATE deployments SET
             status = $2,
             queued_at = CASE WHEN $2 = 'queued' THEN NOW() ELSE queued_at END,
             started_at = CASE WHEN $2 = 'queued' THEN NULL ELSE started_at END,
             heartbeat_at = CASE WHEN $2 = 'queued' THEN NULL ELSE heartbeat_at END,
             worker_id = CASE WHEN $2 = 'queued' THEN NULL ELSE worker_id END,
             slot_id = CASE WHEN $2 = 'queued' THEN NULL ELSE slot_id END,
             lease_token = NULL,
             finished_at = CASE WHEN $2 = 'queued' THEN NULL ELSE NOW() END,
             error_message = CASE WHEN $2 = 'queued' THEN NULL ELSE $3 END
           WHERE id = $1`,
          [deployment.id, nextStatus, errorMessage],
        );

        if (slot && slot.deployment_id === deployment.id) {
          await client.query(
            `UPDATE worker_slots SET status = 'available', worker_id = NULL,
               deployment_id = NULL, lease_token = NULL, released_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [slot.id],
          );
        }
        if (deployment.worker_id) {
          await client.query(
            `UPDATE workers SET active_deployment_id = NULL, active_slot_id = NULL,
               status = 'stale', updated_at = NOW()
             WHERE id = $1`,
            [deployment.worker_id],
          );
        }
        await client.query(
          `INSERT INTO recovery_events(worker_id, deployment_id, slot_id, reason, action, metadata)
           VALUES ($1, $2, $3, 'worker_lease_expired', $4, $5::jsonb)`,
          [
            deployment.worker_id,
            deployment.id,
            deployment.slot_id,
            nextStatus === 'queued' ? 'requeued' : nextStatus,
            JSON.stringify({ attemptCount: deployment.attempt_count, maxAttempts: MAX_ATTEMPT_COUNT }),
          ],
        );
      });
    } catch (error) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Recovery failed for deployment',
        deploymentId: row.id,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  await query(
    `UPDATE workers SET status = 'stale', updated_at = NOW()
     WHERE status = 'online'
       AND (last_heartbeat_at IS NULL OR last_heartbeat_at < NOW() - ($1 || ' milliseconds')::interval)`,
    [String(env.FLASHLIVE_LEASE_DURATION_MS)],
  );
}

export function startReaper(): NodeJS.Timeout {
  const timer = setInterval(() => {
    void recoverStaleDeployments().catch((error) => {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Recovery scan failed',
        error: error instanceof Error ? error.message : String(error),
      }));
    });
  }, SCAN_INTERVAL_MS);
  timer.unref();
  void recoverStaleDeployments();
  return timer;
}
