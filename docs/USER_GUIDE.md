# FLASHLIVE User Guide

How anyone uses FLASHLIVE end-to-end: sign in → connect GitHub → import a repo → configure env vars → deploy → watch logs → open the live site.

## 1. Prerequisites

FLASHLIVE must be running (see `docs/LOCAL_SETUP.md`):

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Worker pool: 3 workers / 3 build slots
- PostgreSQL: Docker container `flashlive-db-1`

## 2. Sign in

- **Email/password:** Register on `/register`, then verify the email. After verification you are routed to `/dashboard`.
- **Google:** Click **Continue with Google** (popup). Firebase issues an ID token; the API verifies it and upserts your profile.

Your session is a Firebase ID token sent as `Authorization: Bearer <token>` on every API call. The API never trusts a client-supplied user id.

## 3. Connect GitHub

1. Dashboard → **Connect GitHub**.
2. Authorize the OAuth App.
3. The API exchanges the code for an access token, encrypts it (AES-GCM) and stores it in `github_accounts`. Tokens are never sent to the browser.

GitHub OAuth callback must match `GITHUB_CALLBACK_URL` exactly (currently `http://localhost:5173/api/github/callback`).

## 4. Import a project

1. **New project** → pick a repository from the GitHub list.
2. FLASHLIVE supports **React + Vite** apps only. The worker auto-detects the app root — `package.json` with `react` + `vite` — even in subdirectories like `frontend/` or `src/dashboard/web`.
3. Optionally set branch, build/install commands and output directory (defaults: `npm run build -- --base=./`, `npm ci`, `dist`).

## 5. Environment variables (optional)

Project → **Environment variables**: add keys like `VITE_API_URL` if the app calls its own backend. Values are encrypted before PostgreSQL storage and injected as build-time env vars. They are never shown again in plaintext.

## 6. Deploy

- **Deploy** creates a `queued` deployment. Workers claim it fairly (one active build per user, up to 10 queued per user).
- Watch **live logs** streamed over Socket.IO; logs are also persisted in `deployment_logs`.
- On success the static `dist` output is published atomically and the live URL is `/sites/<deploymentId>/`.
- **Redeploy** rebuilds the same project; **Cancel** stops a queued/building deployment.

## 7. Sharing the site

- Localhost links only work on your machine.
- To share publicly, use a tunnel (`docs/PUBLIC_SHARING.md`) or deploy FLASHLIVE to a real server/domain.

## 8. What a deployment does NOT do

- It does **not** run your backend. Only the static frontend build is hosted. APIs must be external (set `VITE_API_URL` etc.).
- It does **not** support non-React/Vite frameworks yet.
