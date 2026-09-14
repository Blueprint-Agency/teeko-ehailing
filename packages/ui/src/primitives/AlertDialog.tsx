import { Modal, Pressable as RNPressable, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';

export interface AlertDialogAction {
  label: string;
  /** `cancel` renders as a ghost button at the bottom; `destructive` and `default` render as primary. */
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
}

export interface AlertDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Empty/omitted → a single "OK" button. */
  actions?: AlertDialogAction[];
  /** Label for the implicit OK button when no actions are given. Default "OK". */
  okLabel?: string;
  /** Tap-outside / back-button dismiss. Default true. */
  dismissable?: boolean;
  onDismiss: () => void;
}

/**
 * In-app replacement for `Alert.alert`. Centered card on a dimmed backdrop,
 * primary/destructive actions stacked on top, cancel as a ghost button below —
 * the same layout as the rider's bottom sheets.
 */
export function AlertDialog({
  visible,
  title,
  message,
  actions,
  okLabel = 'OK',
  dismissable = true,
  onDismiss,
}: AlertDialogProps) {
  const list: AlertDialogAction[] =
    actions && actions.length > 0 ? actions : [{ label: okLabel, style: 'cancel' }];
  const primary = list.filter((a) => a.style !== 'cancel');
  const cancel = list.filter((a) => a.style === 'cancel');

  const run = (a: AlertDialogAction) => {
    onDismiss();
    // Let the modal start closing before any navigation the handler triggers.
    if (a.onPress) setTimeout(() => void a.onPress?.(), 0);
  };

  const requestClose = () => {
    if (!dismissable) return;
    const c = cancel[0];
    if (c) run(c);
    else onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-center bg-black/40 px-gutter">
        <RNPressable
          className="absolute inset-0"
          onPress={requestClose}
          accessibilityLabel="Dismiss"
        />
        <View
          className="w-full max-w-[360px] rounded-xl bg-surface px-5 pb-5 pt-6"
          accessibilityViewIsModal
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
          }}
        >
          <Text weight="bold" className="text-lg text-center">
            {title}
          </Text>
          {message ? (
            <Text tone="secondary" className="mt-2 text-center text-sm leading-5">
              {message}
            </Text>
          ) : null}

          <View className="mt-5 gap-2">
            {primary.map((a, i) => (
              <Button
                key={`p${i}`}
                label={a.label}
                size="md"
                variant="primary"
                onPress={() => run(a)}
              />
            ))}
            {cancel.map((a, i) => (
              <Button
                key={`c${i}`}
                label={a.label}
                size="md"
                variant={primary.length === 0 ? 'primary' : 'ghost'}
                onPress={() => run(a)}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
