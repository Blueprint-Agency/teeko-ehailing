import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { tripsApi } from '@teeko/api';
import { useT } from '@teeko/i18n';
import type { TripReceipt } from '@teeko/shared';
import { Icon, Pressable, ScreenContainer, Spinner, Text } from '@teeko/ui';
import { useLocalSearchParams, useRouter } from 'expo-router';

function money(myr: number): string {
  return `RM ${myr.toFixed(2)}`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReceiptScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [receipt, setReceipt] = useState<TripReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) return;
    setLoading(true);
    setError(false);
    tripsApi
      .detail(id)
      .then((r) => {
        if (active) setReceipt(r);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const cancelled = receipt?.status === 'cancelled';

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="flex-row items-center px-gutter pb-2 pt-2">
        <Pressable
          onPress={() => router.back()}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="mr-2 h-10 w-10 items-center justify-center rounded-full active:bg-muted"
        >
          <Icon name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text weight="bold" className="text-xl">
          {t('receipt.title')}
        </Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : error || !receipt ? (
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="error-outline" size={36} color="#9CA3AF" />
          <Text tone="secondary" className="mt-3 text-center text-base">
            {t('receipt.loadError')}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Date + fare headline */}
          <View className="items-center px-gutter pb-6 pt-2">
            <Text weight="bold" className={cancelled ? 'text-3xl text-ink-secondary line-through' : 'text-3xl'}>
              {money(receipt.fareMyr)}
            </Text>
            <Text tone="secondary" className="mt-1 text-sm">
              {formatWhen(receipt.completedAt ?? receipt.cancelledAt ?? receipt.createdAt)}
            </Text>
            {cancelled ? (
              <Text weight="medium" className="mt-1 text-sm text-primary">
                {t('rides.cancelled')}
              </Text>
            ) : null}
          </View>

          {/* Route */}
          <Section>
            <View className="flex-row items-start px-gutter py-3">
              <Icon name="trip-origin" size={16} color="#4B5563" />
              <Text className="ml-3 flex-1 text-base" numberOfLines={2}>
                {receipt.pickup.address || receipt.pickup.name || '—'}
              </Text>
            </View>
            <View className="h-px bg-border" />
            <View className="flex-row items-start px-gutter py-3">
              <Icon name="place" size={16} color="#E11D2E" />
              <Text className="ml-3 flex-1 text-base" numberOfLines={2}>
                {receipt.destination.address || receipt.destination.name || '—'}
              </Text>
            </View>
          </Section>

          {/* Driver */}
          {receipt.driver ? (
            <Section title={t('receipt.driver')}>
              <View className="flex-row items-center px-gutter py-3">
                <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <Icon name="person" size={22} color="#4B5563" />
                </View>
                <View className="flex-1">
                  <Text weight="medium" className="text-base">
                    {receipt.driver.name}
                  </Text>
                  <Text tone="secondary" className="text-sm">
                    {`${receipt.driver.vehicle.model}${receipt.driver.plate ? ` · ${receipt.driver.plate}` : ''}`}
                  </Text>
                </View>
              </View>
            </Section>
          ) : null}

          {/* Fare breakdown */}
          <Section title={t('receipt.fareBreakdown')}>
            {receipt.fareLines.map((line, i) => (
              <Row key={`${line.kind}-${i}`} label={t(`receipt.lines.${line.kind}`)} value={money(line.amountMyr)} />
            ))}
            {typeof receipt.cancellationFeeMyr === 'number' ? (
              <Row label={t('receipt.cancellationFee')} value={money(receipt.cancellationFeeMyr)} />
            ) : null}
            <View className="h-px bg-border" />
            <Row label={t('receipt.total')} value={money(receipt.fareMyr)} bold />
          </Section>

          {/* Payment */}
          <Section title={t('receipt.paymentMethod')}>
            <View className="flex-row items-center px-gutter py-3">
              <Icon name="credit-card" size={20} color="#4B5563" />
              <Text weight="medium" className="ml-3 text-base">
                {receipt.paymentLabel}
              </Text>
            </View>
          </Section>

          {/* Rating */}
          <Section title={t('receipt.yourRating')}>
            {typeof receipt.rating === 'number' ? (
              <View className="px-gutter py-3">
                <View className="flex-row gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Icon key={n} name="star" size={24} color={n <= receipt.rating! ? '#F5A524' : '#E5E7EB'} />
                  ))}
                </View>
                {receipt.comment ? (
                  <Text tone="secondary" className="mt-2 text-sm">
                    {receipt.comment}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text tone="secondary" className="px-gutter py-3 text-sm">
                {t('receipt.notRated')}
              </Text>
            )}
          </Section>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View className="mt-4">
      {title ? (
        <Text
          weight="bold"
          className="px-gutter pb-2 text-xs uppercase tracking-wide text-ink-secondary"
        >
          {title}
        </Text>
      ) : null}
      <View className="border-y border-border bg-surface">{children}</View>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View className="flex-row items-center justify-between px-gutter py-3">
      <Text weight={bold ? 'bold' : 'regular'} className="text-base">
        {label}
      </Text>
      <Text weight={bold ? 'bold' : 'medium'} className="text-base">
        {value}
      </Text>
    </View>
  );
}
