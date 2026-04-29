import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // driver · /sos, /incident-reports
  app.get('/__stub/safety', async () => ({ stub: 'driver · /sos, /incident-reports' }));
}
