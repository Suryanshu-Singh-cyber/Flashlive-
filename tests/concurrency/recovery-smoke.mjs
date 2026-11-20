/**
 * FILE: tests/concurrency/recovery-smoke.mjs
 *
 * PURPOSE:
 * Smoke-tests FLASHLIVE stale-lease recovery by planting a building deployment
 * with an expired heartbeat, then verifying reaper requeue and worker retry.
 *
 * USED BY:
 * Local verification while API/worker are running.
 *
 * SAFETY:
 * Uses only smoke-* test rows and releases any smoke-owned slots first.
 */

import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://flashlive:flashlive@localhost:5432/flashlive';
const REPO = 'octocat/Hello-World';
const pool = new pg.Pool({ connectionString: DATABASE_URL });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function cleanup(client) {
  await client.query(`UPDATE worker_slots SET status='available', worker_id=NULL, deployment_id=NULL, lease_token=NULL, released_at=NOW(), updated_at=NOW()
    WHERE deployment_id IN (SELECT id FROM deployments WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke-%@flashlive.test'))`);
  await client.query(`UPDATE workers SET active_deployment_id=NULL, active_slot_id=NULL, updated_at=NOW()
    WHERE active_deployment_id IN (SELECT id FROM deployments WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke-%@flashlive.test'))`);
  await client.query(`DELETE FROM recovery_events WHERE deployment_id IN (SELECT id FROM deployments WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke-%@flashlive.test'))`);
  await client.query(`DELETE FROM deployments WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke-%@flashlive.test')`);
  await client.query(`DELETE FROM projects WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'smoke-%@flashlive.test')`);
  await client.query(`DELETE FROM users WHERE email LIKE 'smoke-%@flashlive.test'`);
}

const client = await pool.connect();
try {
  await cleanup(client);
  const worker = await client.query(`SELECT id FROM workers ORDER BY name LIMIT 1`);
  const slot = await client.query(`SELECT id FROM worker_slots WHERE status='available' ORDER BY slot_index LIMIT 1`);
  if (!worker.rows[0] || !slot.rows[0]) throw new Error('No worker/slot available for recovery smoke.');

  const ts = Date.now();
  const user = await client.query(
    `INSERT INTO users(firebase_uid, email, display_name, email_verified) VALUES ($1,$2,$3,TRUE) RETURNING id`,
    [`smoke-recovery-${ts}`, `smoke-recovery-${ts}@flashlive.test`, 'Smoke Recovery'],
  );
  const project = await client.query(
    `INSERT INTO projects(user_id,name,repository_full_name,repository_id,branch,framework,build_command,install_command,output_directory,status)
     VALUES ($1,'Smoke Recovery',$2,910001,'master','react-vite','npm run build','npm ci','dist','active') RETURNING id`,
    [user.rows[0].id, REPO],
  );
  const deployment = await client.query(
    `INSERT INTO deployments(user_id,project_id,status,worker_id,slot_id,lease_token,attempt_count,branch,repository_full_name,project_name,queued_at,started_at,heartbeat_at)
     VALUES ($1,$2,'building',$3,$4,gen_random_uuid(),1,'master',$5,'Smoke Recovery',NOW()-INTERVAL '10 minutes',NOW()-INTERVAL '5 minutes',NOW()-INTERVAL '2 minutes')
     RETURNING id, lease_token`,
    [user.rows[0].id, project.rows[0].id, worker.rows[0].id, slot.rows[0].id, REPO],
  );
  const deploymentId = deployment.rows[0].id;
  const leaseToken = deployment.rows[0].lease_token;
  await client.query(
    `UPDATE worker_slots SET status='claimed', worker_id=$1, deployment_id=$2, lease_token=$3, claimed_at=NOW()-INTERVAL '5 minutes', released_at=NULL, updated_at=NOW() WHERE id=$4`,
    [worker.rows[0].id, deploymentId, leaseToken, slot.rows[0].id],
  );
  await client.query(`UPDATE workers SET active_deployment_id=$1, active_slot_id=$2, updated_at=NOW() WHERE id=$3`, [deploymentId, slot.rows[0].id, worker.rows[0].id]);

  let final = null;
  let recoveryCount = 0;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const row = await client.query(`SELECT status, attempt_count FROM deployments WHERE id=$1`, [deploymentId]);
    final = row.rows[0];
    const events = await client.query(`SELECT COUNT(*)::int AS count FROM recovery_events WHERE deployment_id=$1`, [deploymentId]);
    recoveryCount = events.rows[0].count;
    const claimed = await client.query(`SELECT COUNT(*)::int AS count FROM worker_slots WHERE status='claimed'`);
    if (['deployed', 'failed', 'cancelled'].includes(final.status) && claimed.rows[0].count === 0) break;
    await sleep(500);
  }
  const claimed = await client.query(`SELECT COUNT(*)::int AS count FROM worker_slots WHERE status='claimed'`);
  const ok = recoveryCount > 0 && final && ['deployed', 'failed', 'cancelled'].includes(final.status) && claimed.rows[0].count === 0;
  console.log(JSON.stringify({ ok, deploymentId, final, recoveryCount, claimedSlots: claimed.rows[0].count }, null, 2));
  process.exitCode = ok ? 0 : 1;
} finally {
  client.release();
  await pool.end();
}
