import { forwardRef } from 'react';
import { View } from 'react-native';

import { BottomSheet, type BottomSheetHandle, Button, Text } from '@teeko/ui';

export interface CancelTripSheetProps {
  onConfirm: () => void;
  onDismiss?: () => void;
}

export const CancelTripSheet = forwardRef<BottomSheetHandle, CancelTripSheetProps>(function CancelTripSheet(
  { onConfirm, onDismiss },
  ref,
) {
  return (
    <BottomSheet ref={ref} onDismiss={onDismiss}>
      <View className="gap-3 pb-2">
        <Text weight="bold" className="text-lg">
          Cancel this trip?
        </Text>
        <Text tone="secondary" className="text-sm">
          Cancellation fees may apply depending on trip status. (Fees are not charged in the v0.1 mockup.)
        </Text>
        <View className="mt-3 gap-2">
          <Button label="Yes, cancel trip" onPress={onConfirm} />
          <Button label="Keep trip" variant="ghost" onPress={onDismiss} />
        </View>
      </View>
    </BottomSheet>
  );
});
