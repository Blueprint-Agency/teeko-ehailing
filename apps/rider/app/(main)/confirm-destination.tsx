import { useRouter } from 'expo-router';

import { NotImplementedScreen } from '../../components/NotImplementedScreen';
import { Button, ScreenContainer, Text } from '@teeko/ui';
import { View } from 'react-native';

export default function ConfirmDestinationScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View className="flex-1">
        <NotImplementedScreen domain="trips" />
      </View>
      <View className="px-gutter pb-4">
        <Button
          label="Continue"
          onPress={() => router.push('/(main)/not-implemented?domain=ride-selection')}
        />
      </View>
    </ScreenContainer>
  );
}
