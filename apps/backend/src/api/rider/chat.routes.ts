import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // rider · /trips/:id/messages, /voice-token
  app.get('/__stub/chat', async () => ({ stub: 'rider · /trips/:id/messages, /voice-token' }));
}
