/**
 * FILE: packages/shared/src/types/index.ts
 *
 * PURPOSE:
 * Defines the shared domain model and API DTOs for FLASHLIVE.
 *
 * WHY THIS FILE EXISTS:
 * Frontend, API and worker must agree on deployment states, ownership fields
 * and response shapes without duplicating type definitions.
 *
 * HOW IT WORKS:
 * Exports TypeScript interfaces for persisted entities and safe public DTOs.
 * Secret-bearing fields are intentionally absent from public DTOs.
 *
 * USED BY:
 * API routes/services, worker scheduler, frontend services and pages.
 */

export type DeploymentStatus = 'queued' | 'building' | 'deployed' | 'failed' | 'cancelled';
export type DeploymentLogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
export type WorkerStatus = 'online' | 'offline' | 'stale';
export type ProjectStatus = 'active' | 'archived' | 'disabled';
export type ProjectFramework = 'react-vite';

export interface User {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser extends Omit<User, 'firebaseUid'> {}

export interface GitHubAccount {
  id: string;
  userId: string;
  githubUserId: number;
  githubLogin: string;
  githubEmail: string | null;
  scopes: string;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  userId: string;
  githubAccountId: string | null;
  name: string;
  repositoryFullName: string;
  repositoryId: number;
  branch: string;
  commitSha: string | null;
  framework: ProjectFramework;
  buildCommand: string;
  installCommand: string;
  outputDirectory: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  lastDeploymentAt: string | null;
}

export interface ProjectWithDeploymentSummary extends Project {
  latestDeployment: DeploymentSummary | null;
}

export interface Deployment {
  id: string;
  userId: string;
  projectId: string;
  status: DeploymentStatus;
  workerId: string | null;
  slotId: string | null;
  leaseToken: string | null;
  attemptCount: number;
  commitSha: string | null;
  branch: string;
  repositoryFullName: string;
  projectName: string;
  errorMessage: string | null;
  liveUrl: string | null;
  createdAt: string;
  queuedAt: string | null;
  startedAt: string | null;
  heartbeatAt: string | null;
  cancelRequestedAt: string | null;
  finishedAt: string | null;
  buildDurationMs: number | null;
  queueDurationMs: number | null;
}

export interface DeploymentSummary {
  id: string;
  projectId: string;
  status: DeploymentStatus;
  commitSha: string | null;
  liveUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  finishedAt: string | null;
  buildDurationMs: number | null;
}

export interface DeploymentLog {
  id: string;
  deploymentId: string;
  sequence: number;
  level: DeploymentLogLevel;
  message: string;
  createdAt: string;
}

export interface Worker {
  id: string;
  name: string;
  status: WorkerStatus;
  hostname: string | null;
  version: string | null;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  activeDeploymentId: string | null;
  activeSlotId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerSlot {
  id: string;
  workerId: string;
  slotIndex: number;
  status: 'available' | 'claimed' | 'stale';
  deploymentId: string | null;
  leaseToken: string | null;
  claimedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecoveryEvent {
  id: string;
  workerId: string | null;
  deploymentId: string | null;
  slotId: string | null;
  reason: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface QueueSnapshot {
  slots: Array<WorkerSlot & { worker: Worker | null; deployment: DeploymentSummary | null }>;
  queued: Deployment[];
  stats: {
    slotCount: number;
    activeBuilds: number;
    queuedBuilds: number;
    onlineWorkers: number;
    staleWorkers: number;
  };
}

export interface AnalyticsOverview {
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  cancelledDeployments: number;
  activeDeployments: number;
  queuedDeployments: number;
  successRate: number;
  averageBuildDurationMs: number | null;
  averageQueueDurationMs: number | null;
  recoveryEvents: number;
  workerUtilization: number;
}

export interface DailyDeploymentPoint {
  date: string;
  total: number;
  successful: number;
  failed: number;
}

export interface DeploymentAnalytics {
  overview: AnalyticsOverview;
  daily: DailyDeploymentPoint[];
  workers: Array<Worker & { activeBuilds: number; completedBuilds: number }>;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
