import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { mountSocketIO } from './api/ws/gateway';
import { redis } from './config/redis';

async function main() {
  await redis.connect().catch(() => {
    logger.warn('Redis unavailable — real-time features degraded');
  });

  const app = await buildApp();

  // Mount Socket.IO on the same HTTP server before listen
  mountSocketIO(app.server);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'teeko-backend listening');
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
