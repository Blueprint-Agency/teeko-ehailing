import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  lazyConnect: true,
});

redis.on('connect', () => {
  console.log('[redis] connected successfully');
});

redis.on('error', (err) => {
  // Non-fatal in dev when Redis is not running — services degrade gracefully
  if (env.NODE_ENV !== 'test') console.error('[redis] connection error:', err.message);
});
