/**
 * FILE: apps/api/src/modules/workers/routes.ts
 *
 * PURPOSE:
 * Provides authenticated machine-to-machine endpoints used by FLASHLIVE build
 * workers for logs, heartbeats, publish fencing and terminal completion.
 *
 * WHY THIS FILE EXISTS:
 * Workers must report progress and finalize deployments through the API so
 * lease/fencing checks, socket events and slot release happen transactionally.
 *
 * HOW IT WORKS:
 * Every endpoint validates the shared internal token and deployment lease
 * token before mutating state. Completion releases the worker slot atomically.
 *
 * USED BY:
 * apps/worker log shipper, heartbeat loop and docker runner.
 *
 * SECURITY:
 * Internal token plus per-deployment lease token are required. Expired leases
 * cannot publish artifacts or mark deployments complete.
 */

import { Router } from 'express';
import { z } from 'zod';
import { requireInternal } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ApiError } from '../../common/errors.js';
import { query, withTransaction } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { emitToDeployment, emitToUser } from '../../sockets/index.js';

export const workersRouter = Router();

const leaseSchema = z.object({ leaseToken: z.string().uuid() });
const logBatchSchema = leaseSchema.extend({
  logs: z.array(z.object({
    sequence: z.number().int().positive(),
    level: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']),
    message: z.string().min(1).max(8000),
  })).min(1).max(200),
});
const heartbeatSchema = leaseSchema.extend({ workerId: z.string().uuid().optional() });
const completeSchema = leaseSchema.extend({
  outcome: z.enum(['deployed', 'failed', 'cancelled']),
  errorMessage: z.string().max(4000).optional(),
  buildDurationMs: z.number().int().min(0).optional(),
});

async function getLeasedDeployment(deploymentId: string, leaseToken: string) {
  const result = await query<{ id: string; user_id: string; status: string; lease_token: string | null; attempt_count: number; cancel_requested_at: string | null }>(
    `SELECT id, user_id, status, lease_token, attempt_count, cancel_requested_at
     FROM deployments WHERE id = $1`,
    [deploymentId],
  );
  const deployment = result.rows[0];
  if (!deployment) throw new ApiError(404, 'DEPLOYMENT_NOT_FOUND', 'Deployment not found.');
  if (deployment.status !== 'building' || deployment.lease_token !== leaseToken) {
    throw new ApiError(409, 'LEASE_INVALID', 'Deployment lease is invalid or expired.');
  }
  return deployment;
}

workersRouter.post(
  '/internal/deployments/:deploymentId/logs',
  requireInternal,
  validate(logBatchSchema),
  asyncHandler(async (req, res) => {
    const deploymentId = String(req.params.deploymentId);
    const deployment = await getLeasedDeployment(deploymentId, req.body.leaseToken);
    for (const log of req.body.logs) {
      await query(
        `INSERT INTO deployment_logs(deployment_id, sequence, level, message)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (deployment_id, sequence) DO NOTHING`,
        [deploymentId, log.sequence, log.level, log.message],
      );
    }
    emitToDeployment(deploymentId, 'deployment:log', { deploymentId, logs: req.body.logs });
    emitToUser(deployment.user_id, 'deployment:log', { deploymentId, logs: req.body.logs });
    res.status(202).json({ accepted: req.body.logs.length });
  }),
);

workersRouter.post(
  '/internal/deployments/:deploymentId/heartbeat',
  requireInternal,
  validate(heartbeatSchema),
  asyncHandler(async (req, res) => {
    const deploymentId = String(req.params.deploymentId);
    const deployment = await getLeasedDeployment(deploymentId, req.body.leaseToken);
    await query('UPDATE deployments SET heartbeat_at = NOW() WHERE id = $1', [deploymentId]);
    if (req.body.workerId) {
      await query('UPDATE workers SET last_heartbeat_at = NOW(), updated_at = NOW() WHERE id = $1', [req.body.workerId]);
    }
    res.json({ ok: true, cancelRequested: Boolean(deployment.cancel_requested_at) });
  }),
);

workersRouter.post(
  '/internal/deployments/:deploymentId/prepare-success',
  requireInternal,
  validate(leaseSchema),
  asyncHandler(async (req, res) => {
    const deployment = await getLeasedDeployment(String(req.params.deploymentId), req.body.leaseToken);
    if (deployment.cancel_requested_at) {
      res.json({ ok: false, cancelled: true });
      return;
    }
    res.json({ ok: true, attemptCount: deployment.attempt_count });
  }),
);

workersRouter.post(
  '/internal/deployments/:deploymentId/complete',
  requireInternal,
  validate(completeSchema),
  asyncHandler(async (req, res) => {
    const deploymentId = String(req.params.deploymentId);
    const outcome = deploymentOutcome(req.body.outcome, req.body.errorMessage);

    const completed = await withTransaction(async (client) => {
      const result = await client.query<{
        id: string; user_id: string; project_id: string; slot_id: string | null;
        worker_id: string | null; status: string; lease_token: string | null;
        cancel_requested_at: string | null; started_at: string | null; queued_at: string | null;
      }>(
        `SELECT id, user_id, project_id, slot_id, worker_id, status, lease_token,
           cancel_requested_at, started_at, queued_at
         FROM deployments WHERE id = $1 FOR UPDATE`,
        [deploymentId],
      );
      const deployment = result.rows[0];
      if (!deployment) throw new ApiError(404, 'DEPLOYMENT_NOT_FOUND', 'Deployment not found.');
      if (deployment.status !== 'building' || deployment.lease_token !== req.body.leaseToken) {
        throw new ApiError(409, 'LEASE_INVALID', 'Deployment lease is invalid or expired.');
      }

      const finalStatus = deployment.cancel_requested_at ? 'cancelled' : outcome;
      const liveUrl = finalStatus === 'deployed' ? `${env.PUBLIC_SITE_URL}/sites/${deploymentId}/` : null;
      const duration = req.body.buildDurationMs ?? (
        deployment.started_at
          ? Math.max(0, Date.now() - new Date(deployment.started_at).getTime())
          : null
      );

      await client.query(
        `UPDATE deployments SET
           status = $2,
           finished_at = NOW(),
           error_message = $3,
           live_url = $4,
           build_duration_ms = COALESCE($5, build_duration_ms),
           queue_duration_ms = CASE WHEN started_at IS NOT NULL AND queued_at IS NOT NULL
             THEN FLOOR(EXTRACT(EPOCH FROM (started_at - queued_at)) * 1000)::bigint
             ELSE queue_duration_ms END
         WHERE id = $1`,
        [deploymentId, finalStatus, req.body.errorMessage ?? null, liveUrl, duration],
      );

      if (deployment.slot_id) {
        await client.query(
          `UPDATE worker_slots SET status = 'available', worker_id = NULL,
             deployment_id = NULL, lease_token = NULL, released_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND status = 'claimed'`,
          [deployment.slot_id],
        );
      }
      if (deployment.worker_id) {
        await client.query(
          `UPDATE workers SET active_deployment_id = NULL, active_slot_id = NULL, updated_at = NOW()
           WHERE id = $1`,
          [deployment.worker_id],
        );
      }
      if (finalStatus === 'deployed') {
        await client.query('UPDATE projects SET last_deployment_at = NOW(), updated_at = NOW() WHERE id = $1', [deployment.project_id]);
      }
      return { userId: deployment.user_id, status: finalStatus, liveUrl };
    });

    emitToDeployment(deploymentId, 'deployment:update', { deploymentId, status: completed.status, liveUrl: completed.liveUrl });
    emitToUser(completed.userId, 'deployment:update', { deploymentId, status: completed.status, liveUrl: completed.liveUrl });
    res.json({ ok: true, status: completed.status, liveUrl: completed.liveUrl });
  }),
);

function deploymentOutcome(outcome: 'deployed' | 'failed' | 'cancelled', errorMessage?: string) {
  if (outcome === 'failed' && !errorMessage) return 'failed';
  return outcome;
}
