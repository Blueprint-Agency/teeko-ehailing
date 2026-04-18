import { forwardRef, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';

import { BottomSheet, type BottomSheetHandle, Button, Text } from '@teeko/ui';

export interface CancelTripSheetProps {
  onConfirm: () => void;
}

export const CancelTripSheet = forwardRef<BottomSheetHandle, CancelTripSheetProps>(function CancelTripSheet(
  { onConfirm },
  ref,
) {
  const sheetRef = useRef<BottomSheetHandle>(null);

  useImperativeHandle(ref, () => ({
    present: () => sheetRef.current?.present(),
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  return (
    <BottomSheet ref={sheetRef}>
      <View className="gap-3 pb-2">
        <Text weight="bold" className="text-lg">
          Cancel this trip?
        </Text>
        <Text tone="secondary" className="text-sm">
          Cancellation fees may apply depending on trip status. (Fees are not charged in the v0.1 mockup.)
        </Text>
        <View className="mt-3 gap-2">
          <Button label="Yes, cancel trip" onPress={onConfirm} />
          <Button label="Keep trip" variant="ghost" onPress={() => sheetRef.current?.dismiss()} />
        </View>
      </View>
    </BottomSheet>
  );
});
