/**
 * FILE: apps/api/src/modules/queue/routes.ts
 *
 * PURPOSE:
 * Exposes read-only queue, worker and queue-statistics endpoints.
 *
 * WHY THIS FILE EXISTS:
 * The dashboard needs live PostgreSQL-backed queue state without exposing
 * worker control operations.
 *
 * HOW IT WORKS:
 * Returns QueueSnapshot for slots/queued jobs and worker rows for status UI.
 *
 * USED BY:
 * app.ts and frontend queue/analytics pages.
 *
 * SECURITY:
 * Requires Firebase auth; no worker mutation endpoints are public.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../common/errors.js';
import { getQueueSnapshot, getWorkers } from './service.js';

export const queueRouter = Router();

queueRouter.get('/queue', requireAuth, asyncHandler(async (_req, res) => {
  res.json(await getQueueSnapshot());
}));

queueRouter.get('/queue/statistics', requireAuth, asyncHandler(async (_req, res) => {
  const snapshot = await getQueueSnapshot();
  res.json({ statistics: snapshot.stats });
}));

queueRouter.get('/workers', requireAuth, asyncHandler(async (_req, res) => {
  res.json({ workers: await getWorkers() });
}));
