# FLASHLIVE Viva Preparation

## Elevator pitch

FLASHLIVE is a GitHub-integrated deployment platform. A user connects GitHub, imports a React + Vite repository, and creates deployments. PostgreSQL stores users, projects, deployments, logs, workers and slots. Worker processes claim queued jobs transactionally, build them in restricted Docker containers, stream logs through the API, publish static artifacts for Nginx, and recover stale leases with fencing tokens.

## Problem statement

Developers need a simple way to deploy frontend projects without configuring full CI/CD infrastructure, while still demonstrating reliable concurrent job scheduling, monitoring and crash recovery.

## Objectives

- One-click GitHub repository import for React + Vite.
- PostgreSQL-backed concurrent build queue with N slots.
- Real Docker builds and Nginx static hosting.
- Persistent and real-time build logs.
- Worker heartbeat, lease expiry, reaper and fencing.
- Secure Firebase/GitHub auth and encrypted secrets.

## Architecture explanation

Use `docs/ARCHITECTURE.md`. Key flow: React SPA → Express API → PostgreSQL → worker claim transaction → Docker build → internal API callbacks → Nginx artifact URL.

## Database explanation

Use `docs/DATABASE.md`. Emphasize foreign keys, status checks, partial unique indexes for one active build per worker/user/slot, and transaction boundaries.

## Queue explanation

Use `docs/QUEUE_AND_RECOVERY.md`. Explain `FOR UPDATE SKIP LOCKED`, slot ownership, fair least-recently-served user selection, lease tokens and at-least-once retries.

## Security explanation

Use `docs/SECURITY.md`. Cover Firebase token verification, GitHub OAuth state, encrypted tokens/env vars, parameterized SQL, rate limiting, Docker restrictions and internal worker tokens.

## Potential viva questions

### Easy

1. What is FLASHLIVE? — A GitHub-integrated deployment platform for React + Vite apps.
2. Why PostgreSQL? — Relational integrity, transactions, constraints and `FOR UPDATE SKIP LOCKED` for queue correctness.
3. What does the frontend use? — React, TypeScript, Vite, Tailwind, Framer Motion, Three.js, Socket.IO Client, Recharts.
4. What does the backend use? — Node.js, Express, TypeScript, PostgreSQL, Firebase Admin, Socket.IO, Zod, Helmet.
5. How does login work? — Firebase client auth; API verifies ID token and upserts PostgreSQL user.
6. How is GitHub different from Google login? — GitHub OAuth is only for repository access/tokens; Google/Firebase is user authentication.
7. Where are build logs stored? — `deployment_logs` in PostgreSQL, streamed via API/Socket.IO.
8. What is a worker slot? — A global capacity row in `worker_slots`; default N=3.
9. What is a lease token? — A per-claim UUID fencing token proving current deployment ownership.
10. What is Nginx used for? — Serving the SPA and immutable `/sites/<deployment-id>/` artifacts.

### Medium

11. How are deployments created? — API validates project ownership, resolves commit via GitHub, checks queue limit, inserts `queued` row.
12. How does a worker get a job? — `claimNextDeployment` locks an available slot and fair queued job in one transaction.
13. Why `SKIP LOCKED`? — Lets concurrent workers skip rows already being claimed instead of blocking.
14. How is global capacity enforced? — Available `worker_slots` rows; slot and job are claimed atomically.
15. How is per-user fairness enforced? — Users with an active build are skipped; users are ordered by least-recently-served.
16. How are duplicate owners prevented? — Partial unique indexes on worker/user/slot for `building` rows.
17. How do logs reach the UI? — Worker batches logs to internal API; API inserts PostgreSQL rows and emits Socket.IO events.
18. How are secrets protected? — GitHub tokens and env vars are AES-256-GCM encrypted; frontend never receives them.
19. How are builds isolated? — Docker containers run as `node`, no socket, dropped caps, resource limits, timeout.
20. How are artifacts published? — Worker copies `dist` to temp dir then renames into artifact dir; only successful fenced builds become live.

### Advanced

21. What happens if a worker crashes? — Heartbeat stops; reaper detects expired lease, verifies slot, releases it, requeues/fails and logs recovery event.
22. Can an old worker still publish? — No; API requires matching `status='building'` and `lease_token` for prepare/complete.
23. Is execution exactly once? — No; builds are at-least-once because retries may rerun after crash. Ownership and publication are fenced.
24. What is fencing? — Lease token acts like a generation check; stale workers fail validation.
25. How are race conditions handled? — Short transactions, row locks, `SKIP LOCKED`, unique constraints and lease verification.
26. What about deadlocks? — Transactions are short and lock few rows; consistent order slot→job→worker reduces risk.
27. How does cancellation work? — Queued jobs cancel immediately; building jobs set `cancel_requested_at`, worker heartbeat sees it and kills container.
28. How are GitHub tokens stored? — Encrypted in `github_accounts`; decrypted only server-side/worker-side.
29. Why hashed OAuth state? — Prevents CSRF/replay; state is single-use and expires.
30. How are env vars handled? — Encrypted at rest, passed only to build container, warned that Vite may embed them publicly.

### System/design

31. Why separate API and worker? — API handles user requests; workers perform long-running Docker builds independently.
32. Why Socket.IO? — Pushes log/status events to authorized rooms without polling.
33. How are Socket rooms secured? — Firebase handshake auth plus deployment ownership check.
34. Why React + Vite only? — Semester scope; constrained build commands reduce arbitrary execution risk.
35. How are commands validated? — Zod schemas reject shell metacharacters; worker runs npm arg arrays.
36. What happens if build fails? — Worker reports failed completion; previous successful artifact remains.
37. How is queue wait measured? — `queued_at` to `started_at` duration stored on deployment.
38. How is build duration measured? — Worker timestamp until terminal completion.
39. What are recovery events? — Audit rows for lease expiry, action and metadata.
40. How would you scale workers? — Add worker processes/containers; slots remain global in PostgreSQL.

### Testing/limitations

41. What tests are required? — Auth, project ownership, GitHub, Docker build, 20-job concurrency, crash recovery, reconnect.
42. What is the 20-job test? — With N=3, expect 3 building and 17 queued, then slot reuse without duplicate owners.
43. What is a limitation? — No CDN/custom domains; GitHub/Firebase credentials needed; worker needs Docker host.
44. What is future scope? — More frameworks, custom domains, CDN, metrics, horizontal worker autoscaling.
45. Why is this a good semester project? — It combines frontend, backend, database, concurrency, Docker, security and real-time systems.

### Quick analogies

46. `FOR UPDATE SKIP LOCKED` analogy — Multiple cashiers skip receipts already being scanned instead of waiting.
47. Lease token analogy — A timed wristband proving you still own the build booth.
48. Worker slot analogy — Three checkout lanes; a job cannot open a lane until one frees.
49. Fencing analogy — Old keycard stops working after the lock is reissued.
50. Atomic artifact publish analogy — Put new files in a sealed box, then swap it onto the shelf only when complete.

## Files to know

- Queue: `apps/worker/src/queue/slotAllocator.ts`, `apps/worker/src/recovery/reaper.ts`
- Docker: `apps/worker/src/docker/dockerRunner.ts`
- Auth: `apps/api/src/middleware/auth.ts`, `apps/web/src/features/auth/AuthContext.tsx`
- GitHub: `apps/api/src/modules/github/service.ts`
- Logs/socket: `apps/api/src/sockets/index.ts`, `apps/web/src/services/socket.ts`
- Schema: `database/migrations/001_init.sql`

## Honest status

The codebase foundation and major modules are implemented and typechecked. Full production readiness still requires real Firebase/GitHub credentials, running PostgreSQL, Docker-capable worker host, and executing the acceptance tests above.
