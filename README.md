# FLASHLIVE

**Deploy smarter. Build concurrently. Recover automatically.**

FLASHLIVE is a GitHub-integrated deployment platform for React + Vite applications. It combines Firebase Authentication, GitHub OAuth, PostgreSQL-backed job scheduling, Docker build workers, Socket.IO log streaming and Nginx static hosting.

## Stack

- Web: React, TypeScript, Vite, Tailwind CSS, Framer Motion, Three.js, Socket.IO Client, Recharts
- API: Node.js, Express, TypeScript, PostgreSQL, Firebase Admin, Socket.IO, Zod, Helmet
- Worker: Node.js, TypeScript, PostgreSQL, Docker, Git
- Infra: Docker Compose, Nginx, PostgreSQL

## Quick start

```bash
npm install
cp .env.example .env
# Fill Firebase, GitHub OAuth and encryption values.
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:worker
npm run dev:web
```

Open `http://localhost:5173`.

For full containerized local infrastructure:

```bash
docker compose up --build
```

Then open `http://localhost:8080`.

## Required credentials

- Firebase Web SDK config (`VITE_FIREBASE_*`)
- Firebase Admin credentials (`FIREBASE_*`)
- GitHub OAuth App (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, callback URL)
- `TOKEN_ENCRYPTION_KEY` and `INTERNAL_API_TOKEN` random secrets

See `.env.example`, `apps/web/.env.example`, `apps/api/.env.example` and `apps/worker/.env.example`.

## Repository map

- `apps/web` — animated React frontend and dashboard
- `apps/api` — REST API, auth, GitHub OAuth, queue reads, internal worker endpoints, Socket.IO
- `apps/worker` — PostgreSQL slot claiming, Docker builds, logs, heartbeat and recovery
- `packages/shared` — shared types, constants, schemas and encryption helpers
- `database` — SQL migrations and seeds
- `infra` — Dockerfiles, Compose and Nginx config
- `docs` — architecture, security, API, queue/recovery, testing and viva docs

## Documentation

**One-page overview:** `docs/FLASHLIVE.md` — read this first.

- Start here: `docs/USER_GUIDE.md` (how anyone uses it), `docs/LOCAL_SETUP.md` (run from code)
- How it works: `docs/ARCHITECTURE.md`, `docs/FLOWS.md`, `docs/DATABASE.md`, `docs/QUEUE_AND_RECOVERY.md`
- API & security: `docs/API.md`, `docs/SECURITY.md`
- Capacity & limits: `docs/LIMITATIONS.md`
- Sharing publicly: `docs/PUBLIC_SHARING.md`
- Testing & viva: `docs/TESTING.md`, `docs/VIVA_PREPARATION.md`, `docs/VIVA_QA.md`, `docs/FILE_BY_FILE_GUIDE.md`
