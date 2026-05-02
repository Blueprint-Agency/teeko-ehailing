import { View } from 'react-native';

import { useT } from '@teeko/i18n';
import { Icon, ScreenContainer, Text } from '@teeko/ui';

export type NotImplementedDomain = 'home' | 'rides' | 'trips' | 'payments' | 'search';

export function NotImplementedScreen({ domain }: { domain: NotImplementedDomain }) {
  const t = useT();
  return (
    <ScreenContainer>
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Icon name="build" size={36} color="#666" />
        </View>
        <Text weight="bold" className="text-center text-2xl">
          {t(`notImplemented.${domain}.title`)}
        </Text>
        <Text tone="secondary" className="mt-3 text-center text-base">
          {t(`notImplemented.${domain}.body`)}
        </Text>
      </View>
    </ScreenContainer>
  );
}
