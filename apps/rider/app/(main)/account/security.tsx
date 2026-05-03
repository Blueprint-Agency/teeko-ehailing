import { Alert, ScrollView, View } from 'react-native';

import { useUser } from '@clerk/clerk-expo';
import { useUIStore } from '@teeko/api';
import { Icon, ListRow, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

export default function SecurityScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const pushToast = useUIStore((s) => s.pushToast);

  const passwordEnabled = !!user?.passwordEnabled;
  const googleAccount = user?.externalAccounts?.find(
    (a) => a.provider === 'google' || (a.provider as string) === 'oauth_google',
  );
  const otherStrategyAvailable = passwordEnabled || (user?.externalAccounts?.length ?? 0) > 1;

  const onUnlinkGoogle = () => {
    if (!googleAccount) return;
    if (!otherStrategyAvailable) {
      Alert.alert(
        'Cannot unlink',
        'Set a password before unlinking Google — otherwise you would lose access to your account.',
      );
      return;
    }
    Alert.alert(
      'Unlink Google?',
      'You will need another way to sign in. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              await googleAccount.destroy();
              pushToast({ kind: 'info', message: 'Google account unlinked.' });
            } catch (err) {
              const message = (err as { errors?: Array<{ message?: string }> })
                .errors?.[0]?.message;
              pushToast({
                kind: 'error',
                message: message ?? 'Could not unlink Google account.',
              });
            }
          },
        },
      ],
    );
  };

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
        {!isLoaded ? null : (
          <View className="mt-4 border-y border-border bg-surface">
            {passwordEnabled ? (
              <ListRow
                leadingIcon="lock"
                title="Password"
                subtitle="Change your password"
                onPress={() => router.push('/(main)/account/change-password' as never)}
                noDivider={!googleAccount}
              />
            ) : null}

            {googleAccount ? (
              <ListRow
                leadingIcon="login"
                title="Google"
                subtitle={googleAccount.emailAddress ?? 'Connected'}
                trailing={
                  <Text weight="bold" tone="brand" className="text-sm">
                    Unlink
                  </Text>
                }
                onPress={onUnlinkGoogle}
                noChevron
                noDivider
              />
            ) : null}

            {!passwordEnabled && !googleAccount ? (
              <ListRow
                leadingIcon="info"
                title="No sign-in methods configured"
                subtitle="Sign out and sign in again to set one up."
                noChevron
                noDivider
              />
            ) : null}
          </View>
        )}

        {googleAccount && !otherStrategyAvailable ? (
          <Text tone="faint" className="mt-4 px-gutter text-xs">
            Add a password before unlinking Google so you don't lose access.
          </Text>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
