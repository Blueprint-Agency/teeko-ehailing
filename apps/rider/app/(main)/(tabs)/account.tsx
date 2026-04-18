import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';

import { useAuthStore, usePlacesStore } from '@teeko/api';
import { Icon, ListRow, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

export default function AccountTab() {
  const router = useRouter();
  const rider = useAuthStore((s) => s.rider);
  const saved = usePlacesStore((s) => s.saved);
  const loadSaved = usePlacesStore((s) => s.loadSaved);

  useEffect(() => {
    if (saved.length === 0) loadSaved();
  }, [saved.length, loadSaved]);

  const home = saved.find((p) => p.category === 'home');
  const work = saved.find((p) => p.category === 'work');

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <ScrollView
        className="-mx-gutter"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center px-gutter pb-6 pt-6">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Icon name="person" size={40} color="#4B5563" />
          </View>
          <Text weight="bold" className="mt-3 text-2xl">
            {rider?.name ?? 'Guest'}
          </Text>
          {typeof rider?.rating === 'number' ? (
            <View className="mt-1 flex-row items-center">
              <Icon name="star" size={16} color="#E11D2E" />
              <Text weight="medium" className="ml-1 text-sm">
                {rider.rating.toFixed(2)} Rating
              </Text>
            </View>
          ) : null}
        </View>

        <Section title="Account">
          <ListRow
            leadingIcon="person-outline"
            title="Personal info"
            onPress={() => router.push('/(main)/account/personal' as never)}
          />
          <ListRow
            leadingIcon="shield"
            title="Login & security"
            onPress={() => router.push('/(main)/account/security' as never)}
            noDivider
          />
        </Section>

        <Section title="Saved places">
          <ListRow
            leadingIcon="home"
            title={home?.address ? 'Home' : 'Enter home location'}
            subtitle={home?.address}
            onPress={() =>
              router.push({ pathname: '/(main)/search', params: { intent: 'saveHome' } })
            }
          />
          <ListRow
            leadingIcon="work"
            title={work?.address ? 'Work' : 'Enter work location'}
            subtitle={work?.address}
            onPress={() =>
              router.push({ pathname: '/(main)/search', params: { intent: 'saveWork' } })
            }
            noDivider
          />
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-6">
      <Text
        weight="bold"
        className="px-gutter pb-2 text-xs uppercase tracking-wide text-ink-secondary"
      >
        {title}
      </Text>
      <View className="border-y border-border bg-surface">{children}</View>
    </View>
  );
}
