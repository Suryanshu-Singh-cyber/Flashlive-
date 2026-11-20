/**
 * FILE: apps/worker/src/db/pool.ts
 *
 * PURPOSE:
 * Creates the worker's PostgreSQL connection pool.
 *
 * WHY THIS FILE EXISTS:
 * Slot claiming, heartbeats and recovery must use short transactions against
 * the same database as the API.
 *
 * HOW IT WORKS:
 * Exports a pg Pool and transaction helper backed by DATABASE_URL.
 *
 * USED BY:
 * Scheduler, recovery reaper and deployment context loading.
 *
 * SECURITY:
 * Uses parameterized SQL only; no credentials are logged.
 */

import pg from 'pg';
import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 12,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, params: unknown[] = []) {
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
