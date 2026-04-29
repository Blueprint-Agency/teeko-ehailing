import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver-web · in-portal inbox
  app.get('/__stub/notifications', async () => ({ stub: 'driver-web · in-portal inbox' }));
}
