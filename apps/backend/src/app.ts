import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { join } from 'node:path';

import { env } from './config/env';
import { redis } from './config/redis';
import { errorHandler } from './http/middleware/errorHandler';

import { riderRoutes } from './api/rider/index';
import { driverRoutes } from './api/driver/index';
import { driverWebRoutes } from './api/driver-web/index';
import { adminRoutes } from './api/admin/index';
import { webhookRoutes } from './api/webhooks/index';
import { publicRoutes } from './api/public/index';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' } }
          : undefined,
    },
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(sensible);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB
  await app.register(staticFiles, {
    root: join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
  });

  app.setErrorHandler(errorHandler);

  app.get('/', async () => ({
    status: 'running',
    service: 'teeko-backend',
    version: '0.0.1',
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    endpoints: {
      health: '/healthz',
      ready: '/readyz',
      rider: '/api/v1/rider',
      driver: '/api/v1/driver',
      driverWeb: '/api/v1/driver-web',
      admin: '/api/v1/admin',
      public: '/api/public',
      webhooks: '/api/webhooks',
    },
  }));
  app.get('/healthz', async () => ({ ok: true, service: 'teeko-backend' }));

  // Readiness: unlike /healthz this actually probes Redis. Redis uses
  // enableOfflineQueue, so ping() can hang while disconnected instead of
  // rejecting — race it against a timeout so the prober never blocks.
  app.get('/readyz', async (_req, reply) => {
    let timer: NodeJS.Timeout | undefined;
    const ok = await Promise.race([
      redis
        .ping()
        .then(() => true)
        .catch(() => false),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), 1000);
      }),
    ]).finally(() => clearTimeout(timer));

    if (!ok) {
      return reply.code(503).send({ ok: false, service: 'teeko-backend', redis: 'down' });
    }
    return { ok: true, service: 'teeko-backend', redis: 'up' };
  });

  await app.register(riderRoutes, { prefix: '/api/v1/rider' });
  await app.register(driverRoutes, { prefix: '/api/v1/driver' });
  await app.register(driverWebRoutes, { prefix: '/api/v1/driver-web' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });

  await app.register(webhookRoutes, { prefix: '/api/webhooks' });
  await app.register(publicRoutes, { prefix: '/api/public' });

  return app;
}
