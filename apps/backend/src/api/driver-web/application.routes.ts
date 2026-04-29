import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver-web · GET resume state
  app.get('/__stub/application', async () => ({ stub: 'driver-web · GET resume state' }));
}
