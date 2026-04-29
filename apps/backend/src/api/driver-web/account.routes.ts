import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver-web · /account (name, email, password)
  app.get('/__stub/account', async () => ({ stub: 'driver-web · /account (name, email, password)' }));
}
