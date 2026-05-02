import { useState } from 'react';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useOAuth } from '@clerk/clerk-expo';
import { useUIStore } from '@teeko/api';
import { Pressable, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

WebBrowser.maybeCompleteAuthSession();

export type GoogleButtonProps = {
  label: string;
  disabled?: boolean;
};

// Inline Google "G" logomark — recognisable at a glance, kept simple (no SVG dep).
function GoogleMark() {
  return (
    <View className="h-5 w-5 items-center justify-center">
      <Text weight="bold" className="text-base leading-none" style={{ color: '#4285F4' }}>
        G
      </Text>
    </View>
  );
}

export function GoogleButton({ label, disabled }: GoogleButtonProps) {
  const router = useRouter();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const pushToast = useUIStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    setBusy(true);
    try {
      const { createdSessionId, setActive } = await startOAuthFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/(main)/(tabs)');
      }
    } catch {
      pushToast({ kind: 'error', message: 'Google sign-in failed. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const isDisabled = disabled || busy;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-14 w-full flex-row items-center justify-center gap-3 rounded-full border border-border bg-surface active:opacity-90"
      style={isDisabled ? { opacity: 0.5 } : undefined}
    >
      <GoogleMark />
      <Text weight="bold" className="text-base text-ink-primary">
        {label}
      </Text>
    </Pressable>
  );
}
