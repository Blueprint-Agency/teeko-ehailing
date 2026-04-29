import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // rider · inbox, mark-read, /device-tokens
  app.get('/__stub/notifications', async () => ({ stub: 'rider · inbox, mark-read, /device-tokens' }));
}
