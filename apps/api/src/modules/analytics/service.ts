/**
 * FILE: apps/api/src/modules/analytics/service.ts
 *
 * PURPOSE:
 * Computes deployment analytics from real PostgreSQL records.
 *
 * WHY THIS FILE EXISTS:
 * Dashboard charts must be derived from actual deployments, workers and
 * recovery events rather than fabricated values.
 *
 * HOW IT WORKS:
 * Aggregates user-scoped deployment counts, durations, daily buckets and
 * worker utilization with SQL.
 *
 * USED BY:
 * analytics/routes.ts and dashboard overview cards/charts.
 *
 * SECURITY:
 * Deployment metrics are scoped to req.user.id; worker metrics are aggregate.
 */

import type { AnalyticsOverview, DailyDeploymentPoint, DeploymentAnalytics, Worker } from '@flashlive/shared';
import { query } from '../../db/pool.js';

export async function getDeploymentAnalytics(userId: string, days: number): Promise<DeploymentAnalytics> {
  const overviewResult = await query<{
    total: string; successful: string; failed: string; cancelled: string;
    active: string; queued: string; avg_build: string | null; avg_queue: string | null;
    recovery_events: string;
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE status = 'deployed')::text AS successful,
       COUNT(*) FILTER (WHERE status = 'failed')::text AS failed,
       COUNT(*) FILTER (WHERE status = 'cancelled')::text AS cancelled,
       COUNT(*) FILTER (WHERE status IN ('queued', 'building'))::text AS active,
       COUNT(*) FILTER (WHERE status = 'queued')::text AS queued,
       AVG(build_duration_ms) FILTER (WHERE build_duration_ms IS NOT NULL)::text AS avg_build,
       AVG(queue_duration_ms) FILTER (WHERE queue_duration_ms IS NOT NULL)::text AS avg_queue,
       (SELECT COUNT(*) FROM recovery_events)::text AS recovery_events
     FROM deployments
     WHERE user_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval`,
    [userId, String(days)],
  );

  const row = overviewResult.rows[0]!;
  const total = Number(row.total);
  const successful = Number(row.successful);
  const failed = Number(row.failed);
  const cancelled = Number(row.cancelled);
  const active = Number(row.active);
  const queued = Number(row.queued);

  const dailyResult = await query<DailyDeploymentPoint>(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'deployed')::int AS successful,
       COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
     FROM deployments
     WHERE user_id = $1 AND created_at >= NOW() - ($2 || ' days')::interval
     GROUP BY date_trunc('day', created_at)
     ORDER BY date_trunc('day', created_at) ASC`,
    [userId, String(days)],
  );

  const workersResult = await query<Worker & { activeBuilds: number; completedBuilds: number }>(
    `SELECT w.id, w.name, w.status, w.hostname, w.version, w.started_at AS "startedAt",
       w.last_heartbeat_at AS "lastHeartbeatAt", w.active_deployment_id AS "activeDeploymentId",
       w.active_slot_id AS "activeSlotId", w.created_at AS "createdAt", w.updated_at AS "updatedAt",
       COUNT(d.id) FILTER (WHERE d.status = 'building')::int AS "activeBuilds",
       COUNT(d.id) FILTER (WHERE d.status IN ('deployed', 'failed', 'cancelled'))::int AS "completedBuilds"
     FROM workers w
     LEFT JOIN deployments d ON d.worker_id = w.id
     GROUP BY w.id
     ORDER BY w.name ASC`,
  );

  const overview: AnalyticsOverview = {
    totalDeployments: total,
    successfulDeployments: successful,
    failedDeployments: failed,
    cancelledDeployments: cancelled,
    activeDeployments: active,
    queuedDeployments: queued,
    successRate: total > 0 ? successful / total : 0,
    averageBuildDurationMs: row.avg_build ? Number(row.avg_build) : null,
    averageQueueDurationMs: row.avg_queue ? Number(row.avg_queue) : null,
    recoveryEvents: Number(row.recovery_events),
    workerUtilization: 0,
  };

  const slotStats = await query<{ claimed: string; total: string }>(
    `SELECT COUNT(*) FILTER (WHERE status = 'claimed')::text AS claimed,
       COUNT(*)::text AS total FROM worker_slots`,
  );
  overview.workerUtilization = Number(slotStats.rows[0]?.total ?? 0) > 0
    ? Number(slotStats.rows[0]?.claimed ?? 0) / Number(slotStats.rows[0]?.total)
    : 0;

  return { overview, daily: dailyResult.rows, workers: workersResult.rows };
}
