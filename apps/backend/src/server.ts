import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { mountSocketIO } from './api/ws/gateway';
import { redis } from './config/redis';

// Node exits the process on an unhandled rejection. Every async Socket.IO event
// handler is a source of them — Socket.IO does not await or catch handler
// promises — so one bad DB query in a location ping would take the whole server
// down, dropping every connected driver with reason "transport close" and (under
// `tsx watch`) silently restarting. Log the stack and stay up: a rejected
// handler promise is isolated to that event, unlike an uncaught exception.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandledRejection — process kept alive');
});

// An uncaught exception leaves the process in an unknown state, so we still
// exit — but loudly, with the stack, instead of vanishing.
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException — exiting');
  process.exit(1);
});

async function main() {
  await redis.connect().catch(() => {
    logger.warn('Redis unavailable — real-time features degraded');
  });

  const app = await buildApp();

  // Mount Socket.IO on the same HTTP server before listen
  mountSocketIO(app.server);

  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  // pid is logged so a restart is obvious in the console: a new pid between two
  // WS disconnects means the server died, not the network.
  logger.info({ port: env.PORT, env: env.NODE_ENV, pid: process.pid }, 'teeko-backend listening');
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
