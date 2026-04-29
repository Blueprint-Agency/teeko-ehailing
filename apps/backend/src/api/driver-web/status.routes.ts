import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver-web · post-submit polling
  app.get('/__stub/status', async () => ({ stub: 'driver-web · post-submit polling' }));
}
