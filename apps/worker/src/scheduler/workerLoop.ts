/**
 * FILE: apps/worker/src/scheduler/workerLoop.ts
 *
 * PURPOSE:
 * Runs one FLASHLIVE build worker loop that claims deployments and executes
 * Docker builds.
 *
 * WHY THIS FILE EXISTS:
 * Each loop owns one worker identity and at most one active slot, allowing N
 * loops to provide N concurrent builds without duplicate ownership.
 *
 * HOW IT WORKS:
 * Polls claimNextDeployment, executes the deployment with LogShipper and
 * Docker runner, then reports terminal status through the API internal
 * completion endpoint.
 *
 * USED BY:
 * main.ts worker pool startup.
 *
 * SECURITY:
 * Uses lease tokens for heartbeats/completion; expired workers cannot publish.
 */

import type { ClaimedDeployment } from '../queue/slotAllocator.js';
import { claimNextDeployment, registerWorker } from '../queue/slotAllocator.js';
import { executeDeployment } from '../docker/dockerRunner.js';
import { LogShipper } from '../logs/logShipper.js';
import { completeDeployment } from '../api/client.js';
import { query } from '../db/pool.js';
import { env } from '../config/env.js';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WorkerLoop {
  private stopped = false;
  private workerId = '';
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(private readonly index: number) {}

  async start() {
    const registered = await registerWorker(`${env.FLASHLIVE_WORKER_NAME}-${this.index + 1}`);
    this.workerId = registered.id;
    this.heartbeatTimer = setInterval(() => {
      void query(`UPDATE workers SET last_heartbeat_at = NOW(), status = 'online', updated_at = NOW() WHERE id = $1`, [this.workerId]).catch(() => undefined);
    }, env.FLASHLIVE_HEARTBEAT_INTERVAL_MS);
    this.heartbeatTimer.unref();

    while (!this.stopped) {
      let claimed: ClaimedDeployment | null = null;
      try {
        claimed = await claimNextDeployment(this.workerId);
      } catch (error) {
        console.error(JSON.stringify({ level: 'error', message: 'Slot claim failed', error: error instanceof Error ? error.message : String(error) }));
        await sleep(env.FLASHLIVE_POLL_INTERVAL_MS);
        continue;
      }

      if (!claimed) {
        await sleep(env.FLASHLIVE_POLL_INTERVAL_MS);
        continue;
      }

      await this.processDeployment(claimed);
    }
  }

  private async processDeployment(deployment: ClaimedDeployment) {
    const shipper = new LogShipper(deployment.id, deployment.leaseToken, this.workerId);
    shipper.log('INFO', `Build claimed by ${env.FLASHLIVE_WORKER_NAME}-${this.index + 1}`);
    try {
      const result = await executeDeployment(deployment, this.workerId, shipper);
      await completeDeployment(
        deployment.id,
        deployment.leaseToken,
        result.outcome,
        result.errorMessage,
        result.buildDurationMs,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      shipper.log('ERROR', `Worker failed before completion: ${message}`);
      await shipper.close().catch(() => undefined);
      try {
        await completeDeployment(deployment.id, deployment.leaseToken, 'failed', message.slice(0, 3900));
      } catch (completionError) {
        console.error(JSON.stringify({
          level: 'error',
          message: 'Could not report deployment failure',
          deploymentId: deployment.id,
          error: completionError instanceof Error ? completionError.message : String(completionError),
        }));
      }
    }
  }

  async stop() {
    this.stopped = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.workerId) {
      await query(`UPDATE workers SET status = 'offline', updated_at = NOW() WHERE id = $1`, [this.workerId]).catch(() => undefined);
    }
  }
}
