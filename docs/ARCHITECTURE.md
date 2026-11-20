# FLASHLIVE Architecture

## System overview

```text
Browser (React SPA)
  -> Vite dev server or Nginx static host
  -> Express API (/api, /socket.io)
       -> Firebase Admin token verification
       -> PostgreSQL (users, projects, deployments, logs, workers, slots)
       -> GitHub OAuth/API
  -> Worker pool (Node.js processes)
       -> PostgreSQL slot/job claiming
       -> Git clone + Docker build containers
       -> internal API callbacks for logs/heartbeat/completion
  -> Nginx static artifact hosting (/sites/<deployment-id>/)
```

## Request flow

1. User signs in with Firebase on the web app.
2. API verifies the Firebase ID token with Firebase Admin and upserts `users`.
3. User connects GitHub OAuth; API stores an encrypted token in `github_accounts`.
4. User imports a repository as a `projects` row.
5. `POST /api/projects/:id/deployments` resolves the branch commit and inserts a `queued` deployment.
6. Worker loops transactionally claim one available `worker_slots` row and one fair queued deployment.
7. Worker clones the repo, runs constrained npm commands in Docker, streams logs to API internal endpoints, publishes artifacts atomically, then calls the fenced completion endpoint.
8. API marks the deployment terminal, releases the slot and emits Socket.IO events.

## Concurrency model

- `worker_slots` are global capacity rows (default 3).
- A worker claims slot + deployment in one PostgreSQL transaction.
- `FOR UPDATE SKIP LOCKED` avoids lock contention between workers.
- Unique partial indexes prevent two active builds per worker, per user and per slot.
- Lease tokens fence stale workers; the reaper recovers expired leases.

## Security boundaries

- Browser never receives GitHub tokens or encrypted env values.
- Firebase verifies identity; PostgreSQL stores profile/deployment data.
- Build containers run as `node`, drop capabilities, have no Docker socket, CPU/memory/PID limits and timeout.
- Nginx serves only published artifact directories.
