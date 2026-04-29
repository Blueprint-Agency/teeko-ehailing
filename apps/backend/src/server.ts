import { buildApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';

async function main() {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'teeko-backend listening');
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
