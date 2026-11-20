/**
 * FILE: apps/worker/src/logs/logShipper.ts
 *
 * PURPOSE:
 * Batches and ships build log lines to the FLASHLIVE API.
 *
 * WHY THIS FILE EXISTS:
 * Docker output must be persisted in PostgreSQL and pushed to Socket.IO rooms
 * through the API's internal endpoints.
 *
 * HOW IT WORKS:
 * Buffers ordered log entries per deployment, flushes on interval or explicit
 * flush, and retries once on transient failure.
 *
 * USED BY:
 * Docker runner and worker scheduler.
 *
 * SECURITY:
 * Sends the internal token server-to-server; callers must mask secrets before
 * enqueueing messages.
 */

import type { DeploymentLogLevel } from '@flashlive/shared';
import { env } from '../config/env.js';

interface PendingLog {
  sequence: number;
  level: DeploymentLogLevel;
  message: string;
}

export class LogShipper {
  private sequence = 0;
  private buffer: PendingLog[] = [];
  private timer: NodeJS.Timeout;
  private flushing = false;

  constructor(
    private readonly deploymentId: string,
    private readonly leaseToken: string,
    private readonly workerId: string,
  ) {
    this.timer = setInterval(() => void this.flush(), 750);
    this.timer.unref();
  }

  log(level: DeploymentLogLevel, message: string) {
    const clean = message.replace(/\s+/g, ' ').trim().slice(0, 7900);
    if (!clean) return;
    this.sequence += 1;
    this.buffer.push({ sequence: this.sequence, level, message: clean });
    if (this.buffer.length > 1000) this.buffer.splice(0, this.buffer.length - 1000);
    if (this.buffer.length >= 25) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;
    const batch = this.buffer.splice(0, 200);
    try {
      const response = await fetch(`${env.API_INTERNAL_URL}/api/internal/deployments/${this.deploymentId}/logs`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': env.INTERNAL_API_TOKEN,
        },
        body: JSON.stringify({ leaseToken: this.leaseToken, logs: batch }),
      });
      if (!response.ok && response.status !== 202) {
        this.buffer.unshift(...batch);
      }
    } catch {
      this.buffer.unshift(...batch);
    } finally {
      this.flushing = false;
    }
  }

  async close(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
  }
}
