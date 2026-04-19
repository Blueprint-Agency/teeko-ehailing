import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { useLocationStore, usePlacesStore, useTripStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { MapView, type MapViewHandle, Marker, Polyline } from '@teeko/maps';
import type { Place } from '@teeko/shared';
import { type BottomSheetHandle, Icon, Pressable, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { CallChatButtons } from '../../../components/CallChatButtons';
import { CarMarker } from '../../../components/CarMarker';
import { DriverCard } from '../../../components/DriverCard';
import { DestinationPin } from '../../../components/MapPins';
import { MockChatSheet } from '../../../components/MockChatSheet';
import { RecentPlaceRow } from '../../../components/RecentPlaceRow';
import { RidesActionCard } from '../../../components/RidesActionCard';
import { RouteMap } from '../../../components/RouteMap';
import { TripProgressBar } from '../../../components/TripProgressBar';
import { TripStatusHeader } from '../../../components/TripStatusHeader';
import { WhereToBar } from '../../../components/WhereToBar';
import { formatDistance, haversineKm } from '../../../utils/distance';
import { curvedRoute } from '../../../utils/route';

// Idle-state "ambient traffic" markers. Each has a fixed base offset + a
// distinct heading so they don't all face the same direction, plus a phase
// offset used to animate a subtle drift (purely cosmetic).
const NEARBY_OFFSETS = [
  { id: 'n1', dLat: 0.0018, dLng: 0.0022, heading: 34, phase: 0.0 },
  { id: 'n2', dLat: -0.0014, dLng: 0.0031, heading: 118, phase: 1.1 },
  { id: 'n3', dLat: 0.0026, dLng: -0.0019, heading: 202, phase: 2.3 },
  { id: 'n4', dLat: -0.0024, dLng: -0.0027, heading: 280, phase: 3.7 },
  { id: 'n5', dLat: 0.0009, dLng: -0.0036, heading: 65, phase: 4.9 },
];

const NEARBY_DRIFT = 0.00025; // ≈ 28m peak-to-peak — just enough to feel alive.

const DEFAULT_ZOOM = { latitudeDelta: 0.018, longitudeDelta: 0.018 };

export default function HomeTab() {
  const router = useRouter();
  const t = useT();
  const recent = usePlacesStore((s) => s.recent);
  const loadRecent = usePlacesStore((s) => s.loadRecent);
  const loadSaved = usePlacesStore((s) => s.loadSaved);
  const setPickup = useTripStore((s) => s.setPickup);
  const setDestination = useTripStore((s) => s.setDestination);
  const currentLatLng = useLocationStore((s) => s.current);
  const setCurrent = useLocationStore((s) => s.setCurrent);
  const setPermission = useLocationStore((s) => s.setPermission);

  const tripStatus = useTripStore((s) => s.status);
  const driverPosition = useTripStore((s) => s.driverPosition);
  const tripDriver = useTripStore((s) => s.driver);
  const tripPickup = useTripStore((s) => s.pickup);
  const tripDestination = useTripStore((s) => s.destination);
  const trip = useTripStore((s) => s.trip);

  const mapRef = useRef<MapViewHandle>(null);
  const snappedToUser = useRef(false);
  const approachInitialKm = useRef<number | null>(null);
  const chatRef = useRef<BottomSheetHandle>(null);
  const tripActive = tripStatus === 'matched' || tripStatus === 'arrived' || tripStatus === 'in_trip';
  const driverHeading = useTripStore((s) => s.driverHeading);

  // Drift tick — slow sinusoid feeds the nearby-driver positions so the map
  // reads as "live" without actually moving anything elsewhere in the app.
  const [driftTick, setDriftTick] = useState(0);
  useEffect(() => {
    if (tripActive) return;
    const iv = setInterval(() => setDriftTick((t) => t + 1), 600);
    return () => clearInterval(iv);
  }, [tripActive]);

  const destinationPreview = useMemo(() => {
    if (tripActive || !tripDestination) return null;
    return curvedRoute(
      currentLatLng,
      { lat: tripDestination.lat, lng: tripDestination.lng },
      28,
      0.14,
    );
  }, [tripActive, tripDestination, currentLatLng]);

  useEffect(() => {
    loadRecent();
    loadSaved();
  }, [loadRecent, loadSaved]);

  // Pull real device GPS so mock drivers are placed around the rider's actual location.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermission(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined');
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setCurrent({ lat: pos.coords.latitude, lng: pos.coords.longitude }, pos.coords.heading ?? 0);
      } catch {
        // Keep the default (KL Sentral) — mockup is still useable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setCurrent, setPermission]);

  // Snap the map to the rider's real location once GPS resolves — no visible
  // zoom animation (duration 0). Skipped when a trip is already active (the
  // trip-follow effect below drives framing).
  useEffect(() => {
    if (tripActive || snappedToUser.current || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: currentLatLng.lat,
        longitude: currentLatLng.lng,
        ...DEFAULT_ZOOM,
      },
      0,
    );
    snappedToUser.current = true;
  }, [currentLatLng.lat, currentLatLng.lng, tripActive]);

  // Active-trip framing is delegated to <RouteMap/> (which owns its own map
  // instance during trips — matches the driver-matched and in-trip screens).

  // Approach progress: snapshot the first driver->pickup distance as the baseline.
  useEffect(() => {
    if (tripStatus !== 'matched') {
      if (tripStatus === 'idle' || tripStatus === 'cancelled' || tripStatus === 'completed') {
        approachInitialKm.current = null;
      }
      return;
    }
    if (approachInitialKm.current !== null || !driverPosition || !tripPickup) return;
    approachInitialKm.current = haversineKm(driverPosition, {
      lat: tripPickup.lat,
      lng: tripPickup.lng,
    });
  }, [tripStatus, driverPosition, tripPickup]);

  const progress = useMemo(() => {
    if (!driverPosition) return 0;
    if (tripStatus === 'arrived') return 1;
    if (tripStatus === 'matched' && tripPickup && approachInitialKm.current) {
      const now = haversineKm(driverPosition, { lat: tripPickup.lat, lng: tripPickup.lng });
      return Math.max(0, Math.min(1, 1 - now / (approachInitialKm.current || 1)));
    }
    if (tripStatus === 'in_trip' && tripPickup && tripDestination) {
      const total = haversineKm(
        { lat: tripPickup.lat, lng: tripPickup.lng },
        { lat: tripDestination.lat, lng: tripDestination.lng },
      );
      if (!total) return 0;
      const travelled = haversineKm(
        { lat: tripPickup.lat, lng: tripPickup.lng },
        driverPosition,
      );
      return Math.max(0, Math.min(1, travelled / total));
    }
    return 0;
  }, [driverPosition, tripStatus, tripPickup, tripDestination]);

  const seedPickup = () => {
    setPickup({
      id: 'current',
      name: 'Current location',
      address: 'Using your GPS',
      lat: currentLatLng.lat,
      lng: currentLatLng.lng,
      category: 'recent',
    });
  };

  const openSearch = () => {
    seedPickup();
    router.push('/(main)/search');
  };

  const onRecentPress = (place: Place) => {
    seedPickup();
    setDestination(place);
    router.push('/(main)/confirm-destination');
  };

  const onMenu = () => router.push('/(main)/(tabs)/account');

  const resumeTrip = () => {
    if (tripStatus === 'in_trip') router.push('/(main)/in-trip');
    else if (tripStatus === 'matched' || tripStatus === 'arrived')
      router.push('/(main)/driver-matched');
  };

  const initialRegion = useMemo(
    () => ({
      latitude: currentLatLng.lat,
      longitude: currentLatLng.lng,
      ...DEFAULT_ZOOM,
    }),
    // Only run on mount — zero-duration animateToRegion handles the GPS update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const otwLabel =
    tripStatus === 'matched'
      ? `${tripDriver?.name?.split(' ')[0] ?? 'Driver'} is on the way`
      : tripStatus === 'arrived'
        ? `${tripDriver?.name?.split(' ')[0] ?? 'Driver'} has arrived`
        : tripStatus === 'in_trip'
          ? 'On your trip'
          : null;

  const remainingMin = Math.max(1, Math.round((trip?.fare.etaMin ?? 1) * (1 - progress)));
  const first = tripDriver?.name?.split(' ')[0] ?? 'Driver';
  const panelTitle =
    tripStatus === 'matched'
      ? `${first} is on the way`
      : tripStatus === 'arrived'
        ? `${first} has arrived`
        : `Heading to ${tripDestination?.name ?? 'destination'}`;
  const panelSubtitle =
    tripStatus === 'matched'
      ? `Arriving in ~${remainingMin} min · Meet at ${tripPickup?.name ?? 'pickup'}`
      : tripStatus === 'arrived'
        ? `Meet your driver at ${tripPickup?.name ?? 'pickup'}`
        : `Arrival in ~${remainingMin} min`;

  const distanceKm =
    driverPosition
      ? tripStatus === 'in_trip' && tripDestination
        ? haversineKm(driverPosition, { lat: tripDestination.lat, lng: tripDestination.lng })
        : tripPickup
          ? haversineKm(driverPosition, { lat: tripPickup.lat, lng: tripPickup.lng })
          : null
      : null;

  const progressBarPhase = tripStatus === 'in_trip' ? 'intrip' : 'approach';
  const progressLeftLabel =
    tripStatus === 'arrived'
      ? 'Arrived'
      : tripStatus === 'in_trip'
        ? `On trip · ${Math.round(progress * 100)}%`
        : `On the way · ${Math.round(progress * 100)}%`;
  const progressRightLabel =
    tripStatus === 'arrived' ? 'Boarding shortly' : formatDistance(distanceKm);

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-[45]">
        {tripActive && tripPickup && tripDestination ? (
          <RouteMap
            pickup={{ lat: tripPickup.lat, lng: tripPickup.lng }}
            destination={{ lat: tripDestination.lat, lng: tripDestination.lng }}
            driverPosition={driverPosition}
            driverHeading={driverHeading}
            routePolyline={trip?.routePolyline}
            phase={tripStatus === 'in_trip' ? 'intrip' : 'approach'}
            topInset={80}
            bottomInset={32}
          />
        ) : (
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            showsUserLocation
            scrollEnabled
            zoomEnabled
            initialRegion={initialRegion}
          >
            {NEARBY_OFFSETS.map((d) => {
              const drift = Math.sin(driftTick * 0.25 + d.phase) * NEARBY_DRIFT;
              return (
                <Marker
                  key={d.id}
                  coordinate={{
                    latitude: currentLatLng.lat + d.dLat + drift,
                    longitude: currentLatLng.lng + d.dLng - drift,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  zIndex={2}
                >
                  <CarMarker variant="nearby" />
                </Marker>
              );
            })}
            {tripDestination && destinationPreview ? (
              <>
                <Polyline
                  coordinates={destinationPreview}
                  strokeColor="#111111"
                  strokeWidth={3}
                  lineDashPattern={[6, 6]}
                />
                <Marker
                  coordinate={{ latitude: tripDestination.lat, longitude: tripDestination.lng }}
                  anchor={{ x: 0.5, y: 0.5 }}
                  zIndex={4}
                >
                  <DestinationPin />
                </Marker>
              </>
            ) : null}
          </MapView>
        )}

        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <View className="px-gutter pt-2">
            <Pressable
              onPress={onMenu}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel="Menu"
              className="h-11 w-11 items-center justify-center rounded-full bg-surface shadow-md"
            >
              <Icon name="menu" size={22} color="#111111" />
            </Pressable>
          </View>
        </SafeAreaView>

        {otwLabel ? (
          <View className="absolute left-0 right-0 top-16 items-center">
            <View className="flex-row items-center rounded-full bg-primary px-4 py-2 shadow-md">
              <Icon name="directions-car" size={16} color="#FFFFFF" />
              <Text weight="bold" className="ml-2 text-sm text-white">
                {otwLabel}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View
        className="flex-[55] -mt-4 rounded-t-3xl border-t border-border bg-surface"
        style={{ shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8 }}
      >
        <View className="mx-auto mt-2 h-1.5 w-11 rounded-full bg-border" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}
        >
          {tripActive && tripDriver && trip ? (
            <Pressable
              onPress={resumeTrip}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={`Resume trip: ${panelTitle}`}
              className="active:opacity-95"
            >
              <TripStatusHeader title={panelTitle} subtitle={panelSubtitle} />

              <TripProgressBar
                progress={progress}
                phase={progressBarPhase}
                leftLabel={progressLeftLabel}
                rightLabel={progressRightLabel}
              />

              <View className="mt-5 flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <DriverCard driver={tripDriver} />
                </View>
                <CallChatButtons
                  phone={tripDriver.phone}
                  onChat={() => chatRef.current?.present()}
                />
              </View>

              <View className="mt-5 flex-row items-center justify-center">
                <Icon name="open-in-full" size={14} color="#6B7280" />
                <Text tone="secondary" className="ml-1.5 text-xs">
                  Tap to open trip
                </Text>
              </View>
            </Pressable>
          ) : (
            <>
              <Text weight="bold" className="text-2xl leading-tight">
                {t('home.tagline')}
              </Text>

              <View className="mt-5">
                <WhereToBar onPress={openSearch} placeholder={t('home.whereTo')} />
              </View>

              {recent.length > 0 ? (
                <View className="mt-5 -mx-1">
                  {recent.slice(0, 3).map((place) => (
                    <RecentPlaceRow key={place.id} place={place} onPress={onRecentPress} />
                  ))}
                </View>
              ) : null}

              <View className="mt-5">
                <RidesActionCard onPress={openSearch} />
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {tripDriver ? <MockChatSheet ref={chatRef} driver={tripDriver} /> : null}
    </View>
  );
}
