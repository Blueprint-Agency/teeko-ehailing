import { forwardRef } from 'react';
import { View } from 'react-native';

import { MapView, type MapViewHandle, type MapViewProps } from '@teeko/maps';
import { Icon } from '@teeko/ui';

export interface MapWithPinProps extends Omit<MapViewProps, 'children'> {
  pinColor?: string;
}

// Uses a fixed centered pin with a movable map region (drag the map, pin stays centered).
// Simpler + more robust than a draggable annotation, and matches Uber/Grab UX.
export const MapWithPin = forwardRef<MapViewHandle, MapWithPinProps>(function MapWithPin(
  { pinColor = '#E11D2E', ...rest },
  ref,
) {
  return (
    <View className="flex-1">
      <MapView ref={ref} {...rest} />
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <View className="-translate-y-5 items-center">
          <Icon name="place" size={40} color={pinColor} />
          <View className="mt-[-6px] h-2 w-2 rounded-full" style={{ backgroundColor: pinColor }} />
        </View>
      </View>
    </View>
  );
});
