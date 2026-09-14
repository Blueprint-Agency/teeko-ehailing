import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable as RNPressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '../utils/cn';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
}

export interface ToastHostProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  /** Auto-dismiss delay in ms. Default 3200. */
  duration?: number;
}

const kindIcon: Record<ToastKind, IconName> = {
  info: 'info',
  success: 'check-circle',
  error: 'error-outline',
};

const kindAccent: Record<ToastKind, string> = {
  info: '#4B5563',
  success: '#10B981',
  error: '#EF4444',
};

function ToastRow({
  toast,
  duration,
  onDismiss,
}: {
  toast: ToastItem;
  duration: number;
  onDismiss: (id: string) => void;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const dismissedRef = useRef(false);

  const hide = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => onDismiss(toast.id));
  };

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const id = setTimeout(hide, duration);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
        ],
      }}
    >
      <RNPressable
        onPress={hide}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className={cn(
          'flex-row items-center gap-3 rounded-lg bg-ink-primary px-4 py-3',
        )}
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <Icon name={kindIcon[toast.kind]} size={20} color={kindAccent[toast.kind]} />
        <Text weight="medium" className="flex-1 text-sm text-white" numberOfLines={3}>
          {toast.message}
        </Text>
      </RNPressable>
    </Animated.View>
  );
}

/**
 * Renders a stack of transient toasts under the status bar. Mount once at the
 * app root, outside any navigator, and feed it from a store.
 */
export function ToastHost({ toasts, onDismiss, duration = 3200 }: ToastHostProps) {
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 z-50 gap-2 px-gutter"
      style={{ top: insets.top + 8 }}
    >
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} duration={duration} onDismiss={onDismiss} />
      ))}
    </View>
  );
}
