import type { CorsOptions } from 'cors';
import { env } from '../config/env.js';

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export const corsOrigin: CorsOptions['origin'] = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (origin === env.WEB_ORIGIN) return callback(null, origin);
  if (env.NODE_ENV !== 'production' && LOCAL_ORIGIN.test(origin)) return callback(null, origin);
  return callback(null, false);
};
