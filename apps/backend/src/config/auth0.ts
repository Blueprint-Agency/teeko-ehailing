// Auth0 JWKS verification config — wired up in v1.0.
// In v0.1 the auth middleware short-circuits (see src/http/middleware/auth.ts).
import { env } from './env';

export const auth0Config = {
  domain: env.AUTH0_DOMAIN,
  audience: env.AUTH0_AUDIENCE,
  issuer: env.AUTH0_ISSUER,
};
