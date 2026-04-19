import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';

// Web fallback: `react-native-maps` is native-only. Render a muted placeholder
// that is visually neutral and explicitly labelled so designers/devs know why
// the map is missing. Ref methods are no-ops on web.

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
  animateToRegion: (...args: unknown[]) => void;
  fitToCoordinates: (...args: unknown[]) => void;
  animateCamera: (...args: unknown[]) => void;
}

export interface MapViewProps extends ViewProps {
  children?: ReactNode;
  forceGoogle?: boolean;
  initialRegion?: unknown;
  onRegionChangeComplete?: (...args: unknown[]) => void;
  showsUserLocation?: boolean;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  pitchEnabled?: boolean;
}

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  { children, style },
  ref,
) {
  useImperativeHandle(ref, () => ({
    animateToRegion: () => {},
    fitToCoordinates: () => {},
    animateCamera: () => {},
  }));

  return (
    <View style={[styles.stub, style]}>
      <Text style={styles.label}>Map preview (native only)</Text>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  stub: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F7',
  },
  label: {
    color: '#9CA3AF',
    fontSize: 12,
  },
});
