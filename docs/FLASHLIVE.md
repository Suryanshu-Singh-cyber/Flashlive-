# FLASHLIVE — One-Page Documentation

**Deploy smarter. Build concurrently. Recover automatically.**

FLASHLIVE is a GitHub-integrated deployment platform for **React + Vite** apps: import a repo, build it in an isolated Docker worker on a PostgreSQL-backed concurrent queue, stream logs live, and publish the static site to a live URL.

## Tech stack (what / why / how)

| Layer | Tech | Why | How |
|---|---|---|---|
| Frontend | React + TS + Vite + Tailwind + Framer Motion + Three.js + Socket.IO + Recharts | Animated SaaS dashboard, live logs, analytics | `apps/web` → `localhost:5173` |
| API | Node + Express + TS + PostgreSQL + Firebase Admin + Socket.IO + Zod + Helmet | REST, auth, OAuth, queue reads, worker endpoints, real-time logs | `apps/api` → `localhost:4000` |
| Worker | Node + TS + PostgreSQL + Docker + Git | Claims jobs, clones, builds in Docker, streams logs, heartbeats | `apps/worker` (3 workers, 3 slots) |
| DB | PostgreSQL 16 | ACID queue (`FOR UPDATE SKIP LOCKED`), persistence, recovery audit | Docker `flashlive-db-1` |
| Infra | Docker Compose + Nginx | Containerized build isolation + static hosting | `infra/`, `docker-compose.yml` |
| Auth | Firebase Auth (email + Google) | Managed auth, ID tokens | Web SDK → `Authorization: Bearer` → Admin `verifyIdToken` |
| GitHub | OAuth App | Repo access without passwords | Encrypted token in `github_accounts` |

## How it works (flow)

```
Sign in (Firebase) → Connect GitHub (OAuth) → Import repo → Set env vars → Deploy
→ queued in PostgreSQL → worker claims slot+job atomically → git clone
→ detect Vite app root → npm ci → vite build --base=./ in Docker (2 GB cap)
→ publish dist to /sites/<id>/ → live URL + streamed logs
```

- **Concurrency:** 3 global build slots, fair per-user scheduling, 1 active build/user, 10 queued/user, max 25 projects/user.
- **Recovery:** heartbeat 10s, lease 45s, reaper 15s → retry once → failed. `recovery_events` audits it.
- **Logs:** worker → API → `deployment_logs` + Socket.IO room → live tail + persisted history.

## Auth & tokens

- **Firebase ID token** — proves identity; verified server-side (signature + expiry + revocation). Client force-refreshes once on 401.
- **GitHub access token** — OAuth exchange, AES-GCM encrypted at rest, server-side only.
- **Lease token** — worker ownership/fencing for heartbeat & finalize.
- **Internal API token** — `x-internal-token` guards worker→API endpoints.
- **OAuth state** — random, SHA-256 hashed, single-use, 10-min TTL (CSRF/replay protection).
- **Env vars** — AES-GCM encrypted in `project_env_vars`, injected at build time, masked in logs.

## API surface (short)

- `POST /api/auth/*` — Firebase token → user upsert/me
- `GET/POST /api/github/*` — connect, callback, repos, branches
- `GET/POST /api/projects*` — CRUD, env vars
- `GET/POST /api/deployments*` — create, list, logs, cancel, redeploy
- `GET /api/analytics/overview` — dashboard metrics
- `GET /api/health` — liveness
- Internal (worker): claim/heartbeat/logs/finalize via `x-internal-token`
- Full reference: `docs/API.md`

## Database (short)

`users`, `github_accounts`, `projects`, `project_env_vars`, `deployments`, `deployment_logs`, `workers`, `worker_slots`, `recovery_events`, `oauth_states`. Migrations in `database/migrations`, seed `database/seed.sql`. Details: `docs/DATABASE.md`.

## Security

CORS allowlist, Helmet, rate limit, hashed single-use OAuth state, AES-GCM secrets, masked logs, least-privilege containers (`CapDrop ALL`, `no-new-privileges`, no Docker socket, CPU/mem/PID limits, 5-min timeout). Details: `docs/SECURITY.md`.

## Limits (honest)

- React+Vite **static** only — no backend runtime; apps needing APIs must set `VITE_API_URL` etc.
- 2 GB memory per build container → ~6 GB for 3 concurrent; Docker Desktop ≥ 8 GB recommended.
- Build timeout 5 min/step; app-root auto-detect depth ≤ 5.
- Quick tunnels change URL each restart; login/GitHub OAuth need a permanent domain for public use.

## Run from code

```bash
npm install
cp .env.example .env            # fill Firebase + GitHub OAuth + secrets
npm run db:migrate && npm run db:seed
npm run dev:api                 # :4000
npm run dev:worker              # 3 workers
npm run dev:web                 # :5173
```

Or `docker compose up --build` → `http://localhost:8080`.

## Sharing publicly

`localhost` links only work on your machine. For demos use a tunnel (`docs/PUBLIC_SHARING.md`): `cloudflared tunnel --url http://localhost:5173`. Permanent public deploy needs a domain + Firebase authorized domain + GitHub callback update.

## Docs index

`USER_GUIDE` (usage) · `FLOWS` (sequence detail) · `LIMITATIONS` (capacity) · `PUBLIC_SHARING` (tunnels) · `VIVA_QA` (viva questions) · `API` / `DATABASE` / `SECURITY` / `QUEUE_AND_RECOVERY` / `ARCHITECTURE` / `TESTING` / `LOCAL_SETUP` / `FILE_BY_FILE_GUIDE`
