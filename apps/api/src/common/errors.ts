/**
 * FILE: apps/api/src/common/errors.ts
 *
 * PURPOSE:
 * Defines API error types, async route wrappers and the centralized error handler.
 *
 * WHY THIS FILE EXISTS:
 * Keeps error responses consistent and prevents accidental stack/secret leakage.
 *
 * HOW IT WORKS:
 * ApiError carries an HTTP status and stable code. asyncHandler forwards
 * rejected promises to Express. errorHandler maps known errors and returns a
 * sanitized JSON body.
 *
 * USED BY:
 * All API routes, middleware and app.ts.
 */

import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger.js';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    });
    return;
  }

  logger.error('Unhandled API error', {
    path: req.path,
    method: req.method,
    error: error instanceof Error ? error.message : String(error),
  });

  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
}
