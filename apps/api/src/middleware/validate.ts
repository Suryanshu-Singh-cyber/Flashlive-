/**
 * FILE: apps/api/src/middleware/validate.ts
 *
 * PURPOSE:
 * Validates request payloads with shared Zod schemas.
 *
 * WHY THIS FILE EXISTS:
 * Centralizes validation so routes do not repeat safeParse logic.
 *
 * HOW IT WORKS:
 * Parses req.body/query/params, replaces the source with parsed data on
 * success, and throws ApiError(400) with field issues on failure.
 *
 * USED BY:
 * Project, deployment, profile and internal worker routes.
 */

import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ApiError } from '../common/errors.js';

export type ValidationSource = 'body' | 'query' | 'params';

export function validate<T>(schema: ZodSchema<T>, source: ValidationSource = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      next(new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed.', result.error.flatten()));
      return;
    }
    Object.assign(req[source], result.data);
    next();
  };
}
