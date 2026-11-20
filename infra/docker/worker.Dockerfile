# FILE: infra/docker/worker.Dockerfile
# PURPOSE: Production image for FLASHLIVE build workers.
# WHY: Workers need Node.js, tsx, Git and the Docker CLI to execute builds.
# HOW: Copies the Docker CLI from the official image, installs Git, then runs
# the worker workspace. Build containers themselves do not receive the socket.
# USED BY: docker-compose.yml and worker VPS deployments.

FROM docker:24-cli AS dockercli
FROM node:20-bookworm-slim AS base
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared packages/shared
COPY apps/worker apps/worker

RUN npm ci --workspace @flashlive/worker --include-workspace-root

CMD ["npm", "run", "start", "--workspace", "@flashlive/worker"]
