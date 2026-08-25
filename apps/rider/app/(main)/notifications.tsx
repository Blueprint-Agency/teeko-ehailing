import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { useT } from '@teeko/i18n';
import { Icon, Pressable, ScreenContainer, Text } from '@teeko/ui';
import { useRouter } from 'expo-router';

import mockData from '../../data/mock-notifications-rider.json';

type Category = 'trip' | 'promo' | 'account' | 'payment' | 'system';

interface NotificationItem {
  id: string;
  category: Category;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

const CATEGORY_ICON: Record<Category, React.ComponentProps<typeof Icon>['name']> = {
  trip: 'directions-car',
  promo: 'local-offer',
  account: 'person',
  payment: 'credit-card',
  system: 'notifications',
};

const CATEGORY_COLOR: Record<Category, string> = {
  trip: '#2563EB',
  promo: '#D97706',
  account: '#059669',
  payment: '#7C3AED',
  system: '#6B7280',
};

function useTimeAgo() {
  const t = useT();
  return (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return t('driver.justNow');
    if (h < 24) return t('driver.hoursAgo', { h });
    return t('driver.daysAgo', { d: Math.floor(h / 24) });
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const t = useT();
  const timeAgo = useTimeAgo();

  const [items, setItems] = useState<NotificationItem[]>(mockData as NotificationItem[]);

  const hasUnread = items.some((n) => !n.readAt);

  const markRead = (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
  };

  const markAllRead = () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-gutter pb-2 pt-2">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            haptic="light"
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="mr-2 h-10 w-10 items-center justify-center rounded-full active:bg-muted"
          >
            <Icon name="arrow-back" size={24} color="#111827" />
          </Pressable>
          <Text weight="bold" className="text-xl">
            {t('driver.notificationsTitle')}
          </Text>
        </View>
        {hasUnread ? (
          <Pressable
            onPress={markAllRead}
            haptic="light"
            accessibilityRole="button"
            className="rounded-full px-3 py-1.5 active:bg-muted"
          >
            <Text weight="medium" className="text-sm text-primary">
              {t('notifications.markAllRead')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="notifications-none" size={48} color="#9CA3AF" />
          <Text weight="bold" className="mt-4 text-base">
            {t('notifications.emptyTitle')}
          </Text>
          <Text tone="secondary" className="mt-1 text-center text-sm">
            {t('notifications.emptyBody')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isRead = !!item.readAt;
            const color = CATEGORY_COLOR[item.category];
            const iconName = CATEGORY_ICON[item.category];
            return (
              <Pressable
                onPress={() => !isRead && markRead(item.id)}
                haptic="light"
                accessibilityRole="button"
                className={
                  'mb-3 flex-row rounded-2xl border p-3.5 ' +
                  (isRead ? 'border-border bg-surface' : 'border-border bg-muted')
                }
              >
                {/* Icon box */}
                <View
                  className="mr-3 h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: color + '1A' }}
                >
                  <Icon name={iconName} size={22} color={color} />
                </View>

                {/* Content */}
                <View className="flex-1">
                  <View className="mb-1 flex-row items-start justify-between">
                    <Text
                      weight={isRead ? 'medium' : 'bold'}
                      className="mr-2 flex-1 text-sm"
                    >
                      {item.title}
                    </Text>
                    <Text tone="secondary" className="text-xs">
                      {timeAgo(item.createdAt)}
                    </Text>
                  </View>
                  <Text tone="secondary" className="text-sm leading-5">
                    {item.body}
                  </Text>
                </View>

                {/* Unread dot */}
                {!isRead ? (
                  <View className="absolute right-3.5 top-3.5 h-2 w-2 rounded-full bg-primary" />
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}
