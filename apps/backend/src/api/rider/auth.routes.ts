import type { FastifyInstance } from 'fastify';

export async function routes(app: FastifyInstance) {
  // rider · /me, post-Auth0 session bootstrap
  app.get('/__stub/auth', async () => ({ stub: 'rider · /me, post-Auth0 session bootstrap' }));
}
