import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import RNMapView, {
  PROVIDER_DEFAULT,
  PROVIDER_GOOGLE,
  type Camera,
  type Region,
  type MapViewProps as RNMapViewProps,
} from 'react-native-maps';

export interface EdgePadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface FitOptions {
  edgePadding?: EdgePadding;
  animated?: boolean;
}

export interface MapViewHandle {
  animateToRegion: (region: Region, duration?: number) => void;
  fitToCoordinates: (
    coords: Array<{ latitude: number; longitude: number }>,
    opts?: FitOptions,
  ) => void;
  animateCamera: (camera: Partial<Camera>, duration?: number) => void;
}

export interface MapViewProps extends Omit<RNMapViewProps, 'provider'> {
  children?: ReactNode;
  /** Use Google Maps explicitly on both platforms. Default: native (Apple on iOS, Google on Android). */
  forceGoogle?: boolean;
}

// Rider-app default: Apple Maps on iOS (zero API key), Google on Android (requires key configured in app.json).
// Map interactions are disabled by default for the dimmed backdrops used on finding-driver; callers
// pass `scrollEnabled`/`zoomEnabled` as needed.
export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { children, forceGoogle, style, ...rest },
  ref,
) {
  const innerRef = useRef<RNMapView>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region, duration = 400) =>
      innerRef.current?.animateToRegion(region, duration),
    fitToCoordinates: (coords, opts) =>
      innerRef.current?.fitToCoordinates(coords, {
        edgePadding: opts?.edgePadding ?? { top: 80, bottom: 120, left: 40, right: 40 },
        animated: opts?.animated ?? true,
      }),
    animateCamera: (camera, duration = 500) =>
      innerRef.current?.animateCamera(camera, { duration }),
  }));

  return (
    <RNMapView
      ref={innerRef}
      provider={forceGoogle ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
      style={[styles.map, style]}
      showsCompass={false}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      {...rest}
    >
      {children}
    </RNMapView>
  );
});

const styles = StyleSheet.create({
  map: { flex: 1 },
});
