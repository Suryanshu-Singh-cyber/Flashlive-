/**
 * FILE: apps/api/src/modules/deployments/service.ts
 *
 * PURPOSE:
 * Creates, lists, cancels and redeploys FLASHLIVE deployments.
 *
 * WHY THIS FILE EXISTS:
 * Deployment creation must verify project ownership, resolve GitHub commits,
 * enforce queue limits and snapshot repository metadata for workers.
 *
 * HOW IT WORKS:
 * enqueueDeployment validates the project, resolves the requested branch/commit
 * through GitHub, inserts a queued row, and returns a typed deployment DTO.
 * Cancellation distinguishes queued jobs from actively building jobs.
 *
 * USED BY:
 * deployments/routes.ts, queue monitoring and analytics.
 *
 * SECURITY:
 * All reads/writes are scoped by user_id; workers never trust client commit
 * data without GitHub verification.
 */

import type { DeployProjectInput, Deployment, DeploymentLog, DeploymentStatus } from '@flashlive/shared';
import { MAX_QUEUE_PER_USER } from '@flashlive/shared';
import { query } from '../../db/pool.js';
import { ApiError } from '../../common/errors.js';
import { getOwnedProject } from '../projects/service.js';
import { getGitHubTokenForUser, listBranches } from '../github/service.js';

const DEPLOYMENT_SELECT = `
  SELECT d.id, d.user_id AS "userId", d.project_id AS "projectId", d.status,
    d.worker_id AS "workerId", d.slot_id AS "slotId", d.lease_token AS "leaseToken",
    d.attempt_count AS "attemptCount", d.commit_sha AS "commitSha", d.branch,
    d.repository_full_name AS "repositoryFullName", d.project_name AS "projectName",
    d.error_message AS "errorMessage", d.live_url AS "liveUrl",
    d.created_at AS "createdAt", d.queued_at AS "queuedAt", d.started_at AS "startedAt",
    d.heartbeat_at AS "heartbeatAt", d.cancel_requested_at AS "cancelRequestedAt",
    d.finished_at AS "finishedAt", d.build_duration_ms AS "buildDurationMs",
    CASE WHEN d.started_at IS NOT NULL AND d.queued_at IS NOT NULL
      THEN FLOOR(EXTRACT(EPOCH FROM (d.started_at - d.queued_at)) * 1000)::bigint
      ELSE NULL END AS "queueDurationMs"
  FROM deployments d
`;

function mapDeployment(row: Record<string, unknown>): Deployment {
  return row as unknown as Deployment;
}

async function resolveCommit(userId: string, repositoryFullName: string, branch: string, commitSha?: string): Promise<string> {
  if (commitSha) return commitSha;
  const { token } = await getGitHubTokenForUser(userId);
  const [owner, repo] = repositoryFullName.split('/');
  if (!owner || !repo) throw new ApiError(400, 'INVALID_REPOSITORY', 'Repository must use owner/name format.');
  const branches = await listBranches(token, owner, repo);
  const found = branches.find((item) => item.name === branch);
  if (!found?.commitSha) throw new ApiError(400, 'BRANCH_NOT_FOUND', `Branch ${branch} was not found.`);
  return found.commitSha;
}

export async function enqueueDeployment(userId: string, projectId: string, input: DeployProjectInput = {}): Promise<Deployment> {
  const project = await getOwnedProject(userId, projectId);
  if (project.status !== 'active') throw new ApiError(409, 'PROJECT_INACTIVE', 'Only active projects can be deployed.');

  const branch = input.branch ?? project.branch;
  const commitSha = await resolveCommit(userId, project.repositoryFullName, branch, input.commitSha);

  const activeCount = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM deployments
     WHERE user_id = $1 AND status IN ('queued', 'building')`,
    [userId],
  );
  if (Number(activeCount.rows[0]?.count ?? 0) >= MAX_QUEUE_PER_USER) {
    throw new ApiError(429, 'QUEUE_LIMIT_REACHED', `You can have at most ${MAX_QUEUE_PER_USER} queued or building deployments.`);
  }

  const result = await query<Record<string, unknown>>(
    `INSERT INTO deployments(
      user_id, project_id, status, branch, repository_full_name, project_name,
      commit_sha, queued_at
    ) VALUES ($1,$2,'queued',$3,$4,$5,$6,NOW())
    RETURNING id`,
    [userId, projectId, branch, project.repositoryFullName, project.name, commitSha],
  );
  const deploymentId = String(result.rows[0]!.id);
  return getOwnedDeployment(userId, deploymentId);
}

export async function listDeployments(
  userId: string,
  filters: { projectId?: string; status?: DeploymentStatus; limit?: number } = {},
): Promise<Deployment[]> {
  const conditions = ['d.user_id = $1'];
  const params: unknown[] = [userId];
  if (filters.projectId) {
    params.push(filters.projectId);
    conditions.push(`d.project_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`d.status = $${params.length}`);
  }
  params.push(Math.min(filters.limit ?? 50, 100));
  const result = await query<Record<string, unknown>>(
    `${DEPLOYMENT_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY d.created_at DESC LIMIT $${params.length}`,
    params,
  );
  return result.rows.map(mapDeployment);
}

export async function getOwnedDeployment(userId: string, deploymentId: string): Promise<Deployment> {
  const result = await query<Record<string, unknown>>(`${DEPLOYMENT_SELECT} WHERE d.id = $1 AND d.user_id = $2`, [deploymentId, userId]);
  const row = result.rows[0];
  if (!row) throw new ApiError(404, 'DEPLOYMENT_NOT_FOUND', 'Deployment not found.');
  return mapDeployment(row);
}

export async function getDeploymentById(deploymentId: string): Promise<Deployment | null> {
  const result = await query<Record<string, unknown>>(`${DEPLOYMENT_SELECT} WHERE d.id = $1`, [deploymentId]);
  return result.rows[0] ? mapDeployment(result.rows[0]) : null;
}

export async function cancelDeployment(userId: string, deploymentId: string): Promise<Deployment> {
  const deployment = await getOwnedDeployment(userId, deploymentId);
  if (deployment.status === 'queued') {
    await query(
      `UPDATE deployments
       SET status = 'cancelled', finished_at = NOW(),
         queue_duration_ms = FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(queued_at, created_at))) * 1000)::bigint
       WHERE id = $1 AND status = 'queued'`,
      [deploymentId],
    );
  } else if (deployment.status === 'building') {
    await query('UPDATE deployments SET cancel_requested_at = NOW() WHERE id = $1 AND status = \'building\'', [deploymentId]);
  } else {
    throw new ApiError(409, 'DEPLOYMENT_NOT_CANCELLABLE', 'Only queued or building deployments can be cancelled.');
  }
  return getOwnedDeployment(userId, deploymentId);
}

export async function redeployDeployment(userId: string, deploymentId: string): Promise<Deployment> {
  const deployment = await getOwnedDeployment(userId, deploymentId);
  return enqueueDeployment(userId, deployment.projectId, { commitSha: deployment.commitSha ?? undefined });
}

export async function getDeploymentLogs(userId: string, deploymentId: string): Promise<DeploymentLog[]> {
  await getOwnedDeployment(userId, deploymentId);
  const result = await query<DeploymentLog>(
    `SELECT id::text, deployment_id AS "deploymentId", sequence, level, message,
       created_at AS "createdAt"
     FROM deployment_logs WHERE deployment_id = $1 ORDER BY sequence ASC`,
    [deploymentId],
  );
  return result.rows;
}
