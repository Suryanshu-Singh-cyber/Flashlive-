# FLASHLIVE Limitations & Capacity

Honest limits — know these before demo/viva.

## Per-user limits (enforced in API/shared constants)

| Limit | Value | Constant |
|---|---|---|
| Max projects per user | 25 | `MAX_PROJECTS_PER_USER` |
| Max queued deployments per user | 10 | `MAX_QUEUE_PER_USER` |
| Max active (building) deployments per user | 1 | `MAX_ACTIVE_BUILDS_PER_USER` |
| Max build attempts | 2 | `MAX_ATTEMPT_COUNT` |

Fair scheduling means your own projects queue behind each other, but different users share the 3 global slots.

## Global concurrency

- Build slots: **3** (`FLASHLIVE_BUILD_SLOTS`, `DEFAULT_BUILD_SLOT_COUNT`).
- Workers: **3** local workers (`FLASHLIVE_WORKER_CONCURRENCY`).
- So up to **3 deployments build concurrently**; the rest wait `queued`.
- Queue visualization shows slots, per-user fairness and stale-lease recovery.

## Build resources (per container)

- Memory: `FLASHLIVE_BUILD_MEMORY_MB`, default **2048 MB** (raised from 1 GB after Three.js/Vite SIGABRT).
- CPU: 1 vCPU (`NanoCpus=1e9`), PID limit 128, `CapDrop ALL`, `no-new-privileges`, no Docker socket, bridge network only.
- Timeout: `FLASHLIVE_BUILD_TIMEOUT_MS`, default **5 min per step** (install and build separately).
- npm cache is persisted on host (`FLASHLIVE_NPM_CACHE_DIR`, default `./.npm-cache`) — repeat builds are faster.

### Memory math for your machine

- 3 concurrent builds × 2 GB ≈ **6 GB** for containers, plus API/worker/Postgres/Docker overhead.
- Docker Desktop should have **≥ 8 GB** allocated or builds may OOM/SIGABRT. Lower `FLASHLIVE_BUILD_WORKER_CONCURRENCY`/slots or `FLASHLIVE_BUILD_MEMORY_MB` on small machines.

## Functional limitations

- **React + Vite static sites only.** No Next.js SSR, no Node/Python backends, no databases, no websockets hosted.
- Backend-dependent apps need their own API (`VITE_API_URL`, etc.) set as project env vars.
- Only the `dist` output is hosted; `vite build --base=./` is used so assets work under `/sites/<id>/`.
- App-root auto-detection covers `package.json` with `react`+`vite` up to depth 5; monorepos with multiple frontends pick the shallowest match.
- No custom domains, rollback, or preview deployments yet.
- Quick tunnels (trycloudflare) change URL each restart; login/GitHub OAuth need a permanent domain.

## Operational limits

- Build logs are streamed and persisted; very large outputs are truncated in UI but stored.
- Worker lease 45s + heartbeat 10s; if a worker dies mid-build the reaper recovers within ~15s and retries once.
- Secrets: env vars encrypted AES-GCM; GitHub tokens encrypted; secrets masked from logs.
