/**
 * FILE: apps/worker/src/queue/slotAllocator.ts
 *
 * PURPOSE:
 * Transactionally claims available worker slots and queued deployments.
 *
 * WHY THIS FILE EXISTS:
 * PostgreSQL must enforce global build capacity and single ownership. This
 * module implements the slot+job claim invariant in one short transaction.
 *
 * HOW IT WORKS:
 * Locks one available slot with FOR UPDATE SKIP LOCKED, selects the fairest
 * queued deployment, marks it building with a lease token, and claims the slot.
 * Database locks are released before Docker execution begins.
 *
 * USED BY:
 * scheduler/workerLoop.ts.
 *
 * SECURITY:
 * Uses SKIP LOCKED and unique indexes to prevent duplicate ownership and
 * per-user build monopolization.
 */

import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { query, withTransaction } from '../db/pool.js';
import { env } from '../config/env.js';

export interface ClaimedDeployment {
  id: string;
  userId: string;
  projectId: string;
  status: string;
  workerId: string;
  slotId: string;
  leaseToken: string;
  attemptCount: number;
  commitSha: string | null;
  branch: string;
  repositoryFullName: string;
  projectName: string;
}

export async function ensureWorkerSlots(count = env.FLASHLIVE_BUILD_SLOTS): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await query(
      `INSERT INTO worker_slots(slot_index, status)
       VALUES ($1, 'available')
       ON CONFLICT (slot_index) DO NOTHING`,
      [index],
    );
  }
}

export async function registerWorker(workerName: string): Promise<{ id: string; leaseToken: string }> {
  const leaseToken = randomUUID();
  const result = await query<{ id: string }>(
    `INSERT INTO workers(id, name, status, hostname, version, started_at, last_heartbeat_at)
     VALUES ($1, $2, 'online', $3, $4, NOW(), NOW())
     ON CONFLICT (name) DO UPDATE SET
       status = 'online',
       hostname = EXCLUDED.hostname,
       version = EXCLUDED.version,
       started_at = NOW(),
       last_heartbeat_at = NOW(),
       updated_at = NOW()
     RETURNING id`,
    [randomUUID(), workerName, process.env.HOSTNAME ?? 'localhost', process.env.npm_package_version ?? '0.1.0'],
  );
  return { id: result.rows[0]!.id, leaseToken };
}

export async function claimNextDeployment(workerId: string): Promise<ClaimedDeployment | null> {
  const leaseToken = randomUUID();
  return withTransaction(async (client: pg.PoolClient) => {
    const slotResult = await client.query<{ id: string }>(
      `SELECT id FROM worker_slots
       WHERE status = 'available'
       ORDER BY slot_index ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
    );
    const slot = slotResult.rows[0];
    if (!slot) return null;

    const candidateResult = await client.query<{ id: string }>(
      `WITH user_last AS (
         SELECT user_id, MAX(COALESCE(finished_at, started_at, created_at)) AS last_served_at
         FROM deployments
         WHERE status IN ('building', 'deployed', 'failed', 'cancelled')
         GROUP BY user_id
       )
       SELECT d.id
       FROM deployments d
       LEFT JOIN user_last ul ON ul.user_id = d.user_id
       WHERE d.status = 'queued'
         AND NOT EXISTS (
           SELECT 1 FROM deployments active
           WHERE active.user_id = d.user_id AND active.status = 'building'
         )
       ORDER BY ul.last_served_at ASC NULLS FIRST, d.created_at ASC, d.id ASC
       LIMIT 1
       FOR UPDATE OF d SKIP LOCKED`,
    );
    const candidate = candidateResult.rows[0];
    if (!candidate) return null;

    const deploymentResult = await client.query<ClaimedDeployment>(
      `UPDATE deployments
       SET status = 'building', worker_id = $1, slot_id = $2, lease_token = $3,
         started_at = NOW(), heartbeat_at = NOW(), attempt_count = attempt_count + 1,
         queued_at = COALESCE(queued_at, created_at)
       WHERE id = $4 AND status = 'queued'
       RETURNING id, user_id AS "userId", project_id AS "projectId", status,
         worker_id AS "workerId", slot_id AS "slotId", lease_token AS "leaseToken",
         attempt_count AS "attemptCount", commit_sha AS "commitSha", branch,
         repository_full_name AS "repositoryFullName", project_name AS "projectName"`,
      [workerId, slot.id, leaseToken, candidate.id],
    );
    const deployment = deploymentResult.rows[0];
    if (!deployment) throw new Error('Claimed deployment changed before update.');

    await client.query(
      `UPDATE worker_slots SET status = 'claimed', worker_id = $1,
         deployment_id = $2, lease_token = $3, claimed_at = NOW(), released_at = NULL,
         updated_at = NOW()
       WHERE id = $4 AND status = 'available'`,
      [workerId, deployment.id, leaseToken, slot.id],
    );
    await client.query(
      `UPDATE workers SET active_deployment_id = $1, active_slot_id = $2,
         last_heartbeat_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [deployment.id, slot.id, workerId],
    );

    return deployment;
  });
}
