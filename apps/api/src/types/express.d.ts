/**
 * FILE: apps/api/src/types/express.d.ts
 *
 * PURPOSE:
 * Extends Express Request with FLASHLIVE authentication context.
 *
 * WHY THIS FILE EXISTS:
 * Lets middleware attach the verified database user without unsafe casts.
 *
 * USED BY:
 * auth middleware and all protected routes/services.
 */

import type { User } from '@flashlive/shared';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
