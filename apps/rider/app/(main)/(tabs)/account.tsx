import { useEffect, useRef } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { useClerk } from '@clerk/clerk-expo';
import { useAuthStore, usePlacesStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import type { Locale } from '@teeko/shared';
import { type BottomSheetHandle, Icon, ListRow, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import { LanguageSheet } from '../../../components/LanguageSheet';

const LANGUAGE_LABEL: Record<Locale, string> = {
  en: 'English',
  ms: 'Bahasa Melayu',
  zh: '中文',
  ta: 'தமிழ்',
};

export default function AccountTab() {
  const router = useRouter();
  const t = useT();
  const rider = useAuthStore((s) => s.rider);
  const languagePref = useAuthStore((s) => s.languagePref);
  const setLanguage = useAuthStore((s) => s.setLanguage);
  const clearProfile = useAuthStore((s) => s.clear);
  const { signOut } = useClerk();
  const saved = usePlacesStore((s) => s.saved);
  const loadSaved = usePlacesStore((s) => s.loadSaved);
  const languageSheetRef = useRef<BottomSheetHandle>(null);

  const onLogout = () => {
    Alert.alert(t('account.logoutConfirmTitle'), t('account.logoutConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.logout'),
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            // ignore — best-effort
          }
          clearProfile();
          router.replace('/(main)/(tabs)');
        },
      },
    ]);
  };

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
          <Pressable
            onLongPress={() => router.push('/(main)/account/demo' as never)}
            haptic="medium"
            accessibilityRole="button"
            accessibilityLabel="Profile avatar (long-press for demo controls)"
            className="h-20 w-20 items-center justify-center rounded-full bg-muted"
          >
            <Icon name="person" size={40} color="#4B5563" />
          </Pressable>
          <Text weight="bold" className="mt-3 text-2xl">
            {rider?.name ?? t('account.guest')}
          </Text>
          {typeof rider?.rating === 'number' ? (
            <View className="mt-1 flex-row items-center">
              <Icon name="star" size={16} color="#E11D2E" />
              <Text weight="medium" className="ml-1 text-sm">
                {`${rider.rating.toFixed(2)} ${t('account.rating')}`}
              </Text>
            </View>
          ) : null}
          {!rider ? (
            <>
              <Text tone="secondary" className="mt-2 px-gutter text-center text-sm">
                {t('account.guestCta')}
              </Text>
              <View className="mt-4 w-full flex-row gap-3 px-gutter">
                <Pressable
                  onPress={() => router.push('/(auth)/login')}
                  haptic="light"
                  accessibilityRole="button"
                  className="h-12 flex-1 items-center justify-center rounded-full bg-primary active:opacity-90"
                >
                  <Text weight="bold" className="text-base text-white">
                    {t('account.signIn')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(auth)/signup')}
                  haptic="light"
                  accessibilityRole="button"
                  className="h-12 flex-1 items-center justify-center rounded-full border border-border bg-surface active:opacity-90"
                >
                  <Text weight="bold" className="text-base text-ink-primary">
                    {t('account.signUp')}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>

        <Section title={t('account.title')}>
          <ListRow
            leadingIcon="person-outline"
            title={t('account.personalInfo')}
            onPress={() => router.push('/(main)/account/personal' as never)}
          />
          <ListRow
            leadingIcon="shield"
            title={t('account.loginSecurity')}
            onPress={() => router.push('/(main)/account/security' as never)}
          />
          <ListRow
            leadingIcon="credit-card"
            title={t('account.paymentMethods')}
            onPress={() => router.push('/(main)/account/payments' as never)}
            noDivider
          />
        </Section>

        <Section title={t('account.savedPlaces')}>
          <ListRow
            leadingIcon="home"
            title={home?.address ? t('account.home') : t('account.enterHome')}
            subtitle={home?.address}
            onPress={() =>
              router.push({ pathname: '/(main)/search', params: { intent: 'saveHome' } })
            }
          />
          <ListRow
            leadingIcon="work"
            title={work?.address ? t('account.work') : t('account.enterWork')}
            subtitle={work?.address}
            onPress={() =>
              router.push({ pathname: '/(main)/search', params: { intent: 'saveWork' } })
            }
            noDivider
          />
        </Section>

        <Section title={t('account.preferences')}>
          <ListRow
            leadingIcon="language"
            title={t('account.language')}
            subtitle={LANGUAGE_LABEL[languagePref]}
            onPress={() => languageSheetRef.current?.present()}
            noDivider
          />
        </Section>

        {rider ? (
          <View className="mt-8">
            <View className="border-y border-border bg-surface">
              <ListRow
                leadingIcon="logout"
                title={t('account.logout')}
                onPress={onLogout}
                noDivider
              />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <LanguageSheet
        ref={languageSheetRef}
        selected={languagePref}
        onSelect={(locale) => {
          setLanguage(locale);
          languageSheetRef.current?.dismiss();
        }}
      />
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
