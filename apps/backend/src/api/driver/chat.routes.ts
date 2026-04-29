import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver · /trips/:id/messages
  app.get('/__stub/chat', async () => ({ stub: 'driver · /trips/:id/messages' }));
}
