/**
 * FILE: packages/shared/src/crypto.ts
 *
 * PURPOSE:
 * Provides authenticated encryption helpers for secrets stored by FLASHLIVE.
 *
 * WHY THIS FILE EXISTS:
 * GitHub OAuth tokens and project environment variables must be encrypted at
 * rest with one implementation shared by API and worker.
 *
 * HOW IT WORKS:
 * Uses AES-256-GCM with a random IV and SHA-256-derived key. The output format
 * is versioned as v1:iv:tag:ciphertext in base64url.
 *
 * USED BY:
 * API GitHub/project modules and worker deployment execution.
 *
 * SECURITY:
 * Never logs plaintext secrets. Callers must supply a strong
 * TOKEN_ENCRYPTION_KEY environment variable.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

export function decryptSecret(payload: string, secret: string): string {
  const [version, iv, tag, ciphertext] = payload.split(':');
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Unsupported encrypted secret format.');
  }
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}
