/**
 * FILE: apps/worker/src/main.ts
 *
 * PURPOSE:
 * Starts the FLASHLIVE worker pool and recovery reaper.
 *
 * WHY THIS FILE EXISTS:
 * Separates process orchestration from individual worker loops and recovery.
 *
 * HOW IT WORKS:
 * Loads env, ensures worker slots exist, starts N WorkerLoop instances and the
 * reaper, then handles graceful shutdown.
 *
 * USED BY:
 * npm run dev/start inside apps/worker and production worker container.
 *
 * SECURITY:
 * Worker count is bounded by configured build slots; secrets stay in env.
 */

import 'dotenv/config';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { ensureWorkerSlots } from './queue/slotAllocator.js';
import { WorkerLoop } from './scheduler/workerLoop.js';
import { startReaper } from './recovery/reaper.js';

const workerCount = Math.min(env.FLASHLIVE_WORKER_CONCURRENCY, env.FLASHLIVE_BUILD_SLOTS);
const loops: WorkerLoop[] = [];
const reaper = startReaper();

await ensureWorkerSlots(env.FLASHLIVE_BUILD_SLOTS);
for (let index = 0; index < workerCount; index += 1) {
  const loop = new WorkerLoop(index);
  loops.push(loop);
  void loop.start();
}

console.log(JSON.stringify({
  level: 'info',
  message: 'FLASHLIVE worker pool started',
  workers: workerCount,
  slots: env.FLASHLIVE_BUILD_SLOTS,
}));

async function shutdown(signal: string) {
  console.log(JSON.stringify({ level: 'info', message: 'Worker shutdown requested', signal }));
  clearInterval(reaper);
  await Promise.all(loops.map((loop) => loop.stop()));
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
