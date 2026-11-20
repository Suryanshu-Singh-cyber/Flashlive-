# FLASHLIVE Testing

## Automated checks run during development

- `npm run typecheck` — shared, API, worker and web TypeScript checks.
- `npm run build --workspace @flashlive/web` — production Vite build.

## Manual acceptance tests

### Authentication

- Google sign-in creates/updates PostgreSQL user.
- Email/password registration sends verification email.
- Wrong password returns Firebase error.
- Existing email registration returns Firebase error.
- Password reset email flow.
- Refresh restores session; `/dashboard` requires auth.

### Projects/GitHub

- Connect GitHub OAuth and disconnect.
- Repository list and branch list use server-side token.
- Create React + Vite project; reject non-Vite package.
- User cannot access another user's project/deployment/logs.

### Queue/concurrency

Set `FLASHLIVE_BUILD_SLOTS=3`, start API + worker, create 20 deployments:

Expected after claiming: 3 `building`, 17 `queued`, no duplicate `worker_id`/`slot_id` active owners. As builds finish, queued jobs claim released slots.

### Crash recovery

1. Start a long build.
2. Kill worker process.
3. Wait `FLASHLIVE_LEASE_DURATION_MS` + reaper interval.
4. Verify `recovery_events`, slot release, requeue/fail.
5. Restart worker; old lease cannot complete.

### Docker/security

- Build timeout enforced.
- Container has no Docker socket, dropped caps, resource limits.
- Failed build preserves previous successful artifact.
- Logs mask configured env values.

## Known limitations

Full E2E/auth/Docker tests require real Firebase, GitHub OAuth and Docker-capable host credentials. Do not mark those complete until executed.
