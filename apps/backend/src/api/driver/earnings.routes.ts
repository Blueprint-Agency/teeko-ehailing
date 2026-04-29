import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver · /payouts, /early-cashout, /history
  app.get('/__stub/earnings', async () => ({ stub: 'driver · /payouts, /early-cashout, /history' }));
}
