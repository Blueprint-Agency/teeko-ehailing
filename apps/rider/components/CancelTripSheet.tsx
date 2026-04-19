import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@teeko/i18n';
import { BottomSheet, type BottomSheetHandle, Button, Icon, Pressable, Text } from '@teeko/ui';

const REASON_KEYS = [
  'driverFar',
  'changedPlans',
  'waiting',
  'mistake',
  'other',
] as const;

export type CancelReason = (typeof REASON_KEYS)[number];

const REASON_I18N_KEY: Record<CancelReason, string> = {
  driverFar: 'trip.reasonDriverFar',
  changedPlans: 'trip.reasonChangedPlans',
  waiting: 'trip.reasonWaiting',
  mistake: 'trip.reasonMistake',
  other: 'trip.reasonOther',
};

export interface CancelTripSheetProps {
  onConfirm: (reason: CancelReason) => void;
}

export const CancelTripSheet = forwardRef<BottomSheetHandle, CancelTripSheetProps>(
  function CancelTripSheet({ onConfirm }, ref) {
    const t = useT();
    const sheetRef = useRef<BottomSheetHandle>(null);
    const [reason, setReason] = useState<CancelReason | null>(null);

    useImperativeHandle(ref, () => ({
      present: () => {
        setReason(null);
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const confirm = () => {
      if (!reason) return;
      onConfirm(reason);
    };

    return (
      <BottomSheet ref={sheetRef} snapPoints={['65%']}>
        <View className="gap-3 pb-2">
          <Text weight="bold" className="text-xl">
            {t('trip.cancelTitle')}
          </Text>

          <View className="flex-row items-center rounded-lg bg-primary-50 px-3 py-2">
            <Icon name="info" size={16} color="#E11D2E" />
            <Text className="ml-2 text-xs text-primary">
              {t('trip.freeCancellation')}
            </Text>
          </View>

          <Text tone="secondary" className="mt-1 text-sm">
            {t('trip.whyCancelling')}
          </Text>

          <View className="gap-2">
            {REASON_KEYS.map((r) => {
              const active = r === reason;
              return (
                <Pressable
                  key={r}
                  onPress={() => setReason(r)}
                  haptic="selection"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  className={`flex-row items-center justify-between rounded-lg border px-4 py-3 active:opacity-90 ${
                    active ? 'border-primary bg-primary-50' : 'border-border bg-surface'
                  }`}
                >
                  <Text
                    weight="medium"
                    className={`text-sm ${active ? 'text-primary' : 'text-ink-primary'}`}
                  >
                    {t(REASON_I18N_KEY[r])}
                  </Text>
                  {active ? <Icon name="check" size={18} color="#E11D2E" /> : null}
                </Pressable>
              );
            })}
          </View>

          <View className="mt-3 gap-2">
            <Button label={t('trip.cancelRide')} onPress={confirm} disabled={!reason} />
            <Button
              label={t('trip.keepRide')}
              variant="ghost"
              onPress={() => sheetRef.current?.dismiss()}
            />
          </View>
        </View>
      </BottomSheet>
    );
  },
);
