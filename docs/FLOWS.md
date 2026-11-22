# FLASHLIVE Flows

End-to-end flows for auth, GitHub, deploy, logs and recovery. Short version first, then details.

## TL;DR

Firebase login → GitHub OAuth → pick repo → Deploy → PostgreSQL queue → worker claims slot → Docker builds React+Vite → logs stream via Socket.IO → static `dist` published to `/sites/<id>/` → live URL.

## 1. Authentication flow

```
Browser (Firebase SDK)                FLASHLIVE API                 PostgreSQL
      |  signInWithPopup/Email            |                            |
      |-- ID token ---------------------->| verifyIdToken(checkRevoked)|
      |                                   |-- upsert users ------------>|
      |<-- { user } ----------------------|                            |
```

- Frontend gets a Firebase ID token; `api.ts` attaches `Authorization: Bearer`.
- API verifies with Firebase Admin (`verifyIdToken(token, true)` — signature + expiry + revocation).
- `upsertUser` inserts by `firebase_uid`; if the email already exists under an old uid it relinks by `LOWER(email)` (handles provider/uid changes).
- On `401`, the client force-refreshes the token once and retries; persistent `401` clears the stale session.

## 2. GitHub OAuth flow

```
Dashboard -> GET /api/github/connect -> { url }
Browser -> github.com/login/oauth/authorize?client_id&redirect_uri&scope&state
GitHub -> GET /api/github/callback?code&state
API -> exchange code (client_secret) -> encrypt access_token (AES-GCM) -> github_accounts
API -> redirect WEB_ORIGIN/settings?github=connected
```

- `state` is random 32 bytes; only its SHA-256 hash is stored in `oauth_states` (10 min TTL, single-use).
- Access tokens are encrypted at rest and never returned to the client.

## 3. Deployment flow

```
POST /api/projects/:id/deployments
  -> deployment row (status=queued, branch/commit)
Worker loop:
  -> claim slot+job transactionally (FOR UPDATE SKIP LOCKED, fair per-user)
  -> lease token issued; heartbeat every 10s; lease 45s
  -> git clone --depth 1 (token via credential helper, never in URL/logs)
  -> detect app root: nearest package.json with react+vite deps (depth<=5)
  -> npm ci|install (dev deps included) in app root
  -> npm run build -- --base=./ in Docker (node, CapDrop ALL, no-new-privileges,
     mem=FLASHLIVE_BUILD_MEMORY_MB (default 2048), cpu/pids limits, timeout)
  -> publishArtifacts: copy dist -> /sites/<deploymentId>/ atomically (index.html required)
  -> API marks deployed; liveUrl=/sites/<id>/
Logs: worker -> POST internal log endpoint -> deployment_logs + Socket.IO room deployment:<id>
```

## 4. Log streaming flow

- Client joins `deployment:<id>` room (authenticated socket).
- Worker batches log lines to the API; API persists and emits `deployment:log` / `deployment:update`.
- UI renders persisted logs on load and live tail via socket.

## 5. Recovery flow

- Reaper scans every 15s for `building` deployments whose `lease_expires_at` passed.
- Releases the worker slot, increments `attempt_count` (max 2), requeues or marks `failed`.
- `recovery_events` records each recovery for audit/analytics.

## 6. Token summary

| Token | Issued by | Verified by | Storage |
|---|---|---|---|
| Firebase ID token | Firebase Auth | API (`verifyIdToken`) | Client memory only |
| GitHub access token | GitHub OAuth | GitHub API | AES-GCM encrypted in `github_accounts` |
| Worker lease token | API/DB claim | heartbeat/finalize | `deployments.lease_token` |
| Internal API token | env `INTERNAL_API_TOKEN` | `x-internal-token` header | env only |
| OAuth state | API random | sha256 hash in `oauth_states` | hashed only |
