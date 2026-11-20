/**
 * FILE: packages/shared/src/schemas/index.ts
 *
 * PURPOSE:
 * Provides reusable Zod schemas for API request validation and frontend forms.
 *
 * WHY THIS FILE EXISTS:
 * Ensures backend and frontend enforce the same constraints for projects,
 * deployments, environment variables and profile updates.
 *
 * HOW IT WORKS:
 * Exports parsed schemas that reject unsafe commands, malformed identifiers
 * and oversized inputs before they reach services.
 *
 * USED BY:
 * API middleware/routes and React Hook Form resolvers.
 */

import { z } from 'zod';
import { DEFAULT_BUILD_COMMAND, DEFAULT_INSTALL_COMMAND, DEFAULT_OUTPUT_DIRECTORY, SUPPORTED_FRAMEWORK } from '../constants/index.js';

const safeName = z.string().trim().min(2).max(80).regex(/^[a-zA-Z0-9][a-zA-Z0-9 _.-]*$/, 'Use letters, numbers, spaces, dots, dashes or underscores.');
const repositoryFullName = z.string().trim().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Use owner/repository format.');
const branch = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9._/-]+$/, 'Branch contains unsupported characters.');
const sha = z.string().trim().regex(/^[a-fA-F0-9]{7,64}$/, 'Commit must be a hexadecimal SHA.');
const command = z.string().trim().min(1).max(240).refine((value) => !/[;&|`$<>\\]/.test(value), 'Shell metacharacters are not allowed.');
const outputDirectory = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9._/-]+$/, 'Output directory contains unsupported characters.').refine((value) => !value.includes('..'), 'Path traversal is not allowed.');

export const projectCreateSchema = z.object({
  name: safeName,
  repositoryFullName,
  repositoryId: z.number().int().positive(),
  githubAccountId: z.string().uuid().optional(),
  branch: branch.default('main'),
  framework: z.literal(SUPPORTED_FRAMEWORK).default(SUPPORTED_FRAMEWORK),
  buildCommand: command.default(DEFAULT_BUILD_COMMAND),
  installCommand: command.default(DEFAULT_INSTALL_COMMAND),
  outputDirectory: outputDirectory.default(DEFAULT_OUTPUT_DIRECTORY),
});

export const projectUpdateSchema = projectCreateSchema
  .partial()
  .omit({ repositoryFullName: true, repositoryId: true })
  .extend({ status: z.enum(['active', 'archived', 'disabled']).optional() });

export const deployProjectSchema = z.object({
  branch: branch.optional(),
  commitSha: sha.optional(),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
});

export const projectEnvVarSchema = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Environment variable names must be valid identifiers.'),
  value: z.string().max(4000),
});

export const projectEnvVarsSchema = z.object({
  variables: z.array(projectEnvVarSchema).max(50),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type DeployProjectInput = z.infer<typeof deployProjectSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ProjectEnvVarsInput = z.infer<typeof projectEnvVarsSchema>;
