/**
 * FILE: apps/web/src/services/socket.ts
 *
 * PURPOSE:
 * Connects the browser to FLASHLIVE Socket.IO for deployment events.
 *
 * WHY THIS FILE EXISTS:
 * Real-time logs/status need authenticated push updates from the API.
 *
 * HOW IT WORKS:
 * Creates a socket with the Firebase ID token and exposes watch/unwatch helpers.
 *
 * USED BY:
 * Deployment detail page and future live queue updates.
 */

import { io, type Socket } from 'socket.io-client';
import { auth } from '@/lib/firebase';

const API_URL = import.meta.env.VITE_API_URL ?? '';
let socket: Socket | null = null;

export async function getFlashliveSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  const token = await auth?.currentUser?.getIdToken();
  socket = io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
  return socket;
}

export function watchDeployment(socketInstance: Socket, deploymentId: string, onEvent: (event: string, payload: unknown) => void) {
  socketInstance.emit('deployment:watch', { deploymentId }, (response: { ok?: boolean }) => {
    if (!response?.ok) return;
  });
  const handler = (event: string) => (payload: unknown) => onEvent(event, payload);
  socketInstance.on('deployment:log', handler('deployment:log'));
  socketInstance.on('deployment:update', handler('deployment:update'));
  return () => {
    socketInstance.off('deployment:log');
    socketInstance.off('deployment:update');
    socketInstance.emit('deployment:unwatch', { deploymentId });
  };
}

export function closeFlashliveSocket() {
  socket?.disconnect();
  socket = null;
}
