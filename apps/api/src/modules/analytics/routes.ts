/**
 * FILE: apps/api/src/modules/analytics/routes.ts
 *
 * PURPOSE:
 * Exposes deployment analytics endpoints for dashboard charts.
 *
 * WHY THIS FILE EXISTS:
 * Separates analytics HTTP routing from SQL aggregation.
 *
 * HOW IT WORKS:
 * Returns overview, daily series and worker utilization for a selected range.
 *
 * USED BY:
 * app.ts and frontend analytics/dashboard pages.
 *
 * SECURITY:
 * Requires Firebase auth and scopes deployment metrics to the current user.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../common/errors.js';
import { getDeploymentAnalytics } from './service.js';

export const analyticsRouter = Router();

function parseDays(value: unknown): number {
  const days = Number(value ?? 30);
  if (!Number.isFinite(days)) return 30;
  return Math.max(1, Math.min(365, Math.floor(days)));
}

analyticsRouter.get('/overview', requireAuth, asyncHandler(async (req, res) => {
  const analytics = await getDeploymentAnalytics(req.user!.id, parseDays(req.query.days));
  res.json({ analytics });
}));

analyticsRouter.get('/deployments', requireAuth, asyncHandler(async (req, res) => {
  const analytics = await getDeploymentAnalytics(req.user!.id, parseDays(req.query.days));
  res.json({ daily: analytics.daily, overview: analytics.overview });
}));

analyticsRouter.get('/workers', requireAuth, asyncHandler(async (req, res) => {
  const analytics = await getDeploymentAnalytics(req.user!.id, parseDays(req.query.days));
  res.json({ workers: analytics.workers });
}));
