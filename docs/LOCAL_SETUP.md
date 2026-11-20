# FLASHLIVE Local Setup

## Prerequisites

- Node.js >= 20
- npm
- Docker Desktop or Docker Engine for worker builds
- PostgreSQL (local or Docker)
- Firebase project and GitHub OAuth App for full auth/repo features

## 1. Install

```bash
npm install
cp .env.example .env
```

Fill `.env` and app-level `.env.example` files.

## 2. Database

```bash
npm run db:migrate
npm run db:seed
```

Or use Docker Compose, which runs migrations automatically.

## 3. Run services

```bash
npm run dev:api      # http://localhost:4000
npm run dev:worker   # claims jobs and runs Docker builds
npm run dev:web      # http://localhost:5173
```

For containerized infra:

```bash
docker compose up --build
# web: http://localhost:8080
```

## 4. Worker Docker access

The worker needs permission to run sibling Docker containers. In Compose this is `/var/run/docker.sock`. On a VPS, run the worker on a Docker-capable host and keep the daemon private.

If Docker pulls fail with `docker-credential-desktop` missing, pull public images once with an empty Docker config, then run Compose against the already-local images:

```bash
mkdir -p /tmp/flashlive-docker-config
printf '{}' > /tmp/flashlive-docker-config/config.json
DOCKER_CONFIG=/tmp/flashlive-docker-config docker pull postgres:16-alpine
docker compose up -d db
```

## 5. Verify

- `GET http://localhost:4000/api/health`
- Sign in, connect GitHub, import a React + Vite repo, deploy, watch `/queue` and `/deployments/:id`.
