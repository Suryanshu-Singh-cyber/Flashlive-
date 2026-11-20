# FLASHLIVE File-By-File Guide

This is a living index. Every authored source file has a header comment; this guide explains purpose and flow.

## Root/config

- `package.json` — npm workspaces, scripts, dev deps.
- `tsconfig.base.json` — strict shared TS config.
- `pnpm-workspace.yaml` — workspace compatibility for pnpm users.
- `.gitignore` — excludes env, node_modules, artifacts, workspaces.
- `.env.example`, `apps/*/.env.example` — credential templates.
- `docker-compose.yml` — db/migrate/api/worker/web orchestration.

## packages/shared

- `src/index.ts` — exports types/constants/schemas.
- `src/types/index.ts` — domain/API DTOs.
- `src/constants/index.ts` — slots, timeouts, statuses.
- `src/schemas/index.ts` — Zod validation for projects/env/deploys.
- `src/crypto.ts` — AES-256-GCM secret encryption for API/worker.

## apps/api

- `src/config/env.ts` — validated API env.
- `src/db/pool.ts` — pg pool + transaction helper.
- `src/common/logger.ts`, `errors.ts` — structured logs and error handling.
- `src/middleware/auth.ts` — Firebase verify, user upsert, internal token.
- `src/middleware/validate.ts` — Zod request validation.
- `src/modules/auth/routes.ts` — `/api/auth/me`.
- `src/modules/github/service.ts` — OAuth state, token exchange, encrypted storage, GitHub API.
- `src/modules/github/routes.ts` — connect/callback/status/repos/branches/disconnect.
- `src/modules/projects/service.ts` — ownership, GitHub verification, project CRUD.
- `src/modules/projects/routes.ts` — project + encrypted env endpoints.
- `src/modules/deployments/service.ts` — enqueue/list/cancel/redeploy/logs.
- `src/modules/deployments/routes.ts` — deployment HTTP routes.
- `src/modules/queue/service.ts` — slot/queue snapshot SQL.
- `src/modules/queue/routes.ts` — queue/workers read APIs.
- `src/modules/analytics/service.ts` — real SQL aggregates/charts data.
- `src/modules/analytics/routes.ts` — analytics endpoints.
- `src/modules/workers/routes.ts` — internal logs/heartbeat/prepare/complete with lease fencing.
- `src/sockets/index.ts` — Socket.IO auth, rooms, deployment watch.
- `src/app.ts`, `server.ts` — Express wiring and startup.

## apps/worker

- `src/config/env.ts`, `src/db/pool.ts` — worker env and pg access.
- `src/queue/slotAllocator.ts` — transactional slot+job claim, worker registration.
- `src/scheduler/workerLoop.ts` — poll/claim/execute/complete loop.
- `src/docker/dockerRunner.ts` — clone, Docker install/build, logs, artifact publish, heartbeat/cancel.
- `src/logs/logShipper.ts` — batched log POSTs to API.
- `src/api/client.ts` — internal heartbeat/prepare/complete calls.
- `src/artifacts/publisher.ts` — atomic artifact directory publish.
- `src/recovery/reaper.ts` — stale lease detection, slot release, requeue/fail, recovery events.
- `src/main.ts` — starts N worker loops + reaper.

## apps/web

- `src/styles/index.css`, `tailwind.config.js` — design tokens/utilities.
- `src/lib/firebase.ts`, `utils.ts` — Firebase client and helpers.
- `src/services/api.ts`, `socket.ts` — API client and Socket.IO client.
- `src/features/auth/AuthContext.tsx`, `ProtectedRoute.tsx` — auth state and guard.
- `src/components/ui/*` — Button/Input/Card/Badge/Spinner/Logo.
- `src/components/animations/Reveal.tsx` — Framer Motion reveals/stagger/section headings.
- `src/components/three/DeploymentEngine.tsx`, `ParticleField.tsx` — Three.js engine and canvas particles.
- `src/components/terminal/LogTerminal.tsx` — persistent/live log terminal.
- `src/layouts/PublicLayout.tsx`, `DashboardLayout.tsx` — public and app shells.
- `src/pages/landing/LandingPage.tsx` — marketing page.
- `src/pages/auth/*` — login/register/forgot/verify.
- `src/pages/dashboard|projects|deployments|queue|analytics|settings|profile` — authenticated pages.
- `src/pages/static/StaticPages.tsx` — docs/contact/privacy/terms.
- `src/app/*`, `main.tsx` — providers, router, bootstrap.

## database/infra/tests/docs

- `database/migrations/001_init.sql` — full schema.
- `database/scripts/migrate.mjs`, `seed.mjs` — migration/seed runners.
- `infra/docker/*.Dockerfile`, `infra/nginx/flashlive.conf` — containers and static hosting.
- `tests/*` — test plan and future suites.
- `docs/*` — architecture/security/API/queue/testing/viva docs.
