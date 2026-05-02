// @teeko/api — real HTTP clients + Zustand stores. No more in-app mocks.
// All mutations and fetches go through this package; components never import
// JSON or call fetch directly.

export { simulateDriverMovement, type MovementTick } from './utils/movement';

export {
  authApi,
  placesApi,
  paymentsApi,
  tripsApi,
  api,
  ApiError,
  setApiTokenGetter,
} from './client';

export { useAuthStore, type AuthState, type AuthStatus } from './stores/auth-store';
export { useLocationStore, type LocationState } from './stores/location-store';
export { usePlacesStore, type PlacesState } from './stores/places-store';
export { usePaymentsStore, type PaymentsState } from './stores/payments-store';
export { useTripStore, type TripState } from './stores/trip-store';
export { useUIStore, type UIState, type Toast } from './stores/ui-store';

export const API_PACKAGE_VERSION = '0.2.0';
