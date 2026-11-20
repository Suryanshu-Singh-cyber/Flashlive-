/**
 * FILE: database/scripts/seed.mjs
 *
 * PURPOSE:
 * Seeds development-only infrastructure rows for FLASHLIVE.
 *
 * WHY THIS FILE EXISTS:
 * Worker slots must exist before deployments can be claimed. This script makes
 * local setup deterministic without fabricating users or deployments.
 *
 * HOW IT WORKS:
 * Reads DATABASE_URL and FLASHLIVE_BUILD_SLOTS, then inserts missing global
 * worker slots using ON CONFLICT DO NOTHING.
 *
 * USED BY:
 * npm run db:seed and local Docker Compose initialization.
 *
 * SECURITY:
 * Does not create credentials, users or fake deployment data.
 */

import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const slotCount = Math.max(1, Math.min(20, Number.parseInt(process.env.FLASHLIVE_BUILD_SLOTS ?? '3', 10) || 3));

if (!databaseUrl) {
  console.error('DATABASE_URL is required to run the seed script.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });

try {
  await client.connect();
  for (let index = 0; index < slotCount; index += 1) {
    await client.query(
      `INSERT INTO worker_slots(slot_index, status)
       VALUES ($1, 'available')
       ON CONFLICT (slot_index) DO NOTHING`,
      [index],
    );
  }
  const result = await client.query('SELECT COUNT(*)::int AS count FROM worker_slots');
  console.log(`worker_slots ready: ${result.rows[0].count}`);
} finally {
  await client.end();
}
