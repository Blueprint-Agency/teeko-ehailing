import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../components/driver/ScreenHeader';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import notifs from '../../data/mock-notifications-driver.json';

const TYPE_ICON: Record<string, string> = {
  approval: '✅',
  doc_expiry: '⚠️',
  incentive: '🎯',
  payment: '💰',
  suspension: '🚫',
};

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const styles = createStyles(colors);
  const [read, setRead] = useState<string[]>(notifs.filter((n) => n.read).map((n) => n.id));

  const TYPE_COLOR: Record<string, string> = {
    approval: colors.success,
    doc_expiry: colors.warning,
    incentive: colors.accent,
    payment: colors.info,
    suspension: colors.danger,
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title="Notifications" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {notifs.map((n) => {
          const isRead = read.includes(n.id);
          const typeColor = TYPE_COLOR[n.type];
          return (
            <TouchableOpacity
              key={n.id}
              style={[styles.card, !isRead && styles.cardUnread]}
              onPress={() => setRead((prev) => [...prev, n.id])}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBox, { backgroundColor: typeColor + '18' }]}>
                <Text style={styles.iconText}>{TYPE_ICON[n.type]}</Text>
              </View>
              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={styles.time}>{timeAgo(n.timestamp)}</Text>
                </View>
                <Text style={styles.body}>{n.body}</Text>
              </View>
              {!isRead && <View style={[styles.unreadDot, { backgroundColor: typeColor }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 16, paddingBottom: 40 },

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
  iconText: { fontSize: 20 },
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
