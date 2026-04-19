import { forwardRef } from 'react';
import { View } from 'react-native';

import type { Locale } from '@teeko/shared';
import { BottomSheet, type BottomSheetHandle, Icon, Pressable, Text } from '@teeko/ui';

const LANGUAGES: { code: Locale; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ms', label: 'Bahasa Melayu', native: 'Bahasa Melayu' },
  { code: 'zh', label: 'Chinese', native: '中文' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

export interface LanguageSheetProps {
  selected: Locale;
  onSelect: (locale: Locale) => void;
}

export const LanguageSheet = forwardRef<BottomSheetHandle, LanguageSheetProps>(
  function LanguageSheet({ selected, onSelect }, ref) {
    return (
      <BottomSheet ref={ref} snapPoints={['50%']}>
        <View className="pb-4">
          <Text weight="bold" className="mb-4 text-xl">
            Language
          </Text>
          {LANGUAGES.map((l) => {
            const active = l.code === selected;
            return (
              <Pressable
                key={l.code}
                onPress={() => onSelect(l.code)}
                haptic="selection"
                className="flex-row items-center border-b border-border py-4 active:opacity-90"
              >
                <View className="flex-1">
                  <Text weight="medium" className="text-sm">
                    {l.native}
                  </Text>
                  {l.native !== l.label ? (
                    <Text tone="secondary" className="text-xs">
                      {l.label}
                    </Text>
                  ) : null}
                </View>
                {active ? <Icon name="check" size={22} color="#E11D2E" /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    );
  },
);
