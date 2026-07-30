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
import { getIO } from './api/ws/gateway';
import { trackingService } from './modules/tracking/service';

import { riderRoutes } from './api/rider/index';
import { driverRoutes } from './api/driver/index';
import { driverWebRoutes } from './api/driver-web/index';
import { adminRoutes } from './api/admin/index';
import { webhookRoutes } from './api/webhooks/index';
import { publicRoutes } from './api/public/index';

/**
 * Socket.IO liveness snapshot. `mountSocketIO` runs after `buildApp` but before
 * `listen`, so by the time any request reaches a handler the gateway is either
 * mounted or genuinely missing — getIO() throwing is a real failure, not a race.
 */
function wsStatus() {
  try {
    const io = getIO();
    return {
      mounted: true,
      path: '/ws',
      // engine.clientsCount counts raw transport connections on THIS process,
      // including sockets that connected but never sent `auth`. A gap between
      // this and drivers+riders below means clients are failing the handshake.
      sockets: io.engine.clientsCount,
      rooms: io.sockets.adapter.rooms.size,
      ...trackingService.registryStats(),
    };
  } catch {
    return { mounted: false };
  }
}

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
      websocket: '/wsz',
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

    const ws = wsStatus();
    if (!ok || !ws.mounted) {
      return reply.code(503).send({
        ok: false,
        service: 'teeko-backend',
        redis: ok ? 'up' : 'down',
        ws: ws.mounted ? 'up' : 'down',
      });
    }
    return { ok: true, service: 'teeko-backend', redis: 'up', ws: 'up' };
  });

  // WS liveness: per-process socket counts. `pid` is here because the registry
  // is in-memory — when drivers report "connected" but a given instance shows
  // 0 drivers, comparing pids across replicas tells you they landed elsewhere.
  app.get('/wsz', async (_req, reply) => {
    const ws = wsStatus();
    if (!ws.mounted) {
      return reply.code(503).send({ ok: false, service: 'teeko-backend', ws });
    }
    // uptimeSec next to pid: if the churn is caused by the process restarting,
    // uptime resets to ~0 at exactly the moment sockets drop. A steady uptime
    // across a disconnect proves the server never died and the cause is the
    // network or the client.
    return {
      ok: true,
      service: 'teeko-backend',
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      ws,
    };
  });

  await app.register(riderRoutes, { prefix: '/api/v1/rider' });
  await app.register(driverRoutes, { prefix: '/api/v1/driver' });
  await app.register(driverWebRoutes, { prefix: '/api/v1/driver-web' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });

  await app.register(webhookRoutes, { prefix: '/api/webhooks' });
  await app.register(publicRoutes, { prefix: '/api/public' });

  return app;
}
