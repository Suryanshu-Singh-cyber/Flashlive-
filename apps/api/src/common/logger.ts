/**
 * FILE: apps/api/src/common/logger.ts
 *
 * PURPOSE:
 * Provides lightweight structured logging for the API.
 *
 * WHY THIS FILE EXISTS:
 * Production debugging needs consistent timestamps, levels and safe metadata
 * without pulling in a heavy logging dependency.
 *
 * HOW IT WORKS:
 * Writes JSON lines to stdout/stderr with level, time, message and optional
 * metadata. Callers must not pass secrets in metadata.
 *
 * USED BY:
 * Middleware, routes, services, sockets and startup/shutdown paths.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry = { time: new Date().toISOString(), level, message, ...(meta ? { meta } : {}) };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write('error', message, meta),
};
