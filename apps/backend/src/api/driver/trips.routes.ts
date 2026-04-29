import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver · /accept, /decline, /arrive, /pickup, /complete
  app.get('/__stub/trips', async () => ({ stub: 'driver · /accept, /decline, /arrive, /pickup, /complete' }));
}
