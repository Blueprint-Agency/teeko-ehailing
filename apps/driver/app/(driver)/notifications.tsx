import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AlertTriangle, Ban, Bell, Car, CheckCircle, Gift, Megaphone, Wallet } from 'lucide-react-native';
import ScreenHeader from '../../components/driver/ScreenHeader';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { useNotificationStore } from '../../store/useNotificationStore';

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

// Keyed by the server's notification_category enum. `system` is the fallback
// for a category added server-side before this map catches up.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  evp: CheckCircle,
  doc_expiry: AlertTriangle,
  payout: Wallet,
  suspension: Ban,
  incentive: Gift,
  trip: Car,
  broadcast: Megaphone,
  system: Bell,
};

function useTimeAgo() {
  const t = useT();
  return (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return t('driver.justNow');
    if (h < 24) return t('driver.hoursAgo', { h });
    return t('driver.daysAgo', { d: Math.floor(h / 24) });
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const timeAgo = useTimeAgo();
  const styles = createStyles(colors);

  const items = useNotificationStore((s) => s.items);
  const loading = useNotificationStore((s) => s.loading);
  const error = useNotificationStore((s) => s.error);
  const localRead = useNotificationStore((s) => s.localRead);
  const load = useNotificationStore((s) => s.load);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  const [refreshing, setRefreshing] = useState(false);

  // Reload on focus — an EVP or payout notice can land while the driver is on
  // another screen, and there is no push channel yet to tell us.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load().finally(() => setRefreshing(false));
  }, [load]);

  const isRead = (id: string, readAt: string | null) => !!readAt || localRead.includes(id);
  const hasUnread = items.some((n) => !isRead(n.id, n.readAt));

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.notificationsTitle')} onBack={() => router.back()} />

      {hasUnread ? (
        <View style={styles.actionBar}>
          <TouchableOpacity onPress={markAllRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.actionText}>{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.center}>
          <AlertTriangle size={40} color={colors.textMut} strokeWidth={1.5} />
          <Text style={styles.emptyBody}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, styles.centerContent]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          <Bell size={40} color={colors.textMut} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>{t('notifications.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('notifications.emptyBody')}</Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {items.map((n) => {
            const read = isRead(n.id, n.readAt);
            const typeColor = CATEGORY_COLOR(colors)[n.category] ?? colors.textMut;
            const IconComponent = CATEGORY_ICON[n.category] ?? CATEGORY_ICON.system;
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.card, !read && styles.cardUnread]}
                onPress={() => { if (!read) markRead(n.id); }}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBox, { backgroundColor: typeColor + '18' }]}>
                  <IconComponent size={20} color={typeColor} strokeWidth={1.75} />
                </View>
                <View style={styles.content}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title}>{n.title}</Text>
                    <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
                  </View>
                  <Text style={styles.body}>{n.body}</Text>
                </View>
                {!read && <View style={[styles.unreadDot, { backgroundColor: typeColor }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const CATEGORY_COLOR = (colors: any): Record<string, string> => ({
  evp: colors.success,
  doc_expiry: colors.warning,
  payout: colors.info,
  suspension: colors.danger,
  incentive: colors.success,
  trip: colors.info,
  broadcast: colors.accent,
  system: colors.textMut,
});

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },

  actionBar: { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 12 },
  actionText: { color: colors.accent, fontSize: 13, fontWeight: '600' },

  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 14 },
  emptyBody: { color: colors.textSec, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  retry: {
    marginTop: 16, paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  retryText: { color: colors.accent, fontSize: 13, fontWeight: '600' },

  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    position: 'relative',
  },
  cardUnread: { borderColor: colors.borderHigh, backgroundColor: colors.surfaceHigh },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, flexShrink: 0,
  },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  time: { color: colors.textMut, fontSize: 11 },
  body: { color: colors.textSec, fontSize: 13, lineHeight: 18 },
  unreadDot: {
    position: 'absolute', top: 14, right: 14,
    width: 8, height: 8, borderRadius: 4,
  },
});
