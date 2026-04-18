// @teeko/api — mock client, JSON seeds, and Zustand stores for v0.1 mockup.
// All mutations and fetches go through this package; components never import JSON directly.

export { simulateLatency } from './mock/delay';
export { simulateDriverMovement, type MovementTick } from './utils/movement';

export * as authApi from './mock/handlers/auth';
export * as placesApi from './mock/handlers/places';
export * as paymentsApi from './mock/handlers/payments';
export * as tripsApi from './mock/handlers/trips';

export { useAuthStore, type AuthState, type AuthStatus } from './stores/auth-store';
export { useLocationStore, type LocationState } from './stores/location-store';
export { usePlacesStore, type PlacesState } from './stores/places-store';
export { usePaymentsStore, type PaymentsState } from './stores/payments-store';
export { useTripStore, type TripState } from './stores/trip-store';
export { useUIStore, type UIState, type Toast } from './stores/ui-store';

export const API_PACKAGE_VERSION = '0.1.0';
