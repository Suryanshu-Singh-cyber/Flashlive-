/**
 * FILE: apps/api/src/db/pool.ts
 *
 * PURPOSE:
 * Creates the shared PostgreSQL connection pool for the API.
 *
 * WHY THIS FILE EXISTS:
 * All modules need database access, but each must reuse bounded connections
 * rather than opening a new client per request.
 *
 * HOW IT WORKS:
 * Initializes pg.Pool from DATABASE_URL with conservative limits and exports
 * a typed query helper.
 *
 * USED BY:
 * Auth, projects, deployments, queue, analytics, workers and sockets modules.
 *
 * SECURITY:
 * Uses parameterized queries at call sites; this file never interpolates SQL.
 */

import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
