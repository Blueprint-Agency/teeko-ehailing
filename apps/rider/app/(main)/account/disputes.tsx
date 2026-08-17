import { useCallback } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useDisputeStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import type { RiderDispute } from '@teeko/shared';
import { Icon, Pressable, ScreenContainer, Spinner, Text } from '@teeko/ui';
import { useFocusEffect, useRouter } from 'expo-router';

import { DisputeStatusPill } from '../../../components/DisputeStatusPill';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DisputesScreen() {
  const t = useT();
  const router = useRouter();
  const disputes = useDisputeStore((s) => s.all);
  const loading = useDisputeStore((s) => s.allLoading);
  const loadAll = useDisputeStore((s) => s.loadAll);

  // Refresh on focus so status changes made by admins show up when the rider
  // returns to the screen.
  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const isEmpty = disputes.length === 0;

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
          {t('dispute.myReportsTitle')}
        </Text>
      </View>

      {loading && isEmpty ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : isEmpty ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Icon name="flag" size={36} color="#666" />
          </View>
          <Text weight="bold" className="text-center text-2xl">
            {t('dispute.myReportsEmptyTitle')}
          </Text>
          <Text tone="secondary" className="mt-3 text-center text-base">
            {t('dispute.myReportsEmptyBody')}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadAll} tintColor="#E11D2E" />
          }
        >
          <View className="mt-4 border-y border-border bg-surface">
            {disputes.map((d, i) => (
              <DisputeCard
                key={d.id}
                dispute={d}
                t={t}
                last={i === disputes.length - 1}
                onPress={() => router.push(`/(main)/receipt/${d.tripId}`)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

function DisputeCard({
  dispute,
  t,
  last,
  onPress,
}: {
  dispute: RiderDispute;
  t: (key: string) => string;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      className={`px-gutter py-4 active:bg-muted ${last ? '' : 'border-b border-border'}`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text weight="medium" className="text-base">
            {t(`dispute.categoryLabel.${dispute.category}`)}
          </Text>
          <Text tone="secondary" className="mt-0.5 text-sm">
            {`${t('dispute.tripRef')} #${dispute.tripId.slice(0, 8)} · ${formatWhen(dispute.createdAt)}`}
          </Text>
        </View>
        <DisputeStatusPill status={dispute.status} />
      </View>

      <Text tone="secondary" numberOfLines={2} className="mt-2 text-sm">
        {dispute.description}
      </Text>

      {typeof dispute.amountMyr === 'number' ? (
        <Text weight="medium" className="mt-1 text-sm">
          {`${t('dispute.amountLabel')}: RM ${dispute.amountMyr.toFixed(2)}`}
        </Text>
      ) : null}

      {dispute.resolution ? (
        <View className="mt-2 rounded-lg bg-muted px-3 py-2">
          <Text tone="secondary" className="text-sm">
            {`${t('dispute.resolutionLabel')}: ${dispute.resolution}`}
          </Text>
        </View>
      ) : null}

      <View className="mt-2 flex-row items-center">
        <Text weight="medium" className="text-sm text-primary">
          {t('dispute.viewReceipt')}
        </Text>
        <Icon name="chevron-right" size={18} color="#E11D2E" />
      </View>
    </Pressable>
  );
}
