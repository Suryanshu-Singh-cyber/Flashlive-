/**
 * FILE: apps/api/src/sockets/index.ts
 *
 * PURPOSE:
 * Initializes Socket.IO, authenticates sockets with Firebase tokens and emits
 * real-time deployment/log events to authorized rooms.
 *
 * WHY THIS FILE EXISTS:
 * Build logs and deployment status need push updates, but rooms must be
 * protected by verified ownership rather than client-supplied ids alone.
 *
 * HOW IT WORKS:
 * Verifies the handshake token, resolves the PostgreSQL user, joins a user
 * room, and allows explicit deployment-room joins after an ownership check.
 *
 * USED BY:
 * server.ts, deployments/internal routes and frontend socket services.
 *
 * SECURITY:
 * Tokens are verified server-side; deployment rooms require user_id ownership.
 */

import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { env } from '../config/env.js';
import { query } from '../db/pool.js';
import { verifyFirebaseIdToken } from '../middleware/auth.js';
import { logger } from '../common/logger.js';

let io: Server | null = null;

interface SocketUser {
  id: string;
  firebaseUid: string;
}

function deploymentRoom(deploymentId: string) {
  return `deployment:${deploymentId}`;
}

function userRoom(userId: string) {
  return `user:${userId}`;
}

export function getIo(): Server {
  if (!io) throw new Error('Socket.IO has not been initialized.');
  return io;
}

export function emitToDeployment(deploymentId: string, event: string, payload: unknown) {
  io?.to(deploymentRoom(deploymentId)).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}

export function initSockets(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.WEB_ORIGIN, credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const token = typeof socket.handshake.auth.token === 'string' ? socket.handshake.auth.token : '';
      if (!token) {
        next(new Error('Missing socket token'));
        return;
      }
      const decoded = await verifyFirebaseIdToken(token);
      const result = await query<{ id: string; firebase_uid: string }>(
        'SELECT id, firebase_uid FROM users WHERE firebase_uid = $1',
        [decoded.uid],
      );
      const user = result.rows[0];
      if (!user) {
        next(new Error('User not found'));
        return;
      }
      (socket.data as { user?: SocketUser }).user = { id: user.id, firebaseUid: user.firebase_uid };
      next();
    } catch (error) {
      logger.warn('Socket authentication failed', { error: error instanceof Error ? error.message : String(error) });
      next(new Error('Socket authentication failed'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket.data as { user?: SocketUser }).user;
    if (user) socket.join(userRoom(user.id));

    socket.on('deployment:watch', async (payload: { deploymentId?: string }, ack?: (response: { ok: boolean; error?: string }) => void) => {
      try {
        const deploymentId = payload?.deploymentId;
        if (!deploymentId || !user) throw new Error('Invalid watch request');
        const result = await query('SELECT id FROM deployments WHERE id = $1 AND user_id = $2', [deploymentId, user.id]);
        if (!result.rowCount) throw new Error('Deployment not found');
        await socket.join(deploymentRoom(deploymentId));
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error instanceof Error ? error.message : 'Watch failed' });
      }
    });

    socket.on('deployment:unwatch', (payload: { deploymentId?: string }) => {
      if (payload?.deploymentId) void socket.leave(deploymentRoom(payload.deploymentId));
    });
  });

  return io;
}
