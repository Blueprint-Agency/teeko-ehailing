import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver · /online, /offline, /radius
  app.get('/__stub/status', async () => ({ stub: 'driver · /online, /offline, /radius' }));
}
