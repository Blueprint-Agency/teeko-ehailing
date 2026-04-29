import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver-web · add, /:id/documents
  app.get('/__stub/vehicles', async () => ({ stub: 'driver-web · add, /:id/documents' }));
}
