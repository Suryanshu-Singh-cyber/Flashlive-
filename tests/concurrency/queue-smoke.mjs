/**
 * FILE: tests/concurrency/queue-smoke.mjs
 *
 * PURPOSE:
 * Smoke-tests FLASHLIVE queue claiming, slot release and terminal completion
 * using synthetic users/projects/deployments.
 *
 * USED BY:
 * Local verification while API/worker are running.
 *
 * SAFETY:
 * Uses only smoke-* test rows and a public repo; deletes prior smoke rows first.
 */

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://flashlive:flashlive@localhost:5432/flashlive';
const COUNT = Number(process.env.SMOKE_COUNT ?? 5);
const REPO = 'octocat/Hello-World';
const pool = new pg.Pool({ connectionString: DATABASE_URL });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanup(client) {
  await client.query(`DELETE FROM deployments WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke-%@flashlive.test')`);
  await client.query(`DELETE FROM projects WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke-%@flashlive.test')`);
  await client.query(`DELETE FROM users WHERE email LIKE 'smoke-%@flashlive.test'`);
}

async function seed(client) {
  const ts = Date.now();
  const ids = [];
  for (let i = 0; i < COUNT; i += 1) {
    const user = await client.query(
      `INSERT INTO users(firebase_uid, email, display_name, email_verified)
       VALUES ($1, $2, $3, TRUE) RETURNING id`,
      [`smoke-${ts}-${i}`, `smoke-${i}-${ts}@flashlive.test`, `Smoke User ${i}`],
    );
    const project = await client.query(
      `INSERT INTO projects(user_id, name, repository_full_name, repository_id, branch, framework, build_command, install_command, output_directory, status)
       VALUES ($1, $2, $3, $4, 'master', 'react-vite', 'npm run build', 'npm ci', 'dist', 'active')
       RETURNING id`,
      [user.rows[0].id, `Smoke Project ${i}`, REPO, 900000 + i],
    );
    const deployment = await client.query(
      `INSERT INTO deployments(user_id, project_id, status, branch, repository_full_name, project_name, queued_at)
       VALUES ($1, $2, 'queued', 'master', $3, $4, NOW()) RETURNING id`,
      [user.rows[0].id, project.rows[0].id, REPO, `Smoke Project ${i}`],
    );
    ids.push(deployment.rows[0].id);
  }
  return ids;
}

async function snapshot(client, ids) {
  const status = await client.query(
    `SELECT status, COUNT(*)::int AS count FROM deployments WHERE id = ANY($1::uuid[]) GROUP BY status`,
    [ids],
  );
  const counts = Object.fromEntries(status.rows.map((row) => [row.status, row.count]));
  const claimed = await client.query(`SELECT COUNT(*)::int AS count FROM worker_slots WHERE status = 'claimed'`);
  const logs = await client.query(`SELECT COUNT(*)::int AS count FROM deployment_logs WHERE deployment_id = ANY($1::uuid[])`, [ids]);
  const recovery = await client.query(`SELECT COUNT(*)::int AS count FROM recovery_events WHERE deployment_id = ANY($1::uuid[])`, [ids]);
  return {
    queued: counts.queued ?? 0,
    building: counts.building ?? 0,
    deployed: counts.deployed ?? 0,
    failed: counts.failed ?? 0,
    cancelled: counts.cancelled ?? 0,
    claimedSlots: claimed.rows[0].count,
    logs: logs.rows[0].count,
    recoveryEvents: recovery.rows[0].count,
  };
}

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await cleanup(client);
  await client.query('COMMIT');
  const ids = await seed(client);
  let maxBuilding = 0;
  let maxClaimedSlots = 0;
  let finalSnapshot = null;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    finalSnapshot = await snapshot(client, ids);
    maxBuilding = Math.max(maxBuilding, finalSnapshot.building);
    maxClaimedSlots = Math.max(maxClaimedSlots, finalSnapshot.claimedSlots);
    if (finalSnapshot.queued + finalSnapshot.building === 0) break;
    await sleep(250);
  }
  finalSnapshot = await snapshot(client, ids);
  const ok = maxBuilding <= 3 && finalSnapshot.claimedSlots === 0 && finalSnapshot.logs > 0 &&
    finalSnapshot.queued + finalSnapshot.building === 0 && (finalSnapshot.failed + finalSnapshot.deployed + finalSnapshot.cancelled) === COUNT;
  console.log(JSON.stringify({ ok, maxBuilding, maxClaimedSlots, final: finalSnapshot }, null, 2));
  process.exitCode = ok ? 0 : 1;
} finally {
  client.release();
  await pool.end();
}
