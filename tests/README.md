# FLASHLIVE Tests

Test suites are organized by confidence level:

- `unit/` — pure functions, schemas, constants and crypto helpers.
- `integration/` — API route tests against real PostgreSQL.
- `e2e/` — browser auth, project import and deployment flows.
- `concurrency/` — multi-worker queue, slot ownership and recovery tests.

Current milestone verification is documented in `docs/TESTING.md`. Automated unit/integration suites still need to be added as the app is exercised with real Firebase, GitHub OAuth and Docker credentials.
