import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import {
  useLocationStore,
  usePaymentsStore,
  usePlacesStore,
  useTripStore,
} from '@teeko/api';
import { useT } from '@teeko/i18n';
import type { Place } from '@teeko/shared';
import { Icon, Pressable, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { DestinationMapCard } from '../../../components/DestinationMapCard';
import { RecentPlaceRow } from '../../../components/RecentPlaceRow';

export default function HomeTab() {
  const router = useRouter();
  const t = useT();
  const recent = usePlacesStore((s) => s.recent);
  const saved = usePlacesStore((s) => s.saved);
  const loadRecent = usePlacesStore((s) => s.loadRecent);
  const loadSaved = usePlacesStore((s) => s.loadSaved);
  const setDestination = useTripStore((s) => s.setDestination);
  const setCurrent = useLocationStore((s) => s.setCurrent);
  const setPermission = useLocationStore((s) => s.setPermission);
  const paymentMethods = usePaymentsStore((s) => s.methods);
  const loadPayments = usePaymentsStore((s) => s.load);

  useEffect(() => {
    loadRecent();
    loadSaved();
    loadPayments().catch(() => {
      // ignore — the add-payment prompt just stays visible on failure
    });
  }, [loadRecent, loadSaved, loadPayments]);

  // One-shot location read to warm the pickup for the booking flow and to seed
  // the destination map card's initial region. We still do NOT query nearby
  // drivers here — driver-location fetches happen only once the rider enters the
  // booking flow (see "Nearby-Driver Queries & Backend Load" in teeko-tech-stack.md).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermission(
          status === 'granted'
            ? 'granted'
            : status === 'denied'
              ? 'denied'
              : 'undetermined',
        );
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setCurrent({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        // ignore — pickup falls back to manual entry in search
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setCurrent, setPermission]);

  const homePlace = saved.find((p) => p.category === 'home');
  const workPlace = saved.find((p) => p.category === 'work');

  const goToSearch = () => router.push('/(main)/search');

  const onShortcut = (place: Place | undefined, intent: 'saveHome' | 'saveWork') => {
    if (place) {
      setDestination(place);
      router.push('/(main)/confirm-destination');
    } else {
      router.push({ pathname: '/(main)/search', params: { intent } });
    }
  };

  const onRecent = (p: Place) => {
    setDestination(p);
    router.push('/(main)/confirm-destination');
  };

  const onPinDestination = (p: Place) => {
    setDestination(p);
    router.push('/(main)/confirm-destination');
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface">
      <ScrollView
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text weight="bold" className="px-gutter pb-5 pt-4 text-3xl leading-tight">
          {t('home.tagline')}
        </Text>

        <View className="mt-4">
          <DestinationMapCard
            onConfirm={onPinDestination}
            onSearchPress={goToSearch}
            searchPlaceholder={t('home.whereTo')}
            hint={t('home.mapHint')}
            confirmLabel={t('home.setDestination')}
            locatingLabel={t('home.locating')}
          />
        </View>

        <View className="mt-3 flex-row gap-3 px-gutter">
          <Shortcut
            icon="home"
            label={homePlace?.address ? t('home.home') : t('home.setHome')}
            onPress={() => onShortcut(homePlace, 'saveHome')}
          />
          <Shortcut
            icon="work"
            label={workPlace?.address ? t('home.work') : t('home.setWork')}
            onPress={() => onShortcut(workPlace, 'saveWork')}
          />
        </View>

        {paymentMethods.length === 0 ? (
          <View className="mt-3 px-gutter">
            <Pressable
              onPress={() => router.push('/(main)/account/add-card' as never)}
              haptic="light"
              accessibilityRole="button"
              accessibilityLabel={t('home.addPayment')}
              className="flex-row items-center rounded-2xl border border-border bg-muted px-4 py-3 active:opacity-80"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-surface">
                <Icon name="credit-card" size={20} color="#111111" />
              </View>
              <View className="ml-3 flex-1">
                <Text weight="medium" className="text-sm">
                  {t('home.addPayment')}
                </Text>
                <Text tone="secondary" className="text-xs">
                  {t('home.addPaymentSubtitle')}
                </Text>
              </View>
              <Icon name="add" size={22} color="#111111" />
            </Pressable>
          </View>
        ) : null}

        {recent.length > 0 ? (
          <View className="mt-6">
            <Text
              weight="bold"
              className="px-gutter pb-2 text-xs uppercase tracking-wide text-ink-secondary"
            >
              {t('home.recent')}
            </Text>
            {recent.map((p) => (
              <RecentPlaceRow key={p.id} place={p} onPress={() => onRecent(p)} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Shortcut({
  icon,
  label,
  onPress,
}: {
  icon: 'home' | 'work';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      className="h-12 flex-1 flex-row items-center rounded-full bg-muted px-4 active:opacity-80"
    >
      <Icon name={icon} size={18} color="#111111" />
      <Text weight="medium" className="ml-2 text-sm">
        {label}
      </Text>
    </Pressable>
  );
}
