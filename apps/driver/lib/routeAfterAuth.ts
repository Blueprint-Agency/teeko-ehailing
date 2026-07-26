import { api } from './api';

/**
 * Where to send a driver straight after Clerk sign-in.
 *
 * A Clerk session only proves identity. Whether the driver may accept trips is
 * decided by `driver_applications.state`, which an admin advances to `activated`
 * only after document + EVP review. Drivers who registered on the web portal can
 * sign in here mid-application, so we must never assume approval.
 *
 * Document resubmission lives in the web portal, so `rejected` lands on the
 * pending screen (which shows the reason) rather than an upload flow.
 */
export type AuthRoute =
  | '/(driver)/(tabs)/home'
  | '/(driver)/onboarding/pending'
  | '/(driver)/onboarding/agreement';

export function routeForApplicationState(state: string | null | undefined): AuthRoute {
  switch (state) {
    case 'activated':
      return '/(driver)/(tabs)/home';
    case 'vehicle_docs_submitted':
    case 'in_review':
    case 'rejected':
      return '/(driver)/onboarding/pending';
    default:
      return '/(driver)/onboarding/agreement';
  }
}

/**
 * Resolves (JIT-provisioning on first call) the driver's row and returns the
 * route to land on. Falls back to home if /auth/me is unreachable — the
 * per-request auth on the trip endpoints still gates real actions, so a network
 * blip shouldn't strand an activated driver on an onboarding screen.
 */
export async function resolveRouteAfterAuth(): Promise<AuthRoute> {
  try {
    const me = await api.auth.me();
    return routeForApplicationState(me.application?.state);
  } catch (err) {
    console.warn('[auth] /auth/me failed, defaulting to home', err);
    return '/(driver)/(tabs)/home';
  }
}
