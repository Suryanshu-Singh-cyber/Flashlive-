/**
 * FILE: tests/unit/shared.test.ts
 *
 * PURPOSE:
 * Unit tests for shared FLASHLIVE schemas and secret encryption helpers.
 *
 * USED BY:
 * npm run test:unit during development and CI.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { projectCreateSchema, projectEnvVarsSchema } from '@flashlive/shared';
import { decryptSecret, encryptSecret } from '@flashlive/shared/crypto';

test('projectCreateSchema applies React+Vite defaults', () => {
  const parsed = projectCreateSchema.parse({
    name: 'Demo App',
    repositoryFullName: 'octocat/hello-world',
    repositoryId: 123,
  });
  assert.equal(parsed.framework, 'react-vite');
  assert.equal(parsed.branch, 'main');
  assert.equal(parsed.buildCommand, 'npm run build -- --base=./');
  assert.equal(parsed.outputDirectory, 'dist');
});

test('projectCreateSchema rejects shell metacharacters', () => {
  const result = projectCreateSchema.safeParse({
    name: 'Demo App',
    repositoryFullName: 'octocat/hello-world',
    repositoryId: 123,
    buildCommand: 'npm run build; rm -rf /',
  });
  assert.equal(result.success, false);
});

test('projectEnvVarsSchema enforces identifier keys', () => {
  const result = projectEnvVarsSchema.safeParse({
    variables: [{ key: 'BAD-KEY', value: 'x' }],
  });
  assert.equal(result.success, false);
});

test('encryptSecret/decryptSecret round-trips', () => {
  const secret = 'unit-test-secret-key-that-is-long-enough';
  const encrypted = encryptSecret('super-secret-value', secret);
  assert.notEqual(encrypted, 'super-secret-value');
  assert.equal(decryptSecret(encrypted, secret), 'super-secret-value');
  assert.throws(() => decryptSecret(encrypted, 'wrong-secret-key-that-is-long'));
});
