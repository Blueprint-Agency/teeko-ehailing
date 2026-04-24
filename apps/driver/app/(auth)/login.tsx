import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '../../constants/colors';
import { useTheme } from '../../components/ThemeProvider';

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { activeTheme } = useTheme();
  const [phone, setPhone] = useState('');

  const styles = createStyles(colors);

  const handleContinue = () => {
    router.replace('/(driver)/home');
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle={activeTheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          {/* Logo */}
          <View style={styles.logoBlock}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>T</Text>
            </View>
            <Text style={styles.brand}>teeko</Text>
            <Text style={styles.tagline}>Drive. Earn. Thrive.</Text>
          </View>

          {/* Phone input */}
          <View style={styles.inputBlock}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <View style={styles.inputRow}>
              <View style={styles.prefix}>
                <Text style={styles.prefixText}>🇲🇾 +60</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="12-345 6789"
                placeholderTextColor={colors.textMut}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.continueBtn}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.push('/(auth)/register-choice')}
          >
            <Text style={styles.registerLinkText}>
              New to Teeko? <Text style={styles.registerLinkAccent}>Register here</Text>
            </Text>
          </TouchableOpacity>

          <Text style={styles.devNote}>[Mockup] Driver Portal Access</Text>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center' },

  logoBlock: { alignItems: 'center', marginBottom: 48 },
  logo: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: { color: '#000', fontSize: 40, fontWeight: '900' },
  brand: { color: colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: colors.textSec, fontSize: 14, marginTop: 4 },

  inputBlock: { marginBottom: 16 },
  inputLabel: { color: colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  prefix: {
    paddingHorizontal: 16, paddingVertical: 16,
    borderRightWidth: 1, borderRightColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
  },
  prefixText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  phoneInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 16,
    color: colors.text, fontSize: 17,
  },

  continueBtn: {
    height: 58, borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  continueBtnText: { color: '#000', fontSize: 18, fontWeight: '800' },

  registerLink: { alignItems: 'center', marginBottom: 24 },
  registerLinkText: { color: colors.textSec, fontSize: 14 },
  registerLinkAccent: { color: colors.accent, fontWeight: '700' },

  devNote: { color: colors.textMut, fontSize: 11, textAlign: 'center' },
});
