import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver · /vehicles, /vehicles/:id/active, /bank-account
  app.get('/__stub/profile', async () => ({ stub: 'driver · /vehicles, /vehicles/:id/active, /bank-account' }));
}
