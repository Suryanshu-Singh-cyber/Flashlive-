/**
 * FILE: apps/api/src/modules/deployments/routes.ts
 *
 * PURPOSE:
 * Exposes deployment creation, listing, detail, cancellation, redeploy and
 * persisted log endpoints.
 *
 * WHY THIS FILE EXISTS:
 * Separates deployment HTTP routing from queue/service logic.
 *
 * HOW IT WORKS:
 * Mounts both /projects/:projectId/deployments and /deployments/* routes.
 * Every route requires Firebase auth and verifies ownership in the service.
 *
 * USED BY:
 * app.ts and frontend deployment pages.
 *
 * SECURITY:
 * Users can only access deployments they own; logs are ownership-checked.
 */

import { Router } from 'express';
import { deployProjectSchema } from '@flashlive/shared';
import type { DeploymentStatus } from '@flashlive/shared';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../common/errors.js';
import {
  cancelDeployment,
  enqueueDeployment,
  getDeploymentLogs,
  getOwnedDeployment,
  listDeployments,
  redeployDeployment,
} from './service.js';

export const deploymentsRouter = Router();

deploymentsRouter.post(
  '/projects/:projectId/deployments',
  requireAuth,
  validate(deployProjectSchema),
  asyncHandler(async (req, res) => {
    const deployment = await enqueueDeployment(req.user!.id, String(req.params.projectId), req.body);
    res.status(201).json({ deployment });
  }),
);

deploymentsRouter.get(
  '/deployments',
  requireAuth,
  asyncHandler(async (req, res) => {
    const filters: { projectId?: string; status?: DeploymentStatus; limit?: number } = {};
    if (typeof req.query.projectId === 'string') filters.projectId = req.query.projectId;
    if (typeof req.query.status === 'string') filters.status = req.query.status as DeploymentStatus;
    if (typeof req.query.limit === 'string') filters.limit = Number(req.query.limit);
    res.json({ deployments: await listDeployments(req.user!.id, filters) });
  }),
);

deploymentsRouter.get(
  '/deployments/:deploymentId',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ deployment: await getOwnedDeployment(req.user!.id, String(req.params.deploymentId)) });
  }),
);

deploymentsRouter.post(
  '/deployments/:deploymentId/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ deployment: await cancelDeployment(req.user!.id, String(req.params.deploymentId)) });
  }),
);

deploymentsRouter.post(
  '/deployments/:deploymentId/redeploy',
  requireAuth,
  asyncHandler(async (req, res) => {
    const deployment = await redeployDeployment(req.user!.id, String(req.params.deploymentId));
    res.status(201).json({ deployment });
  }),
);

deploymentsRouter.get(
  '/deployments/:deploymentId/logs',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ logs: await getDeploymentLogs(req.user!.id, String(req.params.deploymentId)) });
  }),
);

