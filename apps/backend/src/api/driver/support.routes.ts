import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver · /tickets · appeals · deactivation · vehicle-change
  app.get('/__stub/support', async () => ({ stub: 'driver · /tickets · appeals · deactivation · vehicle-change' }));
}
