import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTripStore } from '@teeko/api';
import { Button, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { SearchingIndicator } from '../../components/SearchingIndicator';

export default function FindingDriverScreen() {
  const router = useRouter();
  const status = useTripStore((s) => s.status);
  const cancel = useTripStore((s) => s.cancel);
  const destination = useTripStore((s) => s.destination);

  useEffect(() => {
    if (status === 'matched') {
      router.replace('/(main)/driver-matched');
    } else if (status === 'cancelled' || status === 'idle') {
      router.replace('/(main)/(tabs)');
    }
  }, [status]);

  const handleCancel = async () => {
    await cancel('changedPlans');
    router.replace('/(main)/(tabs)');
  };

  if (status === 'no_drivers') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface px-8 gap-4">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Text className="text-4xl">😔</Text>
        </View>
        <Text weight="bold" className="text-center text-xl">
          No drivers nearby
        </Text>
        <Text tone="secondary" className="text-center text-sm">
          There are no available drivers for{' '}
          {destination?.name ?? 'your destination'} right now. Try again in a few minutes.
        </Text>
        <View className="mt-2 w-full gap-2">
          <Button label="Try again" onPress={() => router.back()} />
          <Button
            label="Go back home"
            variant="ghost"
            onPress={() => router.replace('/(main)/(tabs)')}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-surface gap-6">
      <SearchingIndicator />
      <View className="items-center gap-1">
        <Text weight="bold" className="text-xl">
          Finding your driver
        </Text>
        <Text tone="secondary" className="text-sm">
          Looking for a driver near you…
        </Text>
      </View>
      <Button label="Cancel" variant="ghost" onPress={handleCancel} />
    </SafeAreaView>
  );
}
