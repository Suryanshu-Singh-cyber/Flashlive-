/**
 * FILE: apps/api/src/modules/github/service.ts
 *
 * PURPOSE:
 * Implements GitHub OAuth state handling, token exchange and repository API
 * access for FLASHLIVE.
 *
 * WHY THIS FILE EXISTS:
 * GitHub credentials and tokens are sensitive. This service centralizes OAuth
 * verification, encrypted token storage and authenticated GitHub API calls.
 *
 * HOW IT WORKS:
 * Creates hashed OAuth states, exchanges authorization codes, stores encrypted
 * access tokens, and calls GitHub REST endpoints with the decrypted token.
 *
 * USED BY:
 * github/routes.ts and project/deployment services that need repository data.
 *
 * SECURITY:
 * Tokens are encrypted at rest, never returned to the frontend, and GitHub API
 * errors are sanitized before reaching clients.
 */

import { createHash, randomBytes } from 'node:crypto';
import { encryptSecret, decryptSecret } from '@flashlive/shared/crypto';
import { env } from '../../config/env.js';
import { query, withTransaction } from '../../db/pool.js';
import { ApiError } from '../../common/errors.js';

const GITHUB_API = 'https://api.github.com';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export interface GitHubRepo {
  id: number;
  fullName: string;
  name: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  updatedAt: string;
}

export interface GitHubBranch {
  name: string;
  commitSha: string;
  protected: boolean;
}

interface OAuthStateRow {
  id: string;
  user_id: string;
}

function requireGitHubConfig() {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_CALLBACK_URL) {
    throw new ApiError(503, 'GITHUB_NOT_CONFIGURED', 'GitHub OAuth is not configured.');
  }
  return {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    callbackUrl: env.GITHUB_CALLBACK_URL,
  };
}

export async function createOAuthState(userId: string): Promise<string> {
  const config = requireGitHubConfig();
  const state = randomBytes(32).toString('hex');
  const stateHash = createHash('sha256').update(state).digest('hex');
  await query(
    `INSERT INTO oauth_states(state_hash, user_id, provider, expires_at)
     VALUES ($1, $2, 'github', NOW() + ($3 || ' milliseconds')::interval)`,
    [stateHash, userId, String(OAUTH_STATE_TTL_MS)],
  );
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: 'repo read:user',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

async function consumeOAuthState(state: string): Promise<string> {
  const stateHash = createHash('sha256').update(state).digest('hex');
  return withTransaction(async (client) => {
    const result = await client.query<OAuthStateRow>(
      `UPDATE oauth_states
       SET consumed_at = NOW()
       WHERE state_hash = $1
         AND provider = 'github'
         AND consumed_at IS NULL
         AND expires_at > NOW()
       RETURNING id, user_id`,
      [stateHash],
    );
    const row = result.rows[0];
    if (!row) throw new ApiError(400, 'INVALID_OAUTH_STATE', 'GitHub OAuth state is invalid or expired.');
    return row.user_id;
  });
}

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  email: string | null;
}

export async function handleGitHubCallback(code: string, state: string): Promise<string> {
  const config = requireGitHubConfig();
  const userId = await consumeOAuthState(state);

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.callbackUrl,
    }),
  });
  const tokenBody = (await tokenResponse.json()) as GitHubTokenResponse;
  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new ApiError(502, 'GITHUB_TOKEN_EXCHANGE_FAILED', tokenBody.error_description ?? 'GitHub token exchange failed.');
  }

  const accessToken = tokenBody.access_token;
  const [userResponse, encryptedToken] = await Promise.all([
    githubApi<GitHubUserResponse>(accessToken, '/user'),
    Promise.resolve(encryptSecret(accessToken, env.TOKEN_ENCRYPTION_KEY)),
  ]);

  await query(
    `INSERT INTO github_accounts(
       user_id, github_user_id, github_login, github_email,
       encrypted_access_token, scopes, token_expires_at
     ) VALUES ($1, $2, $3, $4, $5, $6, NULL)
     ON CONFLICT (user_id) DO UPDATE SET
       github_user_id = EXCLUDED.github_user_id,
       github_login = EXCLUDED.github_login,
       github_email = EXCLUDED.github_email,
       encrypted_access_token = EXCLUDED.encrypted_access_token,
       scopes = EXCLUDED.scopes,
       token_expires_at = NULL,
       updated_at = NOW()`,
    [userId, userResponse.id, userResponse.login, userResponse.email, encryptedToken, tokenBody.scope ?? ''],
  );

  return `${env.WEB_ORIGIN}/settings?github=connected`;
}

export async function getGitHubTokenForUser(userId: string): Promise<{ accountId: string; token: string; login: string }> {
  const result = await query<{ id: string; encrypted_access_token: string; github_login: string }>(
    `SELECT id, encrypted_access_token, github_login
     FROM github_accounts
     WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) throw new ApiError(409, 'GITHUB_NOT_CONNECTED', 'Connect GitHub before importing repositories.');
  return {
    accountId: row.id,
    token: decryptSecret(row.encrypted_access_token, env.TOKEN_ENCRYPTION_KEY),
    login: row.github_login,
  };
}

export async function githubApi<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'FLASHLIVE',
    },
  });
  if (response.status === 401 || response.status === 403) {
    throw new ApiError(401, 'GITHUB_TOKEN_INVALID', 'GitHub authorization is invalid or expired. Reconnect GitHub.');
  }
  if (!response.ok) {
    throw new ApiError(502, 'GITHUB_API_ERROR', `GitHub API request failed with status ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export async function listRepositories(token: string): Promise<GitHubRepo[]> {
  const repos = await githubApi<Array<Record<string, unknown>>>(
    token,
    '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
  );
  return repos.map((repo) => ({
    id: Number(repo.id),
    fullName: String(repo.full_name),
    name: String(repo.name),
    owner: String((repo.owner as Record<string, unknown>).login ?? ''),
    private: Boolean(repo.private),
    defaultBranch: String(repo.default_branch ?? 'main'),
    htmlUrl: String(repo.html_url),
    updatedAt: String(repo.updated_at),
  }));
}

export async function listBranches(token: string, owner: string, repo: string): Promise<GitHubBranch[]> {
  const branches = await githubApi<Array<Record<string, unknown>>>(token, `/repos/${owner}/${repo}/branches?per_page=100`);
  return branches.map((branch) => ({
    name: String(branch.name),
    commitSha: String((branch.commit as Record<string, unknown>).sha ?? ''),
    protected: Boolean(branch.protected),
  }));
}

export async function getRepository(token: string, owner: string, repo: string): Promise<GitHubRepo> {
  const data = await githubApi<Record<string, unknown>>(token, `/repos/${owner}/${repo}`);
  return {
    id: Number(data.id),
    fullName: String(data.full_name),
    name: String(data.name),
    owner: String((data.owner as Record<string, unknown>).login ?? owner),
    private: Boolean(data.private),
    defaultBranch: String(data.default_branch ?? 'main'),
    htmlUrl: String(data.html_url),
    updatedAt: String(data.updated_at),
  };
}

export async function disconnectGitHub(userId: string) {
  await query('DELETE FROM github_accounts WHERE user_id = $1', [userId]);
}
