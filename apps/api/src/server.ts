/**
 * FILE: apps/api/src/server.ts
 *
 * PURPOSE:
 * Starts the FLASHLIVE API HTTP server and Socket.IO service.
 *
 * WHY THIS FILE EXISTS:
 * Separates process startup from Express app construction and socket setup.
 *
 * HOW IT WORKS:
 * Loads env, creates the app, listens on PORT, initializes Socket.IO, and
 * handles graceful shutdown.
 *
 * USED BY:
 * npm run dev/start inside apps/api and production container entrypoint.
 *
 * SECURITY:
 * Binds through environment config; secrets are never logged.
 */

import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initSockets } from './sockets/index.js';
import { pool } from './db/pool.js';
import { logger } from './common/logger.js';

const app = createApp();
const server = createServer(app);
initSockets(server);

server.listen(env.PORT, () => {
  logger.info('FLASHLIVE API listening', { port: env.PORT, origin: env.WEB_ORIGIN });
});

async function shutdown(signal: string) {
  logger.info('API shutdown requested', { signal });
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
