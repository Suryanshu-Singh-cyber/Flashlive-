# FLASHLIVE Database Design

PostgreSQL is the system of record. Migration: `database/migrations/001_init.sql`.

## Tables

- `users` — Firebase UID, email, display name, verification flag.
- `github_accounts` — one GitHub OAuth connection per user; stores encrypted access token only.
- `projects` — repository, branch, framework, constrained build/install commands, output dir, status.
- `project_env_vars` — encrypted frontend build variables.
- `deployments` — queue/build lifecycle, worker/slot/lease ownership, timestamps, durations, URL, error.
- `deployment_logs` — ordered persisted build logs with INFO/SUCCESS/WARNING/ERROR.
- `workers` — worker identity, heartbeat, active deployment/slot.
- `worker_slots` — global build capacity slots and current owner/lease.
- `recovery_events` — audit trail for lease recovery.
- `oauth_states` — hashed single-use GitHub OAuth states.
- `schema_migrations` — migration bookkeeping.

## Important constraints/indexes

- Unique `users.firebase_uid`, lower(email).
- Unique `github_accounts.user_id`.
- Unique project per user/repo/branch/name.
- Deployment status check constraint.
- `deployment_logs` unique `(deployment_id, sequence)`.
- Partial unique indexes:
  - one `building` deployment per worker
  - one `building` deployment per user
  - one `building` deployment per slot
  - one claimed slot per worker/deployment
- Queue selection index on `(status, created_at, id)`.

## Transactions

- Slot+job claim is one transaction.
- Deployment completion releases slot and updates project timestamp atomically.
- Reaper recovery locks deployment/slot rows before requeue/fail.
