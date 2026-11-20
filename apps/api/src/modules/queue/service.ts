/**
 * FILE: apps/api/src/modules/queue/service.ts
 *
 * PURPOSE:
 * Reads PostgreSQL worker slots, active deployments and queued jobs for the
 * queue monitoring UI.
 *
 * WHY THIS FILE EXISTS:
 * The queue visualization must reflect real database state rather than static
 * mock workers.
 *
 * HOW IT WORKS:
 * Joins worker_slots to workers and deployments, then computes aggregate slot,
 * worker and queue statistics.
 *
 * USED BY:
 * queue/routes.ts and analytics worker utilization.
 *
 * SECURITY:
 * Read-only endpoint requires authentication; it does not expose tokens or
 * secrets.
 */

import type { Deployment, QueueSnapshot, Worker, WorkerSlot } from '@flashlive/shared';
import { query } from '../../db/pool.js';

interface SlotRow extends WorkerSlot {
  worker: Worker | null;
  deployment: Deployment | null;
}

export async function getQueueSnapshot(): Promise<QueueSnapshot> {
  const slotsResult = await query<SlotRow>(
    `SELECT s.id, s.slot_index AS "slotIndex", s.status, s.worker_id AS "workerId",
       s.deployment_id AS "deploymentId", s.lease_token AS "leaseToken",
       s.claimed_at AS "claimedAt", s.released_at AS "releasedAt",
       s.created_at AS "createdAt", s.updated_at AS "updatedAt",
       CASE WHEN w.id IS NULL THEN NULL ELSE jsonb_build_object(
         'id', w.id, 'name', w.name, 'status', w.status, 'hostname', w.hostname,
         'version', w.version, 'startedAt', w.started_at,
         'lastHeartbeatAt', w.last_heartbeat_at,
         'activeDeploymentId', w.active_deployment_id, 'activeSlotId', w.active_slot_id,
         'createdAt', w.created_at, 'updatedAt', w.updated_at
       ) END AS worker,
       CASE WHEN d.id IS NULL THEN NULL ELSE jsonb_build_object(
         'id', d.id, 'projectId', d.project_id, 'status', d.status,
         'commitSha', d.commit_sha, 'liveUrl', d.live_url, 'errorMessage', d.error_message,
         'createdAt', d.created_at, 'finishedAt', d.finished_at,
         'buildDurationMs', d.build_duration_ms
       ) END AS deployment
     FROM worker_slots s
     LEFT JOIN workers w ON w.id = s.worker_id
     LEFT JOIN deployments d ON d.id = s.deployment_id
     ORDER BY s.slot_index ASC`,
  );

  const queuedResult = await query<Deployment>(
    `SELECT d.id, d.user_id AS "userId", d.project_id AS "projectId", d.status,
       d.worker_id AS "workerId", d.slot_id AS "slotId", d.lease_token AS "leaseToken",
       d.attempt_count AS "attemptCount", d.commit_sha AS "commitSha", d.branch,
       d.repository_full_name AS "repositoryFullName", d.project_name AS "projectName",
       d.error_message AS "errorMessage", d.live_url AS "liveUrl",
       d.created_at AS "createdAt", d.queued_at AS "queuedAt", d.started_at AS "startedAt",
       d.heartbeat_at AS "heartbeatAt", d.cancel_requested_at AS "cancelRequestedAt",
       d.finished_at AS "finishedAt", d.build_duration_ms AS "buildDurationMs",
       FLOOR(EXTRACT(EPOCH FROM (COALESCE(d.started_at, NOW()) - COALESCE(d.queued_at, d.created_at))) * 1000)::bigint AS "queueDurationMs"
     FROM deployments d
     WHERE d.status = 'queued'
     ORDER BY d.created_at ASC, d.id ASC
     LIMIT 100`,
  );

  const statsResult = await query<{ active_builds: string; queued_builds: string; online_workers: string; stale_workers: string; slot_count: string }>(
    `SELECT
       (SELECT COUNT(*) FROM worker_slots WHERE status = 'claimed')::text AS active_builds,
       (SELECT COUNT(*) FROM deployments WHERE status = 'queued')::text AS queued_builds,
       (SELECT COUNT(*) FROM workers WHERE status = 'online')::text AS online_workers,
       (SELECT COUNT(*) FROM workers WHERE status = 'stale')::text AS stale_workers,
       (SELECT COUNT(*) FROM worker_slots)::text AS slot_count`,
  );
  const stats = statsResult.rows[0]!;

  return {
    slots: slotsResult.rows,
    queued: queuedResult.rows,
    stats: {
      slotCount: Number(stats.slot_count),
      activeBuilds: Number(stats.active_builds),
      queuedBuilds: Number(stats.queued_builds),
      onlineWorkers: Number(stats.online_workers),
      staleWorkers: Number(stats.stale_workers),
    },
  };
}

export async function getWorkers(): Promise<Worker[]> {
  const result = await query<Worker>(
    `SELECT id, name, status, hostname, version, started_at AS "startedAt",
       last_heartbeat_at AS "lastHeartbeatAt", active_deployment_id AS "activeDeploymentId",
       active_slot_id AS "activeSlotId", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM workers ORDER BY name ASC`,
  );
  return result.rows;
}
