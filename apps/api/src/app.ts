/**
 * FILE: apps/api/src/app.ts
 *
 * PURPOSE:
 * Builds the FLASHLIVE Express application and mounts all API routers.
 *
 * WHY THIS FILE EXISTS:
 * Keeps HTTP wiring separate from server startup and Socket.IO initialization.
 *
 * HOW IT WORKS:
 * Applies Helmet, CORS, JSON limits and rate limiting, then mounts auth,
 * GitHub, project, deployment, queue, analytics, worker and user routers.
 *
 * USED BY:
 * server.ts and integration tests.
 *
 * SECURITY:
 * Centralizes baseline API protections before route handlers run.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './common/errors.js';
import { corsOrigin } from './common/cors.js';
import { authRouter } from './modules/auth/routes.js';
import { githubRouter } from './modules/github/routes.js';
import { projectsRouter } from './modules/projects/routes.js';
import { deploymentsRouter } from './modules/deployments/routes.js';
import { queueRouter } from './modules/queue/routes.js';
import { analyticsRouter } from './modules/analytics/routes.js';
import { workersRouter } from './modules/workers/routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/sites', (_req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:; font-src 'self' data: https:;",
    );
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
    next();
  }, express.static(env.FLASHLIVE_ARTIFACT_DIR));
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'flashlive-api', time: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/github', githubRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api', deploymentsRouter);
  app.use('/api', queueRouter);
  app.use('/api/analytics', analyticsRouter);
  app.use('/api', workersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
