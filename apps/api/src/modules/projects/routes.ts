/**
 * FILE: apps/api/src/modules/projects/routes.ts
 *
 * PURPOSE:
 * Exposes project CRUD, deployment triggers and encrypted environment-variable
 * management endpoints.
 *
 * WHY THIS FILE EXISTS:
 * Keeps HTTP routing separate from project persistence and GitHub verification.
 *
 * HOW IT WORKS:
 * All routes require Firebase auth and scope queries to req.user.id. Env var
 * values are encrypted before storage and never returned by GET.
 *
 * USED BY:
 * app.ts and frontend project pages/settings.
 *
 * SECURITY:
 * Ownership is checked on every project route; commands are Zod-validated and
 * env values are encrypted with TOKEN_ENCRYPTION_KEY.
 */

import { Router } from 'express';
import { projectCreateSchema, projectEnvVarsSchema, projectUpdateSchema } from '@flashlive/shared';
import { encryptSecret } from '@flashlive/shared/crypto';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../common/errors.js';
import { env } from '../../config/env.js';
import { query, withTransaction } from '../../db/pool.js';
import { archiveProject, createProject, getOwnedProject, listProjects, updateProject } from './service.js';

export const projectsRouter = Router({ mergeParams: true });

projectsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ projects: await listProjects(req.user!.id) });
  }),
);

projectsRouter.post(
  '/',
  requireAuth,
  validate(projectCreateSchema),
  asyncHandler(async (req, res) => {
    const project = await createProject(req.user!.id, req.body);
    res.status(201).json({ project });
  }),
);

projectsRouter.get(
  '/:projectId',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ project: await getOwnedProject(req.user!.id, String(req.params.projectId)) });
  }),
);

projectsRouter.patch(
  '/:projectId',
  requireAuth,
  validate(projectUpdateSchema),
  asyncHandler(async (req, res) => {
    res.json({ project: await updateProject(req.user!.id, String(req.params.projectId), req.body) });
  }),
);

projectsRouter.delete(
  '/:projectId',
  requireAuth,
  asyncHandler(async (req, res) => {
    await archiveProject(req.user!.id, String(req.params.projectId));
    res.status(204).send();
  }),
);

projectsRouter.get(
  '/:projectId/env',
  requireAuth,
  asyncHandler(async (req, res) => {
    await getOwnedProject(req.user!.id, String(req.params.projectId));
    const result = await query(
      `SELECT env_key AS key, updated_at AS "updatedAt"
       FROM project_env_vars WHERE project_id = $1 ORDER BY env_key`,
      [String(req.params.projectId)],
    );
    res.json({ variables: result.rows });
  }),
);

projectsRouter.put(
  '/:projectId/env',
  requireAuth,
  validate(projectEnvVarsSchema),
  asyncHandler(async (req, res) => {
    const projectId = String(req.params.projectId);
    await getOwnedProject(req.user!.id, projectId);
    const variables = req.body.variables as Array<{ key: string; value: string }>;

    await withTransaction(async (client) => {
      await client.query('DELETE FROM project_env_vars WHERE project_id = $1', [projectId]);
      for (const variable of variables) {
        await client.query(
          `INSERT INTO project_env_vars(project_id, env_key, encrypted_value)
           VALUES ($1, $2, $3)`,
          [projectId, variable.key, encryptSecret(variable.value, env.TOKEN_ENCRYPTION_KEY)],
        );
      }
    });

    res.json({ variables: variables.map((variable) => ({ key: variable.key })) });
  }),
);

projectsRouter.delete(
  '/:projectId/env',
  requireAuth,
  asyncHandler(async (req, res) => {
    const projectId = String(req.params.projectId);
    await getOwnedProject(req.user!.id, projectId);
    await query('DELETE FROM project_env_vars WHERE project_id = $1', [projectId]);
    res.status(204).send();
  }),
);

