/**
 * FILE: apps/api/src/middleware/auth.ts
 *
 * PURPOSE:
 * Verifies Firebase ID tokens and internal worker tokens for API routes.
 *
 * WHY THIS FILE EXISTS:
 * Authentication must be enforced server-side. The browser never supplies a
 * trusted user id; the backend verifies the token and upserts the PostgreSQL
 * user record.
 *
 * HOW IT WORKS:
 * requireAuth verifies a Bearer Firebase token, resolves/creates the user by
 * firebase_uid, and attaches req.user. requireInternal validates the shared
 * worker token for machine-to-machine endpoints.
 *
 * USED BY:
 * Protected routers and internal deployment/log routes.
 *
 * SECURITY:
 * Never trusts client-provided user ids. Tokens are verified by Firebase Admin.
 */

import type { NextFunction, Request, Response } from 'express';
import admin from 'firebase-admin';
import { env, isFirebaseConfigured } from '../config/env.js';
import { query } from '../db/pool.js';
import { ApiError } from '../common/errors.js';
import type { User } from '@flashlive/shared';

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) return;
  if (!isFirebaseConfigured) {
    throw new ApiError(503, 'AUTH_NOT_CONFIGURED', 'Firebase Authentication is not configured.');
  }

  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.FIREBASE_PROJECT_ID!,
        clientEmail: env.FIREBASE_CLIENT_EMAIL!,
        privateKey: env.FIREBASE_PRIVATE_KEY!,
      }),
    });
  }
  firebaseInitialized = true;
}

function bearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Missing bearer token.');
  }
  return header.slice('Bearer '.length).trim();
}

async function upsertUser(decoded: admin.auth.DecodedIdToken): Promise<User> {
  const email = decoded.email;
  if (!email) {
    throw new ApiError(403, 'EMAIL_REQUIRED', 'A verified email is required.');
  }

  const returning = `RETURNING id, firebase_uid AS "firebaseUid", email, display_name AS "displayName",
    email_verified AS "emailVerified", created_at AS "createdAt", updated_at AS "updatedAt"`;

  try {
    const result = await query<User>(
      `INSERT INTO users(firebase_uid, email, display_name, email_verified)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (firebase_uid) DO UPDATE SET
         email = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         email_verified = EXCLUDED.email_verified,
         updated_at = NOW()
       ${returning}`,
      [decoded.uid, email, decoded.name ?? null, decoded.email_verified === true],
    );
    const user = result.rows[0];
    if (!user) throw new ApiError(500, 'USER_UPSERT_FAILED', 'Could not create user session.');
    return user;
  } catch (error) {
    const pgError = error as { code?: string; constraint?: string };
    if (pgError.code !== '23505' || !pgError.constraint?.includes('email')) throw error;
    const result = await query<User>(
      `UPDATE users
       SET firebase_uid = $1, display_name = $3, email_verified = $4, updated_at = NOW()
       WHERE lower(email) = lower($2)
       ${returning}`,
      [decoded.uid, email, decoded.name ?? null, decoded.email_verified === true],
    );
    const user = result.rows[0];
    if (!user) throw new ApiError(500, 'USER_UPSERT_FAILED', 'Could not create user session.');
    return user;
  }
}

export async function verifyFirebaseIdToken(token: string) {
  initializeFirebase();
  return admin.auth().verifyIdToken(token, true);
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = bearerToken(req);
    const decoded = await verifyFirebaseIdToken(token).catch((error) => {
      if (error instanceof ApiError) throw error;
      throw new ApiError(401, 'INVALID_TOKEN', 'Firebase token is invalid or expired.');
    });
    req.user = await upsertUser(decoded);
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }
    next(new ApiError(500, 'PROFILE_SYNC_FAILED', 'Could not sync user profile.'));
  }
}

export function requireInternal(req: Request, _res: Response, next: NextFunction) {
  const token = req.header('x-internal-token');
  if (!token || token !== env.INTERNAL_API_TOKEN) {
    next(new ApiError(401, 'INVALID_INTERNAL_TOKEN', 'Invalid internal token.'));
    return;
  }
  next();
}
