import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useAuthStore } from '@teeko/api';
import { Button, Icon, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

export default function PersonalInfoScreen() {
  const router = useRouter();
  const rider = useAuthStore((s) => s.rider);
  const updateRider = useAuthStore((s) => s.updateRider);

  const [name, setName] = useState(rider?.name ?? '');
  const [email, setEmail] = useState(rider?.email ?? '');

  const onSave = () => {
    updateRider({ name: name.trim(), email: email.trim() || undefined });
    router.back();
  };

  const dirty =
    name.trim() !== (rider?.name ?? '') || email.trim() !== (rider?.email ?? '');

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center pb-3 pt-2">
        <Pressable onPress={() => router.back()} haptic="selection" className="-ml-2 p-2">
          <Icon name="close" size={24} color="#111111" />
        </Pressable>
        <Text weight="bold" className="ml-2 text-lg">
          Personal info
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="mt-4 gap-4">
          <Input label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View>
            <Text tone="secondary" className="mb-1 text-xs">
              Phone
            </Text>
            <View className="rounded-lg border border-border bg-muted px-4 py-3">
              <Text>{rider?.phone ?? '—'}</Text>
            </View>
            <Text tone="faint" className="mt-1 text-xs">
              Phone number can't be changed.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View className="pb-safe pt-2">
        <Button label="Save changes" onPress={onSave} disabled={!dirty || !name.trim()} />
      </View>
    </ScreenContainer>
  );
}
