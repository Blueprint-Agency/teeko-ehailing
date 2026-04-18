import { forwardRef } from 'react';
import { View } from 'react-native';

import type { Driver } from '@teeko/shared';
import { BottomSheet, type BottomSheetHandle, Input, Text } from '@teeko/ui';

export interface MockChatSheetProps {
  driver: Driver | null;
}

type Message = { id: string; from: 'driver' | 'you'; text: string };

const CANNED: Message[] = [
  { id: 'm1', from: 'driver', text: "I'm on my way, should be there soon." },
  { id: 'm2', from: 'you', text: 'Thanks, I\'m outside.' },
];

export const MockChatSheet = forwardRef<BottomSheetHandle, MockChatSheetProps>(function MockChatSheet(
  { driver },
  ref,
) {
  return (
    <BottomSheet ref={ref}>
      <View className="gap-3 pb-2">
        <Text weight="bold" className="text-lg">
          Chat with {driver?.name ?? 'driver'}
        </Text>
        <View className="gap-2">
          {CANNED.map((m) => (
            <View
              key={m.id}
              className={
                m.from === 'you'
                  ? 'self-end max-w-[80%] rounded-2xl bg-primary px-4 py-2'
                  : 'self-start max-w-[80%] rounded-2xl bg-muted px-4 py-2'
              }
            >
              <Text className={m.from === 'you' ? 'text-white' : 'text-ink-primary'}>{m.text}</Text>
            </View>
          ))}
        </View>
        <View pointerEvents="none" className="mt-2 opacity-60">
          <Input label="Chat coming soon" value="" onChangeText={() => {}} placeholder="Message driver (disabled in v0.1)" />
        </View>
      </View>
    </BottomSheet>
  );
});
