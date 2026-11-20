# FLASHLIVE API

Base URL: `/api`. Protected routes require `Authorization: Bearer <Firebase ID token>`.

## Auth/user

- `GET /api/auth/me` — current public user
- `PATCH /api/auth/me` — update display name

## GitHub

- `GET /api/github/connect` — returns OAuth URL
- `GET /api/github/callback` — OAuth callback, redirects to app
- `GET /api/github/status`
- `GET /api/github/repositories`
- `GET /api/github/repositories/:owner/:repo/branches`
- `DELETE /api/github/disconnect`

## Projects

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId` — archives project
- `GET|PUT|DELETE /api/projects/:projectId/env` — encrypted env vars

## Deployments

- `POST /api/projects/:projectId/deployments`
- `GET /api/deployments?projectId=&status=&limit=`
- `GET /api/deployments/:deploymentId`
- `POST /api/deployments/:deploymentId/cancel`
- `POST /api/deployments/:deploymentId/redeploy`
- `GET /api/deployments/:deploymentId/logs`

## Queue/workers/analytics

- `GET /api/queue`
- `GET /api/queue/statistics`
- `GET /api/workers`
- `GET /api/analytics/overview?days=30`
- `GET /api/analytics/deployments?days=30`
- `GET /api/analytics/workers?days=30`

## Internal worker endpoints

Require `x-internal-token` and `leaseToken` in body where applicable.

- `POST /api/internal/deployments/:id/logs`
- `POST /api/internal/deployments/:id/heartbeat`
- `POST /api/internal/deployments/:id/prepare-success`
- `POST /api/internal/deployments/:id/complete`
