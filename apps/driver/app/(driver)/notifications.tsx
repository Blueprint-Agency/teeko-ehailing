import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenHeader from '../../components/driver/ScreenHeader';
import { Colors } from '../../constants/colors';
import notifs from '../../data/mock-notifications-driver.json';

const TYPE_ICON: Record<string, string> = {
  approval: '✅',
  doc_expiry: '⚠️',
  incentive: '🎯',
  payment: '💰',
  suspension: '🚫',
};

const TYPE_COLOR: Record<string, string> = {
  approval: Colors.success,
  doc_expiry: Colors.warning,
  incentive: Colors.accent,
  payment: Colors.info,
  suspension: Colors.danger,
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
  const [read, setRead] = useState<string[]>(notifs.filter((n) => n.read).map((n) => n.id));

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
      <ScreenHeader title="Notifications" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {notifs.map((n) => {
          const isRead = read.includes(n.id);
          return (
            <TouchableOpacity
              key={n.id}
              style={[styles.card, !isRead && styles.cardUnread]}
              onPress={() => setRead((prev) => [...prev, n.id])}
              activeOpacity={0.8}
            >
              <View style={[styles.iconBox, { backgroundColor: TYPE_COLOR[n.type] + '18' }]}>
                <Text style={styles.iconText}>{TYPE_ICON[n.type]}</Text>
              </View>
              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={styles.time}>{timeAgo(n.timestamp)}</Text>
                </View>
                <Text style={styles.body}>{n.body}</Text>
              </View>
              {!isRead && <View style={[styles.unreadDot, { backgroundColor: TYPE_COLOR[n.type] }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 16, paddingBottom: 40 },

  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    position: 'relative',
  },
  cardUnread: { borderColor: Colors.borderHigh, backgroundColor: Colors.surfaceHigh },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, flexShrink: 0,
  },
  iconText: { fontSize: 20 },
  content: { flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  title: { color: Colors.text, fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  time: { color: Colors.textMut, fontSize: 11 },
  body: { color: Colors.textSec, fontSize: 13, lineHeight: 18 },
  unreadDot: {
    position: 'absolute', top: 14, right: 14,
    width: 8, height: 8, borderRadius: 4,
  },
});
