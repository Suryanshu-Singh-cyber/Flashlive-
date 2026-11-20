# FLASHLIVE Security

## Authentication and authorization

- Firebase Email/Password and Google sign-in on web.
- API verifies Firebase ID tokens with Firebase Admin (`middleware/auth.ts`) and upserts PostgreSQL users.
- Socket.IO handshake requires the same Firebase token; deployment rooms check `user_id` ownership.
- GitHub OAuth uses hashed single-use state in `oauth_states`.

## Secrets

- GitHub access tokens are AES-256-GCM encrypted (`packages/shared/src/crypto.ts`).
- Project env vars are encrypted and never returned by GET endpoints.
- Build env vars may be embedded into public frontend output; users are warned not to put backend secrets there.

## GitHub

- Minimal scopes: `repo read:user`.
- Tokens never sent to browser; repository API calls happen server-side.
- Disconnect deletes the stored encrypted token.

## Docker/build isolation

- Repository code is untrusted.
- Build containers run as `node`, `CapDrop: ALL`, `no-new-privileges`, no Docker socket mount, bridge network, memory/CPU/PID limits and timeout.
- Commands are constrained to npm argument arrays validated by Zod; no arbitrary shell interpolation.
- Workspace is temporary and removed after build; artifacts publish atomically.

## API

- Helmet, CORS allowlist, JSON size limit, rate limiting, Zod validation, parameterized SQL.
- Internal worker endpoints require `x-internal-token` plus per-deployment lease token.
