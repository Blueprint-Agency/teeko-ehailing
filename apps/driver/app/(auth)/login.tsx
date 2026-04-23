import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  SafeAreaView, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'driver' | 'rider'>('driver');

  const handleContinue = () => {
    if (role === 'driver') {
      router.replace('/(driver)/home');
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
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

          {/* Role toggle */}
          <View style={styles.roleToggle}>
            <TouchableOpacity
              style={[styles.roleBtn, role === 'driver' && styles.roleBtnActive]}
              onPress={() => setRole('driver')}
            >
              <Text style={[styles.roleBtnText, role === 'driver' && styles.roleBtnTextActive]}>
                🚗 Driver
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, role === 'rider' && styles.roleBtnActive]}
              onPress={() => setRole('rider')}
            >
              <Text style={[styles.roleBtnText, role === 'rider' && styles.roleBtnTextActive]}>
                👤 Rider
              </Text>
            </TouchableOpacity>
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
                placeholderTextColor={Colors.textMut}
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

          <Text style={styles.devNote}>[Mockup] Tap Continue to enter the {role} app</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center' },

  logoBlock: { alignItems: 'center', marginBottom: 48 },
  logo: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: { color: '#000', fontSize: 40, fontWeight: '900' },
  brand: { color: Colors.text, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  tagline: { color: Colors.textSec, fontSize: 14, marginTop: 4 },

  roleToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 4,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  roleBtnActive: { backgroundColor: Colors.accent },
  roleBtnText: { color: Colors.textSec, fontSize: 14, fontWeight: '700' },
  roleBtnTextActive: { color: '#000' },

  inputBlock: { marginBottom: 16 },
  inputLabel: { color: Colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  prefix: {
    paddingHorizontal: 16, paddingVertical: 16,
    borderRightWidth: 1, borderRightColor: Colors.border,
    backgroundColor: Colors.surfaceHigh,
    justifyContent: 'center',
  },
  prefixText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  phoneInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 16,
    color: Colors.text, fontSize: 17,
  },

  continueBtn: {
    height: 58, borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  continueBtnText: { color: '#000', fontSize: 18, fontWeight: '800' },

  registerLink: { alignItems: 'center', marginBottom: 24 },
  registerLinkText: { color: Colors.textSec, fontSize: 14 },
  registerLinkAccent: { color: Colors.accent, fontWeight: '700' },

  devNote: { color: Colors.textMut, fontSize: 11, textAlign: 'center' },
});
