# FLASHLIVE Viva Q&A (Conceptual)

Short, honest answers you can give in a viva.

## What is FLASHLIVE?

A GitHub-integrated deployment platform: push/import a React+Vite repo, FLASHLIVE builds it in Docker on a PostgreSQL-backed concurrent queue, streams logs in real time, and publishes the static site to a live URL.

## Why PostgreSQL for the queue instead of Redis?

- ACID transactions let us claim a slot **and** a job atomically (`FOR UPDATE SKIP LOCKED`), so two workers can never take the same job.
- Persistence survives restarts — queued/building state is durable, which we need for crash recovery and audit (`recovery_events`).
- One less moving part for a semester project; Redis would add infra without changing the core idea.

## How does concurrency work?

- `worker_slots` table = 3 global slots; `deployments` rows = jobs.
- A worker transaction locks a free slot + oldest fair queued job, assigns a `lease_token`, marks `building`.
- Heartbeat every 10s proves the worker is alive; lease expires after 45s.
- Reaper (15s) detects expired leases → releases slot → retry (max 2 attempts) → `failed`.

## Why Docker for builds?

Repolcontents are untrusted. Containers run as `node`, `CapDrop ALL`, `no-new-privileges`, CPU/memory/PID limits, no Docker socket, 5-min timeout — a malicious repo can’t touch the host.

## Authentication — what/why/how?

- **What:** Firebase Auth (email/password + Google). Backend verifies the Firebase ID token with Admin SDK (`verifyIdToken(token, true)` — checks signature, expiry and revocation).
- **Why:** never trust client-supplied user ids; the token is the identity.
- **How:** frontend attaches `Authorization: Bearer`; API upserts `users` by `firebase_uid` (relinks by email if uid changes). On `401` the client force-refreshes once; persistent `401` clears the session.

## Tokens — what/why/how?

- **Firebase ID token:** short-lived JWT proving identity; verified server-side.
- **GitHub access token:** obtained via OAuth, stored AES-GCM encrypted in `github_accounts`, used server-side only for clone/API.
- **Lease token:** proves a worker still owns a deployment for heartbeat/finalize (fencing against zombie workers).
- **Internal API token:** `x-internal-token` header guards worker→API endpoints.
- **OAuth state:** random value; only its SHA-256 hash is stored, single-use, 10-min TTL — prevents CSRF/replay.

## Why encrypt env vars and GitHub tokens?

They’re secrets. AES-GCM encryption at rest means a DB leak doesn’t expose them; masking keeps them out of logs.

## Why `vite build --base=./`?

Sites are served under `/sites/<id>/`, not root. A relative base makes asset URLs resolve correctly under any subpath.

## How do logs work?

Worker → internal API log endpoint → `deployment_logs` (persisted) + Socket.IO `deployment:<id>` room → live tail in UI. Persisted logs mean you can refresh and still see history.

## Security highlights

CORS allowlist, Helmet headers, rate limiting, hashed single-use OAuth state, encrypted secrets, masked logs, least-privilege containers, no secrets in client bundle (Firebase web config is public by design).

## Limitations to mention honestly

React+Vite static only; no backend runtime; per-user 1 active build / 10 queued / 25 projects; 3 global slots; 2 GB per build container; tunnels are demo-only.

## Likely viva questions

1. **Why not serverless/CI like Vercel?** FLASHLIVE is a learning platform showing queue scheduling, workers, leases and recovery — the concurrency/recovery story is the point.
2. **What happens if a worker crashes mid-build?** Lease expires → reaper releases slot → retry once → failed. Proven by `tests/concurrency/recovery-smoke.mjs`.
3. **How do you prevent two workers building the same job?** Transactional slot+job claim with `FOR UPDATE SKIP LOCKED` + unique constraints.
4. **How are secrets protected?** AES-GCM at rest, env-only injection, log masking.
5. **How does the frontend authenticate?** Firebase ID token → Bearer → Admin verification → upsert.
6. **How are logs real-time?** Socket.IO rooms per deployment + persisted `deployment_logs`.
7. **What’s the DB schema?** users, github_accounts, projects, project_env_vars, deployments, deployment_logs, workers, worker_slots, recovery_events, oauth_states (see `docs/DATABASE.md`).
8. **How do you handle untrusted code?** Docker isolation with dropped caps, resource limits, no socket, timeout.
9. **What’s the queue capacity?** 3 slots, fair per-user scheduling, 1 active build/user, 10 queued/user.
10. **What are the limitations?** Static React+Vite only, external backends needed for APIs, demo tunnels change URL.
