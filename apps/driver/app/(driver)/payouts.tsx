import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, FlatList,
  StatusBar, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Landmark, CheckCircle2, ChevronDown, Check } from 'lucide-react-native';
import ScreenHeader from '../../components/driver/ScreenHeader';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';
import { useT } from '@teeko/i18n';
import { api, type BankAccount } from '../../lib/api';

// Teeko settles driver earnings by bank transfer from the admin payout sheet,
// so the driver supplies their bank details here. The server only ever hands
// back a masked number, which is why a change means re-entering it in full.
export default function PayoutsScreen() {
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [banks, setBanks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);

  const [bankName, setBankName] = useState('');
  const [holder, setHolder] = useState('');
  const [number, setNumber] = useState('');
  const [confirmNumber, setConfirmNumber] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const colors = useColors();
  const { activeTheme } = useTheme();
  const t = useT();
  const styles = createStyles(colors);

  const load = useCallback(async () => {
    try {
      const { account: saved, banks: list } = await api.bankAccount.get();
      setAccount(saved);
      setBanks(list);
      // Nothing on file yet — drop straight into the form rather than showing
      // an empty summary the driver has to tap past.
      setEditing(!saved);
      if (saved) {
        setBankName(saved.bankName);
        setHolder(saved.accountHolderName);
      }
    } catch {
      Alert.alert('Error', 'Could not load your bank details. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = () => {
    // The stored number never comes back to the app, so an update is always a
    // fresh entry of both fields.
    setNumber('');
    setConfirmNumber('');
    setErrors({});
    setEditing(true);
  };

  const cancelEdit = () => {
    setBankName(account?.bankName ?? '');
    setHolder(account?.accountHolderName ?? '');
    setNumber('');
    setConfirmNumber('');
    setErrors({});
    setEditing(false);
  };

  const onSave = async () => {
    const next: Record<string, string | undefined> = {};
    if (!bankName) next.bankName = 'Choose your bank.';
    if (holder.trim().length < 2) next.holder = 'Enter the name exactly as it appears on the account.';
    if (!/^\d{8,20}$/.test(number.trim())) next.number = 'Enter your account number (8–20 digits).';
    else if (confirmNumber.trim() !== number.trim()) next.confirmNumber = 'Account numbers do not match.';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSaving(true);
    try {
      const { account: saved } = await api.bankAccount.save({
        bankName,
        accountHolderName: holder.trim(),
        accountNumber: number.trim(),
      });
      setAccount(saved);
      setNumber('');
      setConfirmNumber('');
      setEditing(false);
      Alert.alert('Bank account saved', 'Your trip earnings will be transferred to this account.');
    } catch (err) {
      Alert.alert('Could not save', err instanceof Error ? err.message : 'Please try again later.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
        <ScreenHeader title={t('driver.bankAccount')} />
        <View style={styles.centre}><ActivityIndicator color={colors.accent} /></View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScreenHeader title={t('driver.bankAccount')} />

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!editing && account ? (
            <>
              <View style={styles.card}>
                <View style={[styles.iconWrap, { backgroundColor: colors.success + '20', borderColor: colors.success }]}>
                  <CheckCircle2 size={28} color={colors.success} strokeWidth={1.75} />
                </View>
                <Text style={styles.title}>Bank account added</Text>
                <Text style={styles.body}>
                  Your trip earnings are transferred to this account on the payout cycle.
                </Text>

                <View style={styles.summary}>
                  {[
                    ['Bank', account.bankName],
                    ['Account holder', account.accountHolderName],
                    ['Account number', account.accountNumberMasked],
                  ].map(([label, value]) => (
                    <View key={label} style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>{label}</Text>
                      <Text style={styles.summaryValue}>{value}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity style={styles.cta} onPress={startEdit} activeOpacity={0.85}>
                  <Text style={styles.ctaText}>Update bank details</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.footnote}>
                Make sure the account holder name matches your Teeko account. Transfers to a
                mismatched name are rejected by the bank and delay your payout.
              </Text>
            </>
          ) : (
            <>
              <View style={styles.introRow}>
                <View style={[styles.iconWrap, { backgroundColor: colors.accent + '20', borderColor: colors.accent }]}>
                  <Landmark size={28} color={colors.accent} strokeWidth={1.75} />
                </View>
                <Text style={styles.title}>Set up your bank account</Text>
                <Text style={styles.body}>
                  Add the account Teeko should transfer your trip earnings to. It must be a
                  Malaysian bank account in your own name.
                </Text>
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>BANK</Text>
                <TouchableOpacity
                  style={[styles.textInput, styles.selectField, errors.bankName && styles.inputError]}
                  onPress={() => setBankPickerOpen(true)}
                  activeOpacity={0.7}
                >
                  <Text style={bankName ? styles.selectValue : styles.selectPlaceholder}>
                    {bankName || 'Choose your bank'}
                  </Text>
                  <ChevronDown size={18} color={colors.textMut} />
                </TouchableOpacity>
                {errors.bankName && <Text style={styles.errorText}>{errors.bankName}</Text>}
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>ACCOUNT HOLDER NAME</Text>
                <TextInput
                  style={[styles.textInput, errors.holder && styles.inputError]}
                  placeholder="As printed on your bank account"
                  placeholderTextColor={colors.textMut}
                  autoCapitalize="characters"
                  value={holder}
                  onChangeText={(v) => { setHolder(v); setErrors((e) => ({ ...e, holder: undefined })); }}
                />
                {errors.holder && <Text style={styles.errorText}>{errors.holder}</Text>}
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>ACCOUNT NUMBER</Text>
                <TextInput
                  style={[styles.textInput, errors.number && styles.inputError]}
                  placeholder="e.g. 1234 5678 9012"
                  placeholderTextColor={colors.textMut}
                  keyboardType="number-pad"
                  value={number}
                  onChangeText={(v) => { setNumber(v.replace(/\D/g, '')); setErrors((e) => ({ ...e, number: undefined })); }}
                />
                {errors.number && <Text style={styles.errorText}>{errors.number}</Text>}
              </View>

              <View style={styles.inputBlock}>
                <Text style={styles.inputLabel}>CONFIRM ACCOUNT NUMBER</Text>
                <TextInput
                  style={[styles.textInput, errors.confirmNumber && styles.inputError]}
                  placeholder="Re-enter your account number"
                  placeholderTextColor={colors.textMut}
                  keyboardType="number-pad"
                  value={confirmNumber}
                  onChangeText={(v) => { setConfirmNumber(v.replace(/\D/g, '')); setErrors((e) => ({ ...e, confirmNumber: undefined })); }}
                />
                {errors.confirmNumber && <Text style={styles.errorText}>{errors.confirmNumber}</Text>}
              </View>

              <TouchableOpacity
                style={[styles.cta, saving && { opacity: 0.6 }]}
                onPress={onSave}
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>Save bank account</Text>}
              </TouchableOpacity>

              {account && (
                <TouchableOpacity onPress={cancelEdit} hitSlop={8} style={styles.cancel}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.footnote}>
                Teeko uses these details only to pay out your trip earnings. Payouts to an account
                that is not in your own name cannot be processed.
              </Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={bankPickerOpen} animationType="slide" transparent onRequestClose={() => setBankPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Choose your bank</Text>
            <FlatList
              data={banks}
              keyExtractor={(b) => b}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.bankRow}
                  onPress={() => {
                    setBankName(item);
                    setErrors((e) => ({ ...e, bankName: undefined }));
                    setBankPickerOpen(false);
                  }}
                >
                  <Text style={styles.bankRowText}>{item}</Text>
                  {bankName === item && <Check size={18} color={colors.accent} />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setBankPickerOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  introRow: { alignItems: 'center', marginBottom: 20 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  body: { color: colors.textSec, fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 16 },

  summary: { alignSelf: 'stretch', marginBottom: 20 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  summaryLabel: { color: colors.textSec, fontSize: 13 },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },

  inputBlock: { marginBottom: 16 },
  inputLabel: { color: colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  textInput: {
    paddingHorizontal: 16, paddingVertical: 16,
    color: colors.text, fontSize: 17,
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
  },
  selectField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { color: colors.text, fontSize: 17 },
  selectPlaceholder: { color: colors.textMut, fontSize: 17 },
  inputError: { borderColor: '#ef4444' },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4 },

  cta: {
    backgroundColor: colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  ctaText: { color: '#000', fontWeight: '800', fontSize: 16 },
  cancel: { alignSelf: 'center', paddingVertical: 14 },
  cancelText: { color: colors.textSec, fontSize: 14, fontWeight: '700' },
  footnote: { color: colors.textMut, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 16 },

  modalBackdrop: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: '75%',
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '800', paddingHorizontal: 20, marginBottom: 8 },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bankRowText: { color: colors.text, fontSize: 16 },
  modalClose: { paddingVertical: 18, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  modalCloseText: { color: colors.accent, fontSize: 15, fontWeight: '800' },
});
