/**
 * FILE: database/scripts/migrate.mjs
 *
 * PURPOSE:
 * Applies FLASHLIVE PostgreSQL migrations in filename order.
 *
 * WHY THIS FILE EXISTS:
 * Keeps schema changes reproducible and prevents manual production edits.
 *
 * HOW IT WORKS:
 * Loads DATABASE_URL, creates schema_migrations, then applies each SQL file
 * inside a transaction and records its checksum.
 *
 * USED BY:
 * npm run db:migrate and container startup scripts.
 *
 * SECURITY:
 * Uses parameterized bookkeeping queries and never prints DATABASE_URL.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = path.join(root, 'database/migrations');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required to run migrations.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

  for (const filename of files) {
    const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = await client.query('SELECT checksum FROM schema_migrations WHERE filename = $1', [filename]);

    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Migration checksum mismatch for ${filename}. Create a new migration instead of editing applied SQL.`);
      }
      console.log(`skip ${filename}`);
      continue;
    }

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(filename, checksum) VALUES ($1, $2)', [filename, checksum]);
      await client.query('COMMIT');
      console.log(`apply ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.end();
}
