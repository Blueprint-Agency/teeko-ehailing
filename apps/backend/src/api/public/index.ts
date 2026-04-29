import type { FastifyInstance } from 'fastify';

// Public, unauthenticated routes — trip-share recipient view, content fetch, cancel reasons.
export async function publicRoutes(app: FastifyInstance) {
  app.get('/trip-share/:token', async () => ({ stub: 'trip-share viewer (no app required)' }));
  app.get('/content/:key', async () => ({ stub: 'content version fetch (T&C, agreement, …)' }));
  app.get('/cancel-reasons', async () => ({ stub: 'localized cancel reasons by audience' }));
}
