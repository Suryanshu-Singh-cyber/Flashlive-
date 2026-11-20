# Queue And Recovery

## Capacity

`FLASHLIVE_BUILD_SLOTS` defaults to 3. `worker_slots` rows are seeded for indices 0..N-1.

## Claim algorithm

`apps/worker/src/queue/slotAllocator.ts`:

1. `SELECT ... FROM worker_slots WHERE status='available' ORDER BY slot_index FOR UPDATE SKIP LOCKED LIMIT 1`
2. Select oldest queued deployment whose user has no `building` deployment, ordered by least-recently-served user then `created_at`.
3. `UPDATE deployments SET status='building', worker_id, slot_id, lease_token, started_at, heartbeat_at, attempt_count=attempt_count+1`.
4. Claim the slot and update worker active pointers in the same transaction.

Locks are held only for the claim transaction, not during Docker builds.

## Fair scheduling

A user may have many queued jobs but only one active build. Candidate users are ordered by `last_served_at` (nulls first), so users who recently consumed capacity wait while eligible users are served.

## Fencing and recovery

- Each claim generates a fresh `lease_token`.
- Workers heartbeat through `/api/internal/deployments/:id/heartbeat`.
- API validates `status='building'` and `lease_token` before logs/heartbeat/prepare/complete.
- `apps/worker/src/recovery/reaper.ts` scans `building` deployments whose `heartbeat_at` is older than `FLASHLIVE_LEASE_DURATION_MS`.
- Recovery verifies the slot still points to the deployment, clears the lease, releases the slot, marks worker stale, retries if `attempt_count < MAX_ATTEMPT_COUNT`, otherwise fails/cancels, and writes `recovery_events`.
- Old workers cannot complete because the lease no longer matches; builds are at-least-once, not exactly-once.
