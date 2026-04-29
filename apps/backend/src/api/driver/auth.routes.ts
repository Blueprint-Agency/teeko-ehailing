import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver · /me
  app.get('/__stub/auth', async () => ({ stub: 'driver · /me' }));
}
