# FILE: infra/docker/web.Dockerfile
# PURPOSE: Builds the FLASHLIVE React app and serves it through Nginx.
# WHY: Separates static frontend hosting from the API and workers.
# HOW: Multi-stage Node build followed by a small Nginx runtime image.
# USED BY: docker-compose.yml and frontend deployment.

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared packages/shared
COPY apps/web apps/web

RUN npm ci --workspace @flashlive/web --include-workspace-root \
  && npm run build --workspace @flashlive/web

FROM nginx:1.27-alpine
COPY infra/nginx/flashlive.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
