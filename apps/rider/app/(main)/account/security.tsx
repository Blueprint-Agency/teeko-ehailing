import { ScrollView, View } from 'react-native';

import { Icon, ListRow, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

export default function SecurityScreen() {
  const router = useRouter();

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center pb-3 pt-2">
        <Pressable onPress={() => router.back()} haptic="selection" className="-ml-2 p-2">
          <Icon name="close" size={24} color="#111111" />
        </Pressable>
        <Text weight="bold" className="ml-2 text-lg">
          Login & security
        </Text>
      </View>

      <ScrollView
        className="-mx-gutter"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="mt-4 border-y border-border bg-surface">
          <ListRow
            leadingIcon="lock"
            title="Password"
            subtitle="Not set"
            trailing={
              <Text tone="secondary" className="text-sm">
                —
              </Text>
            }
            noChevron
          />
          <ListRow
            leadingIcon="login"
            title="Google"
            subtitle="Not connected"
            trailing={
              <Text tone="secondary" className="text-sm">
                —
              </Text>
            }
            noDivider
            noChevron
          />
        </View>

        <Text tone="faint" className="mt-4 px-gutter text-xs">
          Security features are placeholders in v0.1 — phone-number OTP is the only
          sign-in method.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}
