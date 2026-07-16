import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { useT } from '@teeko/i18n';
import type { DisputeCategory } from '@teeko/shared';
import { BottomSheet, type BottomSheetHandle, Button, Icon, Input, Pressable, Text } from '@teeko/ui';

const CATEGORY_KEYS: DisputeCategory[] = [
  'overcharge',
  'payment',
  'service',
  'safety',
  'lost_item',
  'other',
];

const CATEGORY_I18N_KEY: Record<DisputeCategory, string> = {
  overcharge: 'dispute.categoryLabel.overcharge',
  payment: 'dispute.categoryLabel.payment',
  service: 'dispute.categoryLabel.service',
  safety: 'dispute.categoryLabel.safety',
  lost_item: 'dispute.categoryLabel.lost_item',
  other: 'dispute.categoryLabel.other',
};

// Categories that carry a disputed money amount.
const MONEY_CATEGORIES: DisputeCategory[] = ['overcharge', 'payment'];

export interface DisputeSubmitInput {
  category: DisputeCategory;
  amountMyr?: number;
  description: string;
}

export interface DisputeSheetProps {
  /** Trip fare, used to prefill the amount for money categories. */
  fareMyr?: number;
  submitting?: boolean;
  onConfirm: (input: DisputeSubmitInput) => void;
}

export const DisputeSheet = forwardRef<BottomSheetHandle, DisputeSheetProps>(
  function DisputeSheet({ fareMyr, submitting, onConfirm }, ref) {
    const t = useT();
    const sheetRef = useRef<BottomSheetHandle>(null);
    const [category, setCategory] = useState<DisputeCategory | null>(null);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    useImperativeHandle(ref, () => ({
      present: () => {
        setCategory(null);
        setAmount('');
        setDescription('');
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const showAmount = category != null && MONEY_CATEGORIES.includes(category);
    const canSubmit = category != null && description.trim().length > 0 && !submitting;

    const amountPlaceholder = useMemo(
      () => (typeof fareMyr === 'number' ? fareMyr.toFixed(2) : '0.00'),
      [fareMyr],
    );

    const pickCategory = (c: DisputeCategory) => {
      setCategory(c);
      // Prefill the disputed amount with the trip fare the first time a money
      // category is chosen, so the rider can adjust rather than type from zero.
      if (MONEY_CATEGORIES.includes(c) && !amount && typeof fareMyr === 'number') {
        setAmount(fareMyr.toFixed(2));
      }
    };

    const confirm = () => {
      if (!category || description.trim().length === 0) return;
      const parsed = Number.parseFloat(amount.replace(',', '.'));
      const amountMyr =
        showAmount && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
      onConfirm({ category, amountMyr, description: description.trim() });
    };

    return (
      <BottomSheet ref={sheetRef} snapPoints={['90%']}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="gap-3 pb-4">
            <Text weight="bold" className="text-xl">
              {t('dispute.title')}
            </Text>
            <Text tone="secondary" className="text-sm">
              {t('dispute.subtitle')}
            </Text>

            <View className="mt-1 gap-2">
              {CATEGORY_KEYS.map((c) => {
                const active = c === category;
                return (
                  <Pressable
                    key={c}
                    onPress={() => pickCategory(c)}
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
                      {t(CATEGORY_I18N_KEY[c])}
                    </Text>
                    {active ? <Icon name="check" size={18} color="#E11D2E" /> : null}
                  </Pressable>
                );
              })}
            </View>

            {showAmount ? (
              <Input
                className="mt-1"
                label={t('dispute.amountLabel')}
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                placeholder={amountPlaceholder}
                leadingAdornment={
                  <Text weight="medium" tone="secondary" className="text-base">
                    RM
                  </Text>
                }
              />
            ) : null}

            {/* Multiline description — the Input primitive is single-line
                (fixed h-14), so use a dedicated text area with the same tokens. */}
            <View className="mt-1">
              <Text weight="medium" tone="secondary" className="mb-2 text-sm">
                {t('dispute.descriptionLabel')}
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('dispute.descriptionPlaceholder')}
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
                className="rounded-lg border border-border bg-muted px-4 py-3 text-base font-body text-ink-primary"
                style={{ minHeight: 112 }}
              />
            </View>

            <View className="mt-3 gap-2">
              <Button
                label={t('dispute.submit')}
                onPress={confirm}
                disabled={!canSubmit}
                loading={submitting}
              />
              <Button
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => sheetRef.current?.dismiss()}
              />
            </View>
          </View>
        </ScrollView>
      </BottomSheet>
    );
  },
);
