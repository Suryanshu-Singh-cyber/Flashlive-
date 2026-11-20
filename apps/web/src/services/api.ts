/**
 * FILE: apps/web/src/services/api.ts
 *
 * PURPOSE:
 * Provides the typed FLASHLIVE API client used by all frontend features.
 *
 * WHY THIS FILE EXISTS:
 * Centralizes base URL, Firebase bearer-token injection, error normalization
 * and endpoint methods.
 *
 * HOW IT WORKS:
 * Axios attaches the current Firebase ID token to protected requests and
 * exposes resource-specific methods.
 *
 * USED BY:
 * AuthContext, GitHub/project/deployment/queue/analytics/profile features.
 *
 * SECURITY:
 * Tokens come from Firebase Auth, never localStorage or URL parameters.
 */

import axios, { AxiosError } from 'axios';
import { auth } from '@/lib/firebase';
import type {
  Deployment,
  DeploymentLog,
  Project,
  PublicUser,
  QueueSnapshot,
  DeploymentAnalytics,
  Worker,
} from '@flashlive/shared';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 20_000,
});

let authTokenGetter: ((forceRefresh?: boolean) => Promise<string | undefined>) | null = null;

export function setAuthTokenGetter(getter: ((forceRefresh?: boolean) => Promise<string | undefined>) | null) {
  authTokenGetter = getter;
}

api.interceptors.request.use(async (config) => {
  const token = authTokenGetter ? await authTokenGetter() : await auth?.currentUser?.getIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
  if (error.response?.status === 401 && config && !config._retry) {
    config._retry = true;
    const token = authTokenGetter
      ? await authTokenGetter(true).catch(() => undefined)
      : await auth?.currentUser?.getIdToken(true).catch(() => undefined);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      return api(config);
    }
  }
  return Promise.reject(error);
});

export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = (error as AxiosError<{ error?: { message?: string } }>).response?.data;
    return data?.error?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'Unexpected error.';
}

export const apiService = {
  me: () => api.get<{ user: PublicUser }>('/api/auth/me').then((r) => r.data.user),
  updateMe: (displayName: string) => api.patch('/api/auth/me', { displayName }).then((r) => r.data.user),

  githubStatus: () => api.get('/api/github/status').then((r) => r.data),
  githubConnect: () => api.get<{ url: string }>('/api/github/connect').then((r) => r.data.url),
  githubRepositories: () => api.get('/api/github/repositories').then((r) => r.data.repositories),
  githubBranches: (owner: string, repo: string) => api.get(`/api/github/repositories/${owner}/${repo}/branches`).then((r) => r.data.branches),
  githubDisconnect: () => api.delete('/api/github/disconnect'),

  projects: () => api.get<{ projects: Project[] }>('/api/projects').then((r) => r.data.projects),
  project: (id: string) => api.get<{ project: Project }>(`/api/projects/${id}`).then((r) => r.data.project),
  createProject: (payload: unknown) => api.post<{ project: Project }>('/api/projects', payload).then((r) => r.data.project),
  updateProject: (id: string, payload: unknown) => api.patch<{ project: Project }>(`/api/projects/${id}`, payload).then((r) => r.data.project),
  deleteProject: (id: string) => api.delete(`/api/projects/${id}`),
  projectEnv: (id: string) => api.get<{ variables: Array<{ key: string; updatedAt: string }> }>(`/api/projects/${id}/env`).then((r) => r.data.variables),
  saveProjectEnv: (id: string, variables: Array<{ key: string; value: string }>) => api.put(`/api/projects/${id}/env`, { variables }),

  deployments: (filters: { projectId?: string; status?: string } = {}) => api.get<{ deployments: Deployment[] }>('/api/deployments', { params: filters }).then((r) => r.data.deployments),
  deployment: (id: string) => api.get<{ deployment: Deployment }>(`/api/deployments/${id}`).then((r) => r.data.deployment),
  deployProject: (projectId: string, payload: unknown = {}) => api.post<{ deployment: Deployment }>(`/api/projects/${projectId}/deployments`, payload).then((r) => r.data.deployment),
  cancelDeployment: (id: string) => api.post<{ deployment: Deployment }>(`/api/deployments/${id}/cancel`).then((r) => r.data.deployment),
  redeploy: (id: string) => api.post<{ deployment: Deployment }>(`/api/deployments/${id}/redeploy`).then((r) => r.data.deployment),
  deploymentLogs: (id: string) => api.get<{ logs: DeploymentLog[] }>(`/api/deployments/${id}/logs`).then((r) => r.data.logs),

  queue: () => api.get<QueueSnapshot>('/api/queue').then((r) => r.data),
  workers: () => api.get<{ workers: Worker[] }>('/api/workers').then((r) => r.data.workers),
  analytics: (days = 30) => api.get<{ analytics: DeploymentAnalytics }>('/api/analytics/overview', { params: { days } }).then((r) => r.data.analytics),
};
