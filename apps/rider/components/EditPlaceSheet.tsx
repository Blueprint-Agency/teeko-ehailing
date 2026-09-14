import { forwardRef } from 'react';
import { View } from 'react-native';

import { useT } from '@teeko/i18n';
import type { Place } from '@teeko/shared';
import { BottomSheet, type BottomSheetHandle, Icon, Pressable, Text } from '@teeko/ui';

export interface EditPlaceSheetProps {
  /** The place being edited. Undefined before the first present() — the sheet
      renders its title without an address in that window. */
  place?: Place;
  onChangeAddress: () => void;
  onRemove: () => void;
  onCancel: () => void;
}

// Custom action sheet for the saved-places edit flow, replacing the OS Alert so
// the choices match the app's own surface/typography.
export const EditPlaceSheet = forwardRef<BottomSheetHandle, EditPlaceSheetProps>(
  function EditPlaceSheet({ place, onChangeAddress, onRemove, onCancel }, ref) {
    const t = useT();
    return (
      <BottomSheet ref={ref} snapPoints={['40%']}>
        <View className="pb-2">
          <Text weight="bold" className="text-xl">
            {t('account.editPlaceTitle')}
          </Text>
          {place ? (
            <Text tone="secondary" className="mt-1 text-sm" numberOfLines={2}>
              {place.address}
            </Text>
          ) : null}

          <View className="mt-5">
            <Pressable
              onPress={onChangeAddress}
              haptic="selection"
              accessibilityRole="button"
              className="flex-row items-center rounded-2xl bg-muted px-4 py-4 active:opacity-80"
            >
              <Icon name="edit-location" size={22} color="#111111" />
              <Text weight="medium" className="ml-3 text-base">
                {t('account.changeAddress')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onRemove}
              haptic="medium"
              accessibilityRole="button"
              className="mt-3 flex-row items-center rounded-2xl bg-muted px-4 py-4 active:opacity-80"
            >
              <Icon name="delete" size={22} color="#EF4444" />
              <Text weight="medium" className="ml-3 text-base text-danger">
                {t('account.removePlace')}
              </Text>
            </Pressable>

            <Pressable
              onPress={onCancel}
              haptic="light"
              accessibilityRole="button"
              className="mt-3 h-12 items-center justify-center rounded-2xl active:opacity-70"
            >
              <Text weight="bold" className="text-base text-ink-secondary">
                {t('common.cancel')}
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheet>
    );
  },
);
