# FILE: infra/docker/api.Dockerfile
# PURPOSE: Production image for the FLASHLIVE Express API.
# WHY: Keeps API dependencies and runtime isolated from the worker.
# HOW: Installs workspace dependencies and runs the TypeScript API with tsx.
# USED BY: docker-compose.yml and production API deployments.

FROM node:20-bookworm-slim AS base
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared packages/shared
COPY apps/api apps/api

RUN npm ci --workspace @flashlive/api --include-workspace-root

EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "@flashlive/api"]
