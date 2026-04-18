import { Linking, View } from 'react-native';

import { Icon, Pressable } from '@teeko/ui';

export interface CallChatButtonsProps {
  phone: string;
  onChat: () => void;
}

export function CallChatButtons({ phone, onChat }: CallChatButtonsProps) {
  const call = () => {
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  return (
    <View className="flex-row gap-3">
      <Pressable
        onPress={call}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel="Call driver"
        className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface"
      >
        <Icon name="phone" size={20} color="#111111" />
      </Pressable>
      <Pressable
        onPress={onChat}
        haptic="light"
        accessibilityRole="button"
        accessibilityLabel="Message driver"
        className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface"
      >
        <Icon name="chat-bubble-outline" size={20} color="#111111" />
      </Pressable>
    </View>
  );
}
