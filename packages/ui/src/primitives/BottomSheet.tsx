import {
  forwardRef,
  useImperativeHandle,
  useState,
  type ReactNode,
} from 'react';
import { Modal, Pressable as RNPressable, View } from 'react-native';

export interface BottomSheetHandle {
  present: () => void;
  dismiss: () => void;
}

export interface BottomSheetProps {
  children: ReactNode;
  /** Accepted for API parity with the gorhom-based variant; unused in this lightweight version. */
  snapPoints?: Array<string | number>;
  onDismiss?: () => void;
}

// Simple Modal-backed sheet. Avoids @gorhom/bottom-sheet + reanimated/worklets so the app
// runs in Expo Go across SDK patch versions without worklets ABI mismatch.
export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(function BottomSheet(
  { children, onDismiss },
  ref,
) {
  const [visible, setVisible] = useState(false);

  const close = () => {
    setVisible(false);
    onDismiss?.();
  };

  useImperativeHandle(ref, () => ({
    present: () => setVisible(true),
    dismiss: close,
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end bg-black/40">
        <RNPressable className="flex-1" onPress={close} accessibilityLabel="Dismiss" />
        <View className="rounded-t-2xl bg-surface px-gutter pb-8 pt-3">
          <View className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-border" />
          {children}
        </View>
      </View>
    </Modal>
  );
});
