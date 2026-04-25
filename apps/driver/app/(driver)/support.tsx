import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  StatusBar, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import ScreenHeader from '../../components/driver/ScreenHeader';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { useRouter } from 'expo-router';

const MOCK_CHAT = [
  { id: 1, from: 'agent', text: 'Hi Ahmad! How can we help you today?', time: '10:32 AM' },
  { id: 2, from: 'driver', text: 'My earnings from last Tuesday haven\'t been transferred yet.', time: '10:33 AM' },
  { id: 3, from: 'agent', text: 'I can see your account. The transfer was delayed due to a bank processing issue. It should arrive within 24 hours. Sorry for the inconvenience!', time: '10:34 AM' },
  { id: 4, from: 'driver', text: 'Okay, thank you.', time: '10:35 AM' },
  { id: 5, from: 'agent', text: 'Is there anything else I can help you with?', time: '10:35 AM' },
];

const QUICK_TOPIC_KEYS = [
  'topicFareDispute', 'topicDocUpload', 'topicSuspension', 'topicPayment', 'topicOther',
] as const;

export default function SupportScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'form'>('chat');

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.supportTitle')} onBack={() => router.back()} />

      {/* Tab toggle */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>{t('driver.liveChat')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'form' && styles.tabActive]}
          onPress={() => setActiveTab('form')}
        >
          <Text style={[styles.tabText, activeTab === 'form' && styles.tabTextActive]}>{t('driver.reportIssue')}</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'chat' ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.chatScroll}>
            <View style={styles.agentStatus}>
              <View style={styles.agentDot} />
              <Text style={styles.agentStatusText}>{t('driver.agentOnline')}</Text>
            </View>

            {MOCK_CHAT.map((msg) => (
              <View
                key={msg.id}
                style={[styles.bubble, msg.from === 'driver' ? styles.bubbleDriver : styles.bubbleAgent]}
              >
                <Text style={[styles.bubbleText, msg.from === 'driver' && styles.bubbleTextDriver]}>
                  {msg.text}
                </Text>
                <Text style={[styles.bubbleTime, msg.from === 'driver' && styles.bubbleTimeDriver]}>
                  {msg.time}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('driver.typeMessage')}
              placeholderTextColor={colors.textMut}
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn}>
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView contentContainerStyle={styles.formScroll}>
          <Text style={styles.formLabel}>{t('driver.formTopic')}</Text>
          <View style={styles.topicGrid}>
            {QUICK_TOPIC_KEYS.map((key) => (
              <TouchableOpacity key={key} style={styles.topicChip}>
                <Text style={styles.topicChipText}>{t(`driver.${key}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.formLabel}>{t('driver.formTripId')}</Text>
          <TextInput
            style={styles.formInput}
            placeholder={t('driver.formTripIdPlaceholder')}
            placeholderTextColor={colors.textMut}
          />

          <Text style={styles.formLabel}>{t('driver.formDescription')}</Text>
          <TextInput
            style={[styles.formInput, styles.formTextarea]}
            placeholder={t('driver.formDescPlaceholder')}
            placeholderTextColor={colors.textMut}
            multiline
            numberOfLines={5}
          />

          <TouchableOpacity style={styles.submitBtn}>
            <Text style={styles.submitText}>{t('driver.submitReport')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.accent },
  tabText: { color: colors.textSec, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: colors.accent },

  chatScroll: { padding: 16, paddingBottom: 20 },
  agentStatus: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10, padding: 10, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  agentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.online, marginRight: 8 },
  agentStatusText: { color: colors.textSec, fontSize: 12 },

  bubble: {
    maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 10,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  bubbleDriver: {
    alignSelf: 'flex-end',
    backgroundColor: colors.accent + '1A',
    borderColor: colors.accent + '33',
  },
  bubbleAgent: {},
  bubbleText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  bubbleTextDriver: { color: colors.text },
  bubbleTime: { color: colors.textMut, fontSize: 10, marginTop: 4 },
  bubbleTimeDriver: { textAlign: 'right' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 12, borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface, gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
    color: colors.text, fontSize: 14, maxHeight: 80,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendIcon: { color: '#000', fontSize: 18, fontWeight: '700' },

  formScroll: { padding: 16, paddingBottom: 40 },
  formLabel: { color: colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  topicChipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  formInput: {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 14,
  },
  formTextarea: { height: 100, textAlignVertical: 'top' },
  submitBtn: {
    marginTop: 20, height: 54, borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  submitText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
