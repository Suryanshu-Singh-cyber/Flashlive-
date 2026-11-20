/**
 * FILE: apps/api/src/modules/github/routes.ts
 *
 * PURPOSE:
 * Exposes GitHub OAuth and repository browsing endpoints.
 *
 * WHY THIS FILE EXISTS:
 * Separates HTTP concerns from GitHub service logic and enforces auth on all
 * account/repository operations.
 *
 * HOW IT WORKS:
 * /connect returns an authorization URL, /callback completes OAuth and
 * redirects to the app, and repository endpoints proxy sanitized GitHub data.
 *
 * USED BY:
 * app.ts and frontend GitHub integration features.
 *
 * SECURITY:
 * OAuth state is hashed and single-use; access tokens stay server-side.
 */

import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler, ApiError } from '../../common/errors.js';
import {
  createOAuthState,
  disconnectGitHub,
  getGitHubTokenForUser,
  handleGitHubCallback,
  listBranches,
  listRepositories,
} from './service.js';
import { query } from '../../db/pool.js';

export const githubRouter = Router();

githubRouter.get(
  '/connect',
  requireAuth,
  asyncHandler(async (req, res) => {
    const url = await createOAuthState(req.user!.id);
    res.json({ url });
  }),
);

githubRouter.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) throw new ApiError(400, 'INVALID_OAUTH_CALLBACK', 'Missing OAuth code or state.');
    const redirectUrl = await handleGitHubCallback(code, state);
    res.redirect(redirectUrl);
  }),
);

githubRouter.get('/status', requireAuth, async (req, res) => {
  const result = await query(
    `SELECT github_login AS login, github_email AS email, scopes, created_at AS "createdAt"
     FROM github_accounts WHERE user_id = $1`,
    [req.user!.id],
  );
  res.json({ connected: (result.rowCount ?? 0) > 0, account: result.rows[0] ?? null });
});

githubRouter.get(
  '/repositories',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token } = await getGitHubTokenForUser(req.user!.id);
    res.json({ repositories: await listRepositories(token) });
  }),
);

githubRouter.get(
  '/repositories/:owner/:repo/branches',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token } = await getGitHubTokenForUser(req.user!.id);
    const owner = String(req.params.owner);
    const repo = String(req.params.repo);
    res.json({ branches: await listBranches(token, owner, repo) });
  }),
);

githubRouter.delete(
  '/disconnect',
  requireAuth,
  asyncHandler(async (req, res) => {
    await disconnectGitHub(req.user!.id);
    res.status(204).send();
  }),
);
