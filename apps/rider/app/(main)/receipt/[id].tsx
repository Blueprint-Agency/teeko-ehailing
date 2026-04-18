import { useEffect, useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { usePaymentsStore, useTripStore } from '@teeko/api';
import type { RideCategory } from '@teeko/shared';
import { Icon, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';

const RIDE_LABELS: Record<RideCategory, string> = {
  go: 'Teeko Go',
  comfort: 'Comfort',
  xl: 'XL',
  premium: 'Premium',
  bike: 'Bike',
};

function formatFullDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${date} · ${hh}:${mm}`;
}

export default function ReceiptScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const history = useTripStore((s) => s.history);
  const loadHistory = useTripStore((s) => s.loadHistory);
  const methods = usePaymentsStore((s) => s.methods);
  const loadPayments = usePaymentsStore((s) => s.load);

  useEffect(() => {
    if (history.length === 0) loadHistory();
  }, [history.length, loadHistory]);

  useEffect(() => {
    if (methods.length === 0) loadPayments();
  }, [methods.length, loadPayments]);

  const trip = useMemo(() => history.find((t) => t.id === id), [history, id]);
  const payment = useMemo(
    () => methods.find((m) => m.id === trip?.paymentMethodId),
    [methods, trip?.paymentMethodId],
  );

  if (!trip) {
    return (
      <ScreenContainer>
        <Header onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center">
          <Text tone="secondary">Loading receipt…</Text>
        </View>
      </ScreenContainer>
    );
  }

  const cancelled = trip.status === 'cancelled';
  const ts = trip.completedAt ?? trip.cancelledAt ?? trip.createdAt;
  const fareLabel = cancelled ? 'RM 0.00' : `RM ${trip.fare.amountMyr.toFixed(2)}`;

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <Header onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <Text tone="secondary" className="mt-1 text-sm">
          {formatFullDateTime(ts)}
        </Text>

        <Text weight="bold" className="mt-4 text-4xl">
          {fareLabel}
        </Text>
        <Text tone="secondary" className="mt-1 text-sm">
          {cancelled ? 'Cancelled' : 'Total fare'}
        </Text>

        {cancelled && trip.cancelReason ? (
          <View className="mt-4 rounded-lg bg-muted px-4 py-3">
            <Text tone="secondary" className="text-xs uppercase tracking-wide">
              Reason
            </Text>
            <Text className="mt-1 text-sm">{trip.cancelReason}</Text>
          </View>
        ) : null}

        <View className="mt-6 rounded-xl border border-border bg-surface shadow-sm">
          <Row
            icon="trip-origin"
            label="Pickup"
            value={trip.pickup.name}
            sub={trip.pickup.address}
          />
          <Row
            icon="place"
            label="Destination"
            value={trip.destination.name}
            sub={trip.destination.address}
            last
          />
        </View>

        <View className="mt-4 rounded-xl border border-border bg-surface shadow-sm">
          <Row icon="local-taxi" label="Ride type" value={RIDE_LABELS[trip.rideType]} />
          <Row
            icon="credit-card"
            label="Payment method"
            value={payment?.label ?? '—'}
            sub={payment?.last4 ? `•••• ${payment.last4}` : undefined}
            last
          />
        </View>

        {trip.driver && !cancelled ? (
          <View className="mt-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <Text
              tone="secondary"
              className="text-xs uppercase tracking-wide"
              weight="medium"
            >
              Driver
            </Text>
            <View className="mt-2 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text weight="bold" className="text-base">
                  {trip.driver.name}
                </Text>
                <Text tone="secondary" className="mt-0.5 text-sm">
                  {trip.driver.vehicle.colour} {trip.driver.vehicle.model}
                </Text>
              </View>
              <View className="rounded-md bg-muted px-3 py-1.5">
                <Text weight="bold" className="tracking-wider">
                  {trip.driver.plate}
                </Text>
              </View>
            </View>
            {typeof trip.rating === 'number' ? (
              <View className="mt-3 flex-row items-center">
                <Icon name="star" size={16} color="#E11D2E" />
                <Text className="ml-1 text-sm">
                  You rated {trip.rating.toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text tone="faint" className="mt-6 text-center text-xs">
          Trip ID · {trip.id}
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-row items-center pb-3 pt-2">
      <Pressable onPress={onBack} haptic="selection" className="-ml-2 p-2">
        <Icon name="arrow-back" size={24} color="#111111" />
      </Pressable>
      <Text weight="bold" className="ml-2 text-lg">
        Receipt
      </Text>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  sub,
  last,
}: {
  icon: 'trip-origin' | 'place' | 'local-taxi' | 'credit-card';
  label: string;
  value: string;
  sub?: string;
  last?: boolean;
}) {
  return (
    <View
      className={`flex-row items-start px-4 py-3 ${last ? '' : 'border-b border-border'}`}
    >
      <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-muted">
        <Icon name={icon} size={18} color="#4B5563" />
      </View>
      <View className="flex-1">
        <Text tone="secondary" className="text-xs">
          {label}
        </Text>
        <Text weight="medium" className="mt-0.5 text-sm">
          {value}
        </Text>
        {sub ? (
          <Text tone="secondary" className="mt-0.5 text-xs">
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
