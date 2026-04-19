import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';

import { MapView, type MapViewHandle, Marker, Polyline } from '@teeko/maps';
import type { LatLng } from '@teeko/shared';

import { curvedRoute, splitPolylineAt, type LatLngLiteral } from '../utils/route';
import { CarMarker } from './CarMarker';
import { DestinationPin, PickupPin } from './MapPins';

export type RouteMapPhase = 'approach' | 'intrip';

export interface RouteMapProps {
  pickup: LatLng;
  destination: LatLng;
  driverPosition?: LatLng | null;
  driverHeading?: number;
  phase?: RouteMapPhase;
  showsUserLocation?: boolean;
  /** Full trip route (pickup→destination). When provided, used in intrip phase
   *  for the traveled/remaining polyline split so it matches the driver's
   *  animated path. Falls back to an on-the-fly curved route. */
  routePolyline?: Array<[number, number]>;
  /** Space reserved at the bottom of the map for any overlay sheet — passed
   *  to fitToCoordinates edgePadding so markers aren't hidden. Default 120. */
  bottomInset?: number;
  /** Space reserved at the top of the map (e.g. floating status card). Default 80. */
  topInset?: number;
}

export interface RouteMapHandle {
  /** Re-fit the map to the current phase's key points. */
  recenter: () => void;
}

function toLatLngLiterals(raw: Array<[number, number]>): LatLngLiteral[] {
  return raw.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
}

export const RouteMap = forwardRef<RouteMapHandle, RouteMapProps>(function RouteMap(
  {
    pickup,
    destination,
    driverPosition,
    driverHeading = 0,
    phase = 'intrip',
    showsUserLocation,
    routePolyline,
    bottomInset = 120,
    topInset = 80,
  },
  ref,
) {
  const mapRef = useRef<MapViewHandle>(null);

  const tripPolyline = useMemo<LatLngLiteral[]>(
    () =>
      routePolyline && routePolyline.length >= 2
        ? toLatLngLiterals(routePolyline)
        : curvedRoute(pickup, destination),
    [routePolyline, pickup, destination],
  );

  // Approach "tail": a gentle curve from driver → pickup. Client-side only
  // (no stored polyline needed); regenerated as the driver moves so the line
  // always ends at the current driver position.
  const approachTail = useMemo<LatLngLiteral[]>(() => {
    if (phase !== 'approach' || !driverPosition) return [];
    return curvedRoute(driverPosition, pickup, 20, 0.12);
  }, [phase, driverPosition, pickup]);

  // Traveled vs remaining split for in-trip phase.
  const split = useMemo(() => {
    if (phase !== 'intrip' || !driverPosition) {
      return { traveled: [] as LatLngLiteral[], remaining: tripPolyline };
    }
    return splitPolylineAt(tripPolyline, driverPosition);
  }, [phase, driverPosition, tripPolyline]);

  const edgePadding = useMemo(
    () => ({ top: topInset, bottom: bottomInset, left: 48, right: 48 }),
    [topInset, bottomInset],
  );

  // Fit once per phase transition.
  //   approach → driver + pickup (zoom in tight on the pickup leg)
  //   intrip   → driver + destination (zoom in tight on the remaining leg)
  const framedPhase = useRef<string | null>(null);
  const userPanned = useRef(false);

  const doFit = () => {
    if (!mapRef.current) return;
    const pts: LatLngLiteral[] = [];
    if (phase === 'approach') {
      if (driverPosition) {
        pts.push({ latitude: driverPosition.lat, longitude: driverPosition.lng });
      }
      pts.push({ latitude: pickup.lat, longitude: pickup.lng });
    } else {
      if (driverPosition) {
        pts.push({ latitude: driverPosition.lat, longitude: driverPosition.lng });
      } else {
        pts.push({ latitude: pickup.lat, longitude: pickup.lng });
      }
      pts.push({ latitude: destination.lat, longitude: destination.lng });
    }
    if (pts.length < 2) return;
    mapRef.current.fitToCoordinates(pts, { edgePadding, animated: true });
  };

  useEffect(() => {
    if (framedPhase.current === phase) return;
    const timer = setTimeout(() => {
      doFit();
      framedPhase.current = phase;
      userPanned.current = false;
    }, 260);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pickup, destination, driverPosition]);

  // Lazy in-trip "lookahead": periodically recenter on the driver so the
  // road ahead stays visible. Skipped while the user is panning.
  useEffect(() => {
    if (phase !== 'intrip') return;
    const iv = setInterval(() => {
      if (userPanned.current || !driverPosition || !mapRef.current) return;
      mapRef.current.animateCamera(
        {
          center: { latitude: driverPosition.lat, longitude: driverPosition.lng },
          heading: driverHeading,
          pitch: 0,
        },
        800,
      );
    }, 4_000);
    return () => clearInterval(iv);
  }, [phase, driverPosition, driverHeading]);

  useImperativeHandle(ref, () => ({
    recenter: () => {
      userPanned.current = false;
      doFit();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }));

  const initialRegion = useMemo(() => {
    const lat = (pickup.lat + destination.lat) / 2;
    const lng = (pickup.lng + destination.lng) / 2;
    const latDelta = Math.max(0.025, Math.abs(pickup.lat - destination.lat) * 1.8);
    const lngDelta = Math.max(0.025, Math.abs(pickup.lng - destination.lng) * 1.8);
    return { latitude: lat, longitude: lng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeColor = phase === 'approach' ? '#E11D2E' : '#E11D2E';
  const previewColor = '#C9CDD3';

  return (
    <MapView
      ref={mapRef}
      initialRegion={initialRegion}
      showsUserLocation={showsUserLocation}
      scrollEnabled
      zoomEnabled
      rotateEnabled={false}
      pitchEnabled={false}
      onPanDrag={() => {
        userPanned.current = true;
      }}
    >
      {/* Preview of the full route always shown, softened so it doesn't fight the active line. */}
      {phase === 'approach' ? (
        <Polyline
          coordinates={tripPolyline}
          strokeColor={previewColor}
          strokeWidth={4}
          lineDashPattern={[6, 6]}
        />
      ) : null}

      {/* In-trip: traveled (faded behind) + remaining (bright ahead) with a white casing */}
      {phase === 'intrip' ? (
        <>
          {split.remaining.length >= 2 ? (
            <Polyline coordinates={split.remaining} strokeColor="#FFFFFF" strokeWidth={10} />
          ) : null}
          {split.traveled.length >= 2 ? (
            <Polyline coordinates={split.traveled} strokeColor="#9CA3AF" strokeWidth={4} />
          ) : null}
          {split.remaining.length >= 2 ? (
            <Polyline coordinates={split.remaining} strokeColor={activeColor} strokeWidth={6} />
          ) : null}
        </>
      ) : null}

      {/* Approach tail: driver → pickup, rendered as the active line */}
      {phase === 'approach' && approachTail.length >= 2 ? (
        <>
          <Polyline coordinates={approachTail} strokeColor="#FFFFFF" strokeWidth={10} />
          <Polyline coordinates={approachTail} strokeColor={activeColor} strokeWidth={6} />
        </>
      ) : null}

      {/* zIndex keeps markers above the route polylines (default z=0), which
       *  on Android/Google Maps otherwise draw over parts of the marker
       *  bitmaps. Leave tracksViewChanges at its default (true): forcing
       *  it false on first render causes Android to snapshot the view
       *  before layout finishes, producing invisible markers. */}
      <Marker
        coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
        anchor={{ x: 0.5, y: 0.5 }}
        zIndex={3}
      >
        <PickupPin />
      </Marker>
      <Marker
        coordinate={{ latitude: destination.lat, longitude: destination.lng }}
        anchor={{ x: 0.5, y: 0.5 }}
        zIndex={4}
      >
        <DestinationPin pulse={phase === 'intrip'} />
      </Marker>
      {driverPosition ? (
        <Marker
          coordinate={{ latitude: driverPosition.lat, longitude: driverPosition.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={5}
          tracksViewChanges
        >
          <CarMarker
            variant={phase === 'approach' ? 'approaching' : 'intrip'}
            heading={driverHeading}
          />
        </Marker>
      ) : null}
    </MapView>
  );
});
