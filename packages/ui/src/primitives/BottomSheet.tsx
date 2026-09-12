import {
  forwardRef,
  useImperativeHandle,
  useState,
  type ReactNode,
} from 'react';
import { Modal, Pressable as RNPressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';

export interface BottomSheetHandle {
  present: () => void;
  dismiss: () => void;
}

export interface BottomSheetProps {
  children: ReactNode;
  /** Accepted for API parity with the gorhom-based variant; unused in this lightweight version. */
  snapPoints?: Array<string | number>;
  onDismiss?: () => void;
  /** Show a floating close (✕) button in the dimmed area above the sheet, top-left. */
  showCloseButton?: boolean;
}

// Simple Modal-backed sheet. Avoids @gorhom/bottom-sheet + reanimated/worklets so the app
// runs in Expo Go across SDK patch versions without worklets ABI mismatch.
export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(function BottomSheet(
  { children, onDismiss, showCloseButton },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

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
        <View
          className="rounded-t-2xl bg-surface px-gutter pb-8 pt-3"
          // Cap the sheet height so tall content stays below the status bar/notch.
          // When a floating close button is shown, reserve extra room above the sheet
          // so the button sits in clear whitespace instead of overlapping the corner.
          style={{ maxHeight: windowHeight - insets.top - (showCloseButton ? 56 : 12) }}
        >
          <View className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-border" />
          {children}
        </View>
        {/* Rendered last so it paints above the sheet if they ever overlap. */}
        {showCloseButton && (
          <RNPressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            className="absolute left-4 h-10 w-10 items-center justify-center rounded-full bg-white active:opacity-80"
            style={{
              top: insets.top + 8,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 3,
            }}
          >
            <Icon name="close" size={24} color="#111827" />
          </RNPressable>
        )}
      </View>
    </Modal>
  );
});
