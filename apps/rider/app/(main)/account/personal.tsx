import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ApiError, authApi, useAuthStore, useUIStore } from '@teeko/api';
import type { PhoneChangeState } from '@teeko/api';
import { formatPhoneDisplay, formatUnlockDate } from '@teeko/shared';
import { useT } from '@teeko/i18n';
import { Button, Card, Icon, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useFocusEffect, useRouter } from 'expo-router';

// Name is still a plain save. The phone is not: every change after registration
// needs an email OTP and is capped at one per 30 days, so it gets its own row
// with a Change action rather than sitting in the same "Save changes" batch.

export default function PersonalInfoScreen() {
  const router = useRouter();
  const t = useT();
  const rider = useAuthStore((s) => s.rider);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const pushToast = useUIStore((s) => s.pushToast);

  const [name, setName] = useState(rider?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [phoneState, setPhoneState] = useState<PhoneChangeState | null>(null);

  const email = rider?.email ?? '';
  const dirtyName = name.trim() !== (rider?.name ?? '');

  const loadPhoneState = useCallback(async () => {
    try {
      setPhoneState(await authApi.getPhoneChangeState());
    } catch {
      // A failed read just means the row renders without its cooldown hint —
      // the server still enforces both rules, so this is not worth a toast.
    }
  }, []);

  // Refetch on focus: the rider may have just come back from the change screen,
  // or an admin may have decided on their request while the app was open.
  useFocusEffect(
    useCallback(() => {
      void loadPhoneState();
    }, [loadPhoneState]),
  );

  const onSaveName = async () => {
    setSaving(true);
    try {
      await updateProfile({ fullName: name.trim() });
      router.back();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? undefined
          : (err as { errors?: Array<{ message?: string }> }).errors?.[0]?.message;
      pushToast({
        kind: 'error',
        message: message ? `Save failed: ${message}` : 'Could not save changes.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center pb-3 pt-2">
        <Pressable onPress={() => router.back()} haptic="selection" className="-ml-2 p-2">
          <Icon name="close" size={24} color="#111111" />
        </Pressable>
        <Text weight="bold" className="ml-2 text-lg">
          Personal info
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="mt-4 gap-4">
          <Input label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />

          <View>
            <Text tone="secondary" className="mb-1 text-xs">
              Email
            </Text>
            <View className="rounded-lg border border-border bg-muted px-4 py-3">
              <Text>{email || '—'}</Text>
            </View>
            <Text tone="faint" className="mt-1 text-xs">
              Email is managed by your sign-in account.
            </Text>
          </View>

          <PhoneRow
            phone={rider?.phone ?? ''}
            phoneCountry={rider?.phoneCountry}
            state={phoneState}
            onChange={() => router.push('/(main)/account/phone-change' as never)}
            onWithdraw={async () => {
              try {
                await authApi.withdrawPhoneChangeRequest();
                pushToast({ kind: 'success', message: t('phone.withdrawn') });
                await loadPhoneState();
              } catch {
                pushToast({ kind: 'error', message: 'Could not withdraw the request.' });
              }
            }}
          />
        </View>
      </ScrollView>

      <View className="pb-safe pt-2">
        <Button
          label="Save changes"
          onPress={onSaveName}
          loading={saving}
          disabled={!dirtyName || !name.trim()}
        />
      </View>
    </ScreenContainer>
  );
}

function PhoneRow({
  phone,
  phoneCountry,
  state,
  onChange,
  onWithdraw,
}: {
  phone: string;
  phoneCountry?: string;
  state: PhoneChangeState | null;
  onChange: () => void;
  onWithdraw: () => void;
}) {
  const t = useT();
  const pending = state?.pending ?? null;
  const locked = !!state?.nextAllowedAt;

  // Surface a rejection once, so the rider learns *why* rather than just
  // finding the field editable again.
  const rejection =
    state?.lastDecision?.status === 'rejected' && !pending ? state.lastDecision : null;

  return (
    <View>
      <Text tone="secondary" className="mb-1 text-xs">
        {t('phone.label')}
      </Text>
      <View className="flex-row items-center rounded-lg border border-border bg-muted px-4 py-3">
        <Text className="flex-1">{formatPhoneDisplay(phone, phoneCountry) || '—'}</Text>
        {pending ? (
          <Text tone="secondary" className="text-xs">
            {t('phone.inReview', { date: formatUnlockDate(pending.createdAt) })}
          </Text>
        ) : (
          <Pressable onPress={onChange} haptic="selection" accessibilityRole="button">
            <Text weight="bold" tone="brand" className="text-sm">
              {t('phone.change')}
            </Text>
          </Pressable>
        )}
      </View>

      {pending ? (
        <View className="mt-2 flex-row items-center justify-between">
          <Text tone="secondary" className="flex-1 text-xs">
            {formatPhoneDisplay(pending.requestedValue, pending.requestedCountry)}
          </Text>
          <Pressable onPress={onWithdraw} haptic="selection" accessibilityRole="button">
            <Text weight="medium" tone="danger" className="text-xs">
              {t('phone.withdraw')}
            </Text>
          </Pressable>
        </View>
      ) : locked ? (
        <Text tone="faint" className="mt-1 text-xs">
          {t('phone.nextChange', { date: formatUnlockDate(state!.nextAllowedAt!) })}
        </Text>
      ) : null}

      {rejection ? (
        <Card className="mt-3 border-danger/40 bg-danger/5 p-3">
          <Text weight="medium" tone="danger" className="text-sm">
            {t('phone.rejectedTitle')}
          </Text>
          {rejection.reviewNote ? (
            <Text tone="secondary" className="mt-1 text-xs">
              {rejection.reviewNote}
            </Text>
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}
