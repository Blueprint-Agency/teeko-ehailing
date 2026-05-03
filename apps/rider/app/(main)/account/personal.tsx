import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useUser } from '@clerk/clerk-expo';
import { useAuthStore, useUIStore } from '@teeko/api';
import { Button, Icon, Input, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

export default function PersonalInfoScreen() {
  const router = useRouter();
  const rider = useAuthStore((s) => s.rider);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const pushToast = useUIStore((s) => s.pushToast);
  const { user, isLoaded } = useUser();

  const initialPhone =
    user?.primaryPhoneNumber?.phoneNumber ??
    (typeof user?.unsafeMetadata?.phone === 'string' ? (user.unsafeMetadata.phone as string) : '') ??
    rider?.phone ??
    '';

  const [name, setName] = useState(rider?.name ?? '');
  const [phone, setPhone] = useState(initialPhone);
  const email = rider?.email ?? '';
  const [saving, setSaving] = useState(false);

  const dirtyName = name.trim() !== (rider?.name ?? '');
  const dirtyPhone = phone.trim() !== initialPhone;
  const canSave = (dirtyName || dirtyPhone) && !!name.trim();

  const onSave = async () => {
    setSaving(true);
    try {
      if (dirtyName) {
        await updateProfile({ fullName: name.trim() });
      }
      if (dirtyPhone && isLoaded && user) {
        const cleaned = phone.trim();
        await user.update({
          unsafeMetadata: { ...(user.unsafeMetadata ?? {}), phone: cleaned },
        });
      }
      router.back();
    } catch (err) {
      const message = (err as { errors?: Array<{ message?: string }> })
        .errors?.[0]?.message;
      pushToast({
        kind: 'error',
        message: message ? `Save failed: ${message}` : 'Could not save changes.',
      });
    } finally {
      setSaving(false);
    }
  };

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
          <View>
            <Text tone="secondary" className="mb-1 text-xs">
              Email
            </Text>
            <View className="rounded-lg border border-border bg-muted px-4 py-3">
              <Text>{email || '—'}</Text>
            </View>
            <Text tone="faint" className="mt-1 text-xs">
              Email is managed by your sign-in account.
            </Text>
          </View>
          <Input
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="+60 12 345 6789"
          />
        </View>
      </ScrollView>

      <View className="pb-safe pt-2">
        <Button
          label="Save changes"
          onPress={onSave}
          loading={saving}
          disabled={!canSave}
        />
      </View>
    </ScreenContainer>
  );
}
