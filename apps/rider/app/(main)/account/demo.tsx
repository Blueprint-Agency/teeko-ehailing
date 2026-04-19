import { ScrollView, Switch, View } from 'react-native';

import { useTripStore, useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { Button, Icon, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

export default function DemoControlsScreen() {
  const router = useRouter();
  const t = useT();
  const forceNoDrivers = useUIStore((s) => s.forceNoDrivers);
  const setForceNoDrivers = useUIStore((s) => s.setForceNoDrivers);
  const resetDemo = useUIStore((s) => s.resetDemo);
  const pushToast = useUIStore((s) => s.pushToast);
  const resetTrip = useTripStore((s) => s.reset);
  const loadHistory = useTripStore((s) => s.loadHistory);

  const onResetAll = () => {
    resetDemo();
    resetTrip();
    loadHistory();
    pushToast({ kind: 'info', message: t('demo.resetToast') });
    router.back();
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center pb-3 pt-2">
        <Pressable
          onPress={() => router.back()}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          className="-ml-2 p-2"
        >
          <Icon name="close" size={24} color="#111111" />
        </Pressable>
        <Text weight="bold" className="ml-2 text-lg">
          {t('demo.title')}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text tone="secondary" className="mt-2 text-sm">
          {t('demo.subtitle')}
        </Text>

        <View className="mt-6 rounded-xl border border-border bg-surface px-4 py-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text weight="medium" className="text-sm">
                {t('demo.forceNoDrivers')}
              </Text>
              <Text tone="secondary" className="text-xs">
                {t('demo.forceNoDriversBody')}
              </Text>
            </View>
            <Switch
              value={forceNoDrivers}
              onValueChange={setForceNoDrivers}
              trackColor={{ true: '#E11D2E', false: '#E5E7EB' }}
              thumbColor="#FAFAFA"
              accessibilityLabel={t('demo.forceNoDrivers')}
            />
          </View>
        </View>

        <View className="mt-6">
          <Button label={t('demo.resetState')} variant="ghost" onPress={onResetAll} />
          <Text tone="faint" className="mt-2 text-center text-xs">
            {t('demo.resetBody')}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
