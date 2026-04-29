import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // admin · password / Google Workspace SSO
  app.get('/__stub/auth', async () => ({ stub: 'admin · password / Google Workspace SSO' }));
}
