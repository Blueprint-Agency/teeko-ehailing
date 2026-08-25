import { useCallback, useRef } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { useSupportStore, useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import type { SupportTicket } from '@teeko/shared';
import { type BottomSheetHandle, Button, Icon, Pressable, ScreenContainer, Spinner, Text } from '@teeko/ui';
import { useFocusEffect, useRouter } from 'expo-router';

import { SupportSheet, type SupportSubmitInput } from '../../../components/SupportSheet';
import { SupportStatusPill } from '../../../components/SupportStatusPill';

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

export default function SupportScreen() {
  const t = useT();
  const router = useRouter();
  const tickets = useSupportStore((s) => s.all);
  const loading = useSupportStore((s) => s.allLoading);
  const submitting = useSupportStore((s) => s.submitting);
  const loadAll = useSupportStore((s) => s.loadAll);
  const submit = useSupportStore((s) => s.submit);
  const pushToast = useUIStore((s) => s.pushToast);

  const sheetRef = useRef<BottomSheetHandle>(null);

  // Refresh on focus so admin status changes show up when the rider returns.
  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  const isEmpty = tickets.length === 0;
  const pendingCount = tickets.filter((tk) => tk.status !== 'resolved').length;
  const atLimit = pendingCount >= 5;

  const handleSubmit = async (input: SupportSubmitInput) => {
    if (atLimit) {
      sheetRef.current?.dismiss();
      pushToast({ kind: 'error', message: t('support.limitReached') });
      return;
    }
    const result = await submit(input);
    sheetRef.current?.dismiss();
    pushToast(
      result
        ? { kind: 'success', message: t('support.submitSuccess') }
        : { kind: 'error', message: t('support.submitError') },
    );
  };

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
        <Text weight="bold" className="flex-1 text-xl">
          {t('support.myTicketsTitle')}
        </Text>
        <Pressable
          onPress={() => !atLimit && sheetRef.current?.present()}
          haptic="light"
          accessibilityRole="button"
          accessibilityLabel={t('support.newTicket')}
          disabled={atLimit}
          className={`h-10 w-10 items-center justify-center rounded-full active:bg-muted ${atLimit ? 'opacity-30' : ''}`}
        >
          <Icon name="add" size={26} color="#E11D2E" />
        </Pressable>
      </View>

      {/* Limit banner */}
      {atLimit && (
        <View className="mx-gutter mb-2 rounded-lg bg-amber-50 px-4 py-3">
          <Text className="text-sm text-amber-800">
            {t('support.limitReached')}
          </Text>
        </View>
      )}

      {loading && isEmpty ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : isEmpty ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Icon name="support-agent" size={36} color="#666" />
          </View>
          <Text weight="bold" className="text-center text-2xl">
            {t('support.myTicketsEmptyTitle')}
          </Text>
          <Text tone="secondary" className="mt-3 text-center text-base">
            {t('support.myTicketsEmptyBody')}
          </Text>
          <View className="mt-6 w-full">
            <Button
              label={t('support.contactSupport')}
              leadingIcon="add"
              onPress={() => sheetRef.current?.present()}
            />
          </View>
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
            {tickets.map((ticket, i) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                t={t}
                last={i === tickets.length - 1}
              />
            ))}
          </View>
        </ScrollView>
      )}

      <SupportSheet ref={sheetRef} submitting={submitting} onConfirm={handleSubmit} />
    </ScreenContainer>
  );
}

function TicketCard({
  ticket,
  t,
  last,
}: {
  ticket: SupportTicket;
  t: (key: string) => string;
  last: boolean;
}) {
  return (
    <View className={`px-gutter py-4 ${last ? '' : 'border-b border-border'}`}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text weight="medium" className="text-base">
            {ticket.subject}
          </Text>
          <Text tone="secondary" className="mt-0.5 text-sm">
            {`${t(`support.categoryLabel.${ticket.category}`)} · ${formatWhen(ticket.createdAt)}`}
          </Text>
        </View>
        <SupportStatusPill status={ticket.status} />
      </View>

      <Text tone="secondary" numberOfLines={2} className="mt-2 text-sm">
        {ticket.description}
      </Text>
    </View>
  );
}
