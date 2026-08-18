import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { useT } from '@teeko/i18n';
import type { SupportCategory } from '@teeko/shared';
import { BottomSheet, type BottomSheetHandle, Button, Icon, Input, Pressable, Text } from '@teeko/ui';

const CATEGORY_KEYS: SupportCategory[] = [
  'technical',
  'complaint',
  'payment',
  'billing',
  'account',
  'documents',
  'safety',
  'other',
];

export interface SupportSubmitInput {
  category: SupportCategory;
  subject: string;
  description: string;
}

export interface SupportSheetProps {
  submitting?: boolean;
  onConfirm: (input: SupportSubmitInput) => void;
}

export const SupportSheet = forwardRef<BottomSheetHandle, SupportSheetProps>(
  function SupportSheet({ submitting, onConfirm }, ref) {
    const t = useT();
    const sheetRef = useRef<BottomSheetHandle>(null);
    const [category, setCategory] = useState<SupportCategory | null>(null);
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');

    useImperativeHandle(ref, () => ({
      present: () => {
        setCategory(null);
        setSubject('');
        setDescription('');
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const canSubmit =
      category != null &&
      subject.trim().length > 0 &&
      description.trim().length > 0 &&
      !submitting;

    const confirm = () => {
      if (!category || subject.trim().length === 0 || description.trim().length === 0) return;
      onConfirm({ category, subject: subject.trim(), description: description.trim() });
    };

    return (
      <BottomSheet ref={sheetRef} snapPoints={['90%']}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="gap-3 pb-4">
            <Text weight="bold" className="text-xl">
              {t('support.title')}
            </Text>
            <Text tone="secondary" className="text-sm">
              {t('support.subtitle')}
            </Text>

            <View className="mt-1 gap-2">
              {CATEGORY_KEYS.map((c) => {
                const active = c === category;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
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
                      {t(`support.categoryLabel.${c}`)}
                    </Text>
                    {active ? <Icon name="check" size={18} color="#E11D2E" /> : null}
                  </Pressable>
                );
              })}
            </View>

            <Input
              className="mt-1"
              label={t('support.subjectLabel')}
              value={subject}
              onChangeText={setSubject}
              placeholder={t('support.subjectPlaceholder')}
              maxLength={200}
            />

            {/* Multiline description — the Input primitive is single-line, so use
                a dedicated text area with the same tokens (matches DisputeSheet). */}
            <View className="mt-1">
              <Text weight="medium" tone="secondary" className="mb-2 text-sm">
                {t('support.descriptionLabel')}
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('support.descriptionPlaceholder')}
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
                maxLength={2000}
                className="rounded-lg border border-border bg-muted px-4 py-3 text-base font-body text-ink-primary"
                style={{ minHeight: 112 }}
              />
            </View>

            <View className="mt-3 gap-2">
              <Button
                label={t('support.submit')}
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
