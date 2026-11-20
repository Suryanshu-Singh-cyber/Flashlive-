/**
 * FILE: apps/api/src/modules/projects/service.ts
 *
 * PURPOSE:
 * Implements project ownership checks, GitHub repository verification and
 * project persistence for FLASHLIVE.
 *
 * WHY THIS FILE EXISTS:
 * Projects connect GitHub repositories to deployment configuration. This
 * service ensures only authorized repositories are stored and users cannot
 * modify other users' projects.
 *
 * HOW IT WORKS:
 * Verifies repository metadata through GitHub API, resolves branch commits,
 * enforces per-user project limits, and returns scoped database rows.
 *
 * USED BY:
 * projects/routes.ts and deployment creation.
 *
 * SECURITY:
 * Every query is scoped by req.user.id; repository access is verified with the
 * user's encrypted GitHub token.
 */

import type { Project, ProjectCreateInput, ProjectUpdateInput } from '@flashlive/shared';
import { MAX_PROJECTS_PER_USER } from '@flashlive/shared';
import { query } from '../../db/pool.js';
import { ApiError } from '../../common/errors.js';
import { getGitHubTokenForUser, getRepository, listBranches } from '../github/service.js';

const PROJECT_SELECT = `
  SELECT p.id, p.user_id AS "userId", p.github_account_id AS "githubAccountId", p.name,
    p.repository_full_name AS "repositoryFullName", p.repository_id AS "repositoryId",
    p.branch, p.commit_sha AS "commitSha", p.framework, p.build_command AS "buildCommand",
    p.install_command AS "installCommand", p.output_directory AS "outputDirectory",
    p.status, p.created_at AS "createdAt", p.updated_at AS "updatedAt",
    p.last_deployment_at AS "lastDeploymentAt"
  FROM projects p
`;

export async function listProjects(userId: string): Promise<Project[]> {
  const result = await query<Project>(
    `${PROJECT_SELECT}
     WHERE p.user_id = $1 AND p.status <> 'archived'
     ORDER BY p.updated_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function getOwnedProject(userId: string, projectId: string): Promise<Project> {
  const result = await query<Project>(`${PROJECT_SELECT} WHERE p.id = $1 AND p.user_id = $2`, [projectId, userId]);
  const project = result.rows[0];
  if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
  return project;
}

function splitRepository(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) throw new ApiError(400, 'INVALID_REPOSITORY', 'Repository must use owner/name format.');
  return { owner, repo };
}

export async function createProject(userId: string, input: ProjectCreateInput): Promise<Project> {
  const count = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM projects WHERE user_id = $1 AND status <> \'archived\'', [userId]);
  if (Number(count.rows[0]?.count ?? 0) >= MAX_PROJECTS_PER_USER) {
    throw new ApiError(409, 'PROJECT_LIMIT_REACHED', `You can create up to ${MAX_PROJECTS_PER_USER} projects.`);
  }

  const { token, accountId } = await getGitHubTokenForUser(userId);
  const { owner, repo } = splitRepository(input.repositoryFullName);
  const githubRepo = await getRepository(token, owner, repo);
  if (githubRepo.id !== input.repositoryId) {
    throw new ApiError(400, 'REPOSITORY_MISMATCH', 'Repository id does not match GitHub metadata.');
  }

  const branch = input.branch ?? githubRepo.defaultBranch;
  const branches = await listBranches(token, owner, repo);
  const branchInfo = branches.find((item) => item.name === branch);
  if (!branchInfo) throw new ApiError(400, 'BRANCH_NOT_FOUND', `Branch ${branch} was not found.`);

  const result = await query<Project>(
    `INSERT INTO projects(
      user_id, github_account_id, name, repository_full_name, repository_id, branch,
      commit_sha, framework, build_command, install_command, output_directory, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active')
    RETURNING id, user_id AS "userId", github_account_id AS "githubAccountId", name,
      repository_full_name AS "repositoryFullName", repository_id AS "repositoryId",
      branch, commit_sha AS "commitSha", framework, build_command AS "buildCommand",
      install_command AS "installCommand", output_directory AS "outputDirectory",
      status, created_at AS "createdAt", updated_at AS "updatedAt",
      last_deployment_at AS "lastDeploymentAt"`,
    [
      userId,
      input.githubAccountId ?? accountId,
      input.name,
      input.repositoryFullName,
      input.repositoryId,
      branch,
      branchInfo.commitSha,
      input.framework,
      input.buildCommand,
      input.installCommand,
      input.outputDirectory,
    ],
  );
  return result.rows[0]!;
}

export async function updateProject(userId: string, projectId: string, input: ProjectUpdateInput): Promise<Project> {
  const existing = await getOwnedProject(userId, projectId);
  const branch = input.branch ?? existing.branch;

  if (input.branch && input.branch !== existing.branch) {
    const { token } = await getGitHubTokenForUser(userId);
    const { owner, repo } = splitRepository(existing.repositoryFullName);
    const branches = await listBranches(token, owner, repo);
    const branchInfo = branches.find((item) => item.name === branch);
    if (!branchInfo) throw new ApiError(400, 'BRANCH_NOT_FOUND', `Branch ${branch} was not found.`);
  }

  const result = await query<Project>(
    `UPDATE projects SET
      name = COALESCE($3, name),
      branch = $4,
      commit_sha = CASE WHEN $5::boolean THEN NULL ELSE commit_sha END,
      framework = COALESCE($6, framework),
      build_command = COALESCE($7, build_command),
      install_command = COALESCE($8, install_command),
      output_directory = COALESCE($9, output_directory),
      status = COALESCE($10, status),
      updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id AS "userId", github_account_id AS "githubAccountId", name,
      repository_full_name AS "repositoryFullName", repository_id AS "repositoryId",
      branch, commit_sha AS "commitSha", framework, build_command AS "buildCommand",
      install_command AS "installCommand", output_directory AS "outputDirectory",
      status, created_at AS "createdAt", updated_at AS "updatedAt",
      last_deployment_at AS "lastDeploymentAt"`,
    [
      projectId,
      userId,
      input.name ?? null,
      branch,
      Boolean(input.branch && input.branch !== existing.branch),
      input.framework ?? null,
      input.buildCommand ?? null,
      input.installCommand ?? null,
      input.outputDirectory ?? null,
      input.status ?? null,
    ],
  );
  return result.rows[0]!;
}

export async function archiveProject(userId: string, projectId: string): Promise<void> {
  await getOwnedProject(userId, projectId);
  await query(`UPDATE projects SET status = 'archived', updated_at = NOW() WHERE id = $1 AND user_id = $2`, [projectId, userId]);
}
