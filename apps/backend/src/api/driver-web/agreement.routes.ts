import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver-web · /agreement/accept (scrolled flag)
  app.get('/__stub/agreement', async () => ({ stub: 'driver-web · /agreement/accept (scrolled flag)' }));
}
