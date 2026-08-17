import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  StatusBar, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import ScreenHeader from '../../components/driver/ScreenHeader';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { useRouter } from 'expo-router';
import { ChevronDown, Check } from 'lucide-react-native';
import {
  api,
  type DriverDispute,
  type DriverDisputeCategory,
  type DriverDisputeStatus,
  type DriverFinishedTrip,
} from '../../lib/api';

// The five things a driver can report, in the order they're offered. Each maps
// to a backend dispute category — Report Issue files a real dispute that lands
// in the admin Disputes Queue alongside rider-raised ones.
const TOPICS: { category: DriverDisputeCategory; i18nKey: string }[] = [
  { category: 'overcharge', i18nKey: 'driver.topicFareDispute' },
  { category: 'document', i18nKey: 'driver.topicDocUpload' },
  { category: 'account', i18nKey: 'driver.topicSuspension' },
  { category: 'payment', i18nKey: 'driver.topicPayment' },
  { category: 'other', i18nKey: 'driver.topicOther' },
];

// Categories that carry a disputed amount; the backend ignores it on the rest.
const MONEY_CATEGORIES: DriverDisputeCategory[] = ['overcharge', 'payment'];

const STATUS_I18N: Record<DriverDisputeStatus, string> = {
  open: 'dispute.statusOpen',
  under_review: 'dispute.statusUnderReview',
  escalated: 'dispute.statusEscalated',
  resolved: 'dispute.statusResolved',
  rejected: 'dispute.statusRejected',
  refund_pending: 'dispute.statusRefundPending',
  refund_processing: 'dispute.statusRefundProcessing',
  refund_completed: 'dispute.statusRefundCompleted',
  refund_failed: 'dispute.statusRefundFailed',
};

const CATEGORY_I18N: Record<DriverDisputeCategory, string> = Object.fromEntries(
  TOPICS.map((t) => [t.category, t.i18nKey]),
) as Record<DriverDisputeCategory, string>;

/** "Kuala Lumpur Sentral → KLIA2" — the one-line label for a trip in the picker. */
function tripLabel(trip: DriverFinishedTrip): string {
  const from = trip.pickupAddress?.split(',')[0]?.trim();
  const to = trip.dropoffAddress?.split(',')[0]?.trim();
  if (from && to) return `${from} → ${to}`;
  return from || to || trip.id.slice(0, 8);
}

export default function SupportScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  const [activeTab, setActiveTab] = useState<'form' | 'reports'>('form');

  // ── Report Issue form ──
  const [category, setCategory] = useState<DriverDisputeCategory | null>(null);
  const [trip, setTrip] = useState<DriverFinishedTrip | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [trips, setTrips] = useState<DriverFinishedTrip[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // ── My reports ──
  const [reports, setReports] = useState<DriverDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setReports(await api.disputes.list());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
    // The picker only offers finished trips, so a failed load just leaves it
    // empty — the report can still be filed without a trip.
    api.driver
      .tripHistory()
      .then((res) => setTrips(res.data ?? []))
      .catch(() => setTrips([]));
  }, [loadReports]);

  const showAmount = category != null && MONEY_CATEGORIES.includes(category);
  const canSubmit = category != null && description.trim().length > 0 && !submitting;

  async function submit() {
    if (!canSubmit || category == null) return;
    const parsedAmount = showAmount ? Number(amount.replace(',', '.')) : NaN;

    setSubmitting(true);
    setFormError(null);
    try {
      const dispute = await api.disputes.create({
        tripId: trip?.id ?? null,
        category,
        ...(Number.isFinite(parsedAmount) && parsedAmount > 0 ? { amountMyr: parsedAmount } : {}),
        description: description.trim(),
      });
      // Prepend so the new report is visible the moment the driver switches
      // tabs, without waiting on a round-trip.
      setReports((prev) => [dispute, ...prev]);
      setSubmitted(true);
      setCategory(null);
      setTrip(null);
      setPickerOpen(false);
      setAmount('');
      setDescription('');
    } catch (err) {
      setFormError((err as Error)?.message || t('dispute.submitError'));
    } finally {
      setSubmitting(false);
    }
  }

  // Status pill colour, grouped by outcome (mirrors the rider app).
  function statusTone(status: DriverDisputeStatus): string {
    switch (status) {
      case 'resolved':
      case 'refund_completed':
        return colors.success;
      case 'refund_pending':
      case 'refund_processing':
        return colors.warning;
      case 'rejected':
      case 'refund_failed':
        return colors.textMut;
      default:
        return colors.info;
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.supportTitle')} onBack={() => router.back()} />

      {/* Tab toggle */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'form' && styles.tabActive]}
          onPress={() => setActiveTab('form')}
        >
          <Text style={[styles.tabText, activeTab === 'form' && styles.tabTextActive]}>{t('driver.reportIssue')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.tabActive]}
          onPress={() => setActiveTab('reports')}
        >
          <Text style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
            {t('dispute.myReportsTitle')}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'form' ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.intro}>{t('dispute.subtitle')}</Text>

            <Text style={styles.formLabel}>{t('driver.formTopic')}</Text>
            <View style={styles.topicGrid}>
              {TOPICS.map((topic) => {
                const selected = category === topic.category;
                return (
                  <TouchableOpacity
                    key={topic.category}
                    style={[styles.topicChip, selected && styles.topicChipActive]}
                    onPress={() => {
                      setCategory(topic.category);
                      setSubmitted(false);
                    }}
                  >
                    <Text style={[styles.topicChipText, selected && styles.topicChipTextActive]}>
                      {t(topic.i18nKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.formLabel}>{t('driver.formTrip')}</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setPickerOpen((open) => !open)}
              disabled={trips.length === 0}
            >
              <View style={styles.pickerLabel}>
                <Text style={styles.pickerText} numberOfLines={1}>
                  {trip ? tripLabel(trip) : t('driver.tripPickerNone')}
                </Text>
                {trip && (
                  <Text style={styles.pickerSub}>
                    {new Date(trip.finishedAt).toLocaleDateString()} · RM{trip.fareMyr.toFixed(2)}
                  </Text>
                )}
                {!trip && trips.length === 0 && (
                  <Text style={styles.pickerSub}>{t('driver.tripPickerEmpty')}</Text>
                )}
              </View>
              {trips.length > 0 && <ChevronDown size={18} color={colors.textMut} strokeWidth={2} />}
            </TouchableOpacity>

            {pickerOpen && (
              <View style={styles.pickerList}>
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    setTrip(null);
                    setPickerOpen(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>{t('driver.tripPickerNone')}</Text>
                  {trip === null && <Check size={16} color={colors.accent} strokeWidth={2.5} />}
                </TouchableOpacity>

                {trips.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.pickerRow}
                    onPress={() => {
                      setTrip(item);
                      setPickerOpen(false);
                    }}
                  >
                    <View style={styles.pickerRowLabel}>
                      <Text style={styles.pickerRowText} numberOfLines={1}>{tripLabel(item)}</Text>
                      <Text style={styles.pickerSub}>
                        {new Date(item.finishedAt).toLocaleDateString()} · RM{item.fareMyr.toFixed(2)}
                        {item.status === 'completed' ? '' : ` · ${t('rides.cancelled')}`}
                      </Text>
                    </View>
                    {trip?.id === item.id && <Check size={16} color={colors.accent} strokeWidth={2.5} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {showAmount && (
              <>
                <Text style={styles.formLabel}>{t('dispute.amountLabel')}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMut}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
              </>
            )}

            <Text style={styles.formLabel}>{t('driver.formDescription')}</Text>
            <TextInput
              style={[styles.formInput, styles.formTextarea]}
              placeholder={t('driver.formDescPlaceholder')}
              placeholderTextColor={colors.textMut}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              maxLength={2000}
            />

            {formError && <Text style={styles.errorText}>{formError}</Text>}
            {submitted && <Text style={styles.successText}>{t('dispute.submitSuccess')}</Text>}

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={submit}
              disabled={!canSubmit}
            >
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitText}>{t('driver.submitReport')}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView contentContainerStyle={styles.reportsScroll}>
          {loading ? (
            <ActivityIndicator style={styles.loader} color={colors.accent} />
          ) : loadError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('dispute.submitError')}</Text>
              <TouchableOpacity onPress={loadReports}>
                <Text style={styles.retry}>{t('common.tryAgain')}</Text>
              </TouchableOpacity>
            </View>
          ) : reports.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('dispute.myReportsEmptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('dispute.myReportsEmptyBody')}</Text>
            </View>
          ) : (
            reports.map((d) => {
              const tone = statusTone(d.status);
              return (
                <View key={d.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardCategory}>{t(CATEGORY_I18N[d.category])}</Text>
                    <View style={[styles.pill, { backgroundColor: tone + '1A', borderColor: tone + '40' }]}>
                      <Text style={[styles.pillText, { color: tone }]}>{t(STATUS_I18N[d.status])}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardMeta}>
                    {new Date(d.createdAt).toLocaleDateString()}
                    {d.tripId ? ` · ${t('dispute.tripRef')} ${d.tripId.slice(0, 8)}` : ''}
                    {typeof d.amountMyr === 'number' ? ` · RM${d.amountMyr.toFixed(2)}` : ''}
                  </Text>

                  <Text style={styles.cardBody}>{d.description}</Text>

                  {d.resolution ? (
                    <View style={styles.resolution}>
                      <Text style={styles.resolutionLabel}>{t('dispute.resolutionLabel')}</Text>
                      <Text style={styles.cardBody}>{d.resolution}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
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

  formScroll: { padding: 16, paddingBottom: 40 },
  intro: { color: colors.textSec, fontSize: 13, lineHeight: 19 },
  formLabel: { color: colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  topicChipActive: { backgroundColor: colors.accent + '1A', borderColor: colors.accent },
  topicChipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  topicChipTextActive: { color: colors.accent },
  formInput: {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 14,
  },
  formTextarea: { height: 100, textAlignVertical: 'top' },

  picker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerLabel: { flex: 1 },
  pickerText: { color: colors.text, fontSize: 14 },
  pickerSub: { color: colors.textMut, fontSize: 12, marginTop: 2 },
  pickerList: {
    marginTop: 8,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerRowLabel: { flex: 1 },
  pickerRowText: { color: colors.text, fontSize: 14, flex: 1 },

  errorText: { color: colors.danger, fontSize: 13, marginTop: 14 },
  successText: { color: colors.success, fontSize: 13, marginTop: 14 },
  submitBtn: {
    marginTop: 20, height: 54, borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#000', fontSize: 16, fontWeight: '800' },

  reportsScroll: { padding: 16, paddingBottom: 40 },
  loader: { marginTop: 40 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyBody: { color: colors.textSec, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  retry: { color: colors.accent, fontSize: 14, fontWeight: '700', marginTop: 12 },

  card: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 12,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardCategory: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 11, fontWeight: '700' },
  cardMeta: { color: colors.textMut, fontSize: 12, marginTop: 6 },
  cardBody: { color: colors.textSec, fontSize: 13, lineHeight: 19, marginTop: 8 },
  resolution: {
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  resolutionLabel: { color: colors.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
});
