/**
 * FILE: apps/api/src/modules/auth/routes.ts
 *
 * PURPOSE:
 * Exposes authenticated user profile endpoints.
 *
 * WHY THIS FILE EXISTS:
 * Firebase handles credential verification, while PostgreSQL remains the
 * source of truth for FLASHLIVE profile data.
 *
 * HOW IT WORKS:
 * GET /me returns the verified req.user. PATCH /me updates display_name after
 * Zod validation.
 *
 * USED BY:
 * app.ts router and frontend profile/settings pages.
 *
 * SECURITY:
 * Requires Firebase auth; users can only modify their own record via req.user.
 */

import { Router } from 'express';
import type { PublicUser, User } from '@flashlive/shared';
import { profileUpdateSchema } from '@flashlive/shared';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../common/errors.js';
import { query } from '../../db/pool.js';

export const authRouter = Router();

function toPublicUser(user: NonNullable<Express.Request['user']>): PublicUser {
  const { firebaseUid: _firebaseUid, ...publicUser } = user;
  return publicUser;
}

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user!) });
});

authRouter.patch(
  '/me',
  requireAuth,
  validate(profileUpdateSchema),
  asyncHandler(async (req, res) => {
    const displayName = req.body.displayName;
    const result = await query<User>(
      `UPDATE users
       SET display_name = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, firebase_uid AS "firebaseUid", email, display_name AS "displayName",
         email_verified AS "emailVerified", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.user!.id, displayName],
    );
    const user = result.rows[0];
    if (!user) throw new Error('User update returned no row.');
    res.json({ user: toPublicUser(user) });
  }),
);
