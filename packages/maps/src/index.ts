// @teeko/maps — thin wrappers over react-native-maps + expo-location.
// Directions types live in @teeko/shared; HTTP calls live in @teeko/api / driver lib.

export { MapView, type MapViewProps, type MapViewHandle } from './MapView';
export { Marker } from './Marker';
export { Polyline } from './Polyline';
export { CurrentLocationButton } from './CurrentLocationButton';

export { formatDuration, formatDistance } from './directions';

export {
  useDirections,
  type DirectionsFetcher,
  type UseDirectionsArgs,
  type UseDirectionsState,
} from './useDirections';

export const MAPS_PACKAGE_VERSION = '0.1.0';
