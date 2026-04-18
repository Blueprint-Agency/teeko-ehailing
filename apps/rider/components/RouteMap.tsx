import { forwardRef, useEffect } from 'react';

import { MapView, type MapViewHandle, Marker, Polyline } from '@teeko/maps';
import type { LatLng } from '@teeko/shared';

export interface RouteMapProps {
  pickup: LatLng;
  destination: LatLng;
  driverPosition?: LatLng | null;
  showsUserLocation?: boolean;
}

function toRegion(pickup: LatLng, destination: LatLng) {
  const lat = (pickup.lat + destination.lat) / 2;
  const lng = (pickup.lng + destination.lng) / 2;
  const latDelta = Math.max(0.02, Math.abs(pickup.lat - destination.lat) * 1.6);
  const lngDelta = Math.max(0.02, Math.abs(pickup.lng - destination.lng) * 1.6);
  return { latitude: lat, longitude: lng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
}

export const RouteMap = forwardRef<MapViewHandle, RouteMapProps>(function RouteMap(
  { pickup, destination, driverPosition, showsUserLocation },
  ref,
) {
  const region = toRegion(pickup, destination);

  const polyline = [
    { latitude: pickup.lat, longitude: pickup.lng },
    { latitude: destination.lat, longitude: destination.lng },
  ];

  useEffect(() => {
    // Fit to the pair after mount so short/long trips look balanced.
    const timer = setTimeout(() => {
      if (
        ref &&
        typeof ref === 'object' &&
        'current' in ref &&
        ref.current
      ) {
        ref.current.fitToCoordinates(polyline);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [pickup.lat, pickup.lng, destination.lat, destination.lng, ref, polyline]);

  return (
    <MapView
      ref={ref}
      initialRegion={region}
      showsUserLocation={showsUserLocation}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
    >
      <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} pinColor="#111111" />
      <Marker
        coordinate={{ latitude: destination.lat, longitude: destination.lng }}
        pinColor="#E11D2E"
      />
      <Polyline coordinates={polyline} strokeColor="#E11D2E" strokeWidth={4} />
      {driverPosition ? (
        <Marker
          coordinate={{ latitude: driverPosition.lat, longitude: driverPosition.lng }}
          pinColor="#2563EB"
        />
      ) : null}
    </MapView>
  );
});
