import { View } from 'react-native';
import { Image } from 'expo-image';
import { Spinner, Text } from '@teeko/ui';

const TEEKO_ICON = require('../assets/teeko-icon.png');

export type LoadingScreenProps = {
  /** Optional caption shown under the spinner (e.g. "Signing you in…"). */
  message?: string;
};

// Branded full-screen placeholder shown while auth/profile state resolves —
// replaces the blank `bg-surface` splash on the index gate and SSO callback.
export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <View className="flex-1 items-center justify-center gap-6 bg-surface">
      <Image
        source={TEEKO_ICON}
        style={{ width: 96, height: 96 }}
        contentFit="contain"
        accessibilityLabel="Teeko"
      />
      <Spinner size="large" />
      {message ? (
        <Text tone="secondary" className="text-sm">
          {message}
        </Text>
      ) : null}
    </View>
  );
}
