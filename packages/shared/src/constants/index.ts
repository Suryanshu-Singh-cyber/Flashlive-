/**
 * FILE: packages/shared/src/constants/index.ts
 *
 * PURPOSE:
 * Centralizes FLASHLIVE operational constants shared by API, worker and UI.
 *
 * WHY THIS FILE EXISTS:
 * Prevents drift between queue capacity, timeout policy, retry limits and
 * UI status labels.
 *
 * HOW IT WORKS:
 * Exports immutable configuration values and status transition metadata.
 *
 * USED BY:
 * API validation, worker scheduler/recovery, frontend labels and tests.
 */

import type { DeploymentStatus } from '../types/index.js';

export const FLASHLIVE_NAME = 'FLASHLIVE';
export const DEFAULT_BUILD_SLOT_COUNT = 3;
export const MAX_ATTEMPT_COUNT = 2;
export const BUILD_TIMEOUT_MS = 5 * 60 * 1000;
export const WORKER_HEARTBEAT_INTERVAL_MS = 10 * 1000;
export const WORKER_LEASE_DURATION_MS = 45 * 1000;
export const RECOVERY_SCAN_INTERVAL_MS = 15 * 1000;
export const MAX_QUEUE_PER_USER = 10;
export const MAX_ACTIVE_BUILDS_PER_USER = 1;
export const MAX_PROJECTS_PER_USER = 25;

export const DEPLOYMENT_STATUSES: DeploymentStatus[] = ['queued', 'building', 'deployed', 'failed', 'cancelled'];

export const DEPLOYMENT_STATUS_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  queued: ['building', 'cancelled', 'failed'],
  building: ['deployed', 'failed', 'cancelled'],
  deployed: [],
  failed: ['queued'],
  cancelled: ['queued'],
};

export const LOG_LEVELS = ['INFO', 'SUCCESS', 'WARNING', 'ERROR'] as const;

export const SUPPORTED_FRAMEWORK = 'react-vite';
export const DEFAULT_BUILD_COMMAND = 'npm run build';
export const DEFAULT_INSTALL_COMMAND = 'npm ci';
export const DEFAULT_OUTPUT_DIRECTORY = 'dist';

export const PUBLIC_SITE_PATH_PREFIX = '/sites';
