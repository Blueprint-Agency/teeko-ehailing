import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // rider · /sos, /emergency-contacts, /trip-share
  app.get('/__stub/safety', async () => ({ stub: 'rider · /sos, /emergency-contacts, /trip-share' }));
}
