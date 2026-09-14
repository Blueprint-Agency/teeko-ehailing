import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { ApiError, authApi, useAuthStore, useUIStore } from '@teeko/api';
import type { PhoneChangeState } from '@teeko/api';
import { formatUnlockDate, parseE164, resolveRiderPhone } from '@teeko/shared';
import { useT } from '@teeko/i18n';
import {
  Button,
  Card,
  Icon,
  Input,
  OTPInput,
  PhoneInput,
  Pressable,
  ScreenContainer,
  Text,
} from '@teeko/ui';
import { useRouter } from 'expo-router';

// One screen, two outcomes, because to the rider it is one intention: "I want a
// different number." Whether that lands as an immediate write or as a request
// for an admin depends on the 30-day window, which the server owns — so the
// screen asks for the state rather than guessing from `phoneChangedAt`.
//
// Both paths need the same OTP, so the step machine is shared:
//   number → code → done.

type Step = 'number' | 'code';

const RESEND_SECONDS = 60;

export default function PhoneChangeScreen() {
  const router = useRouter();
  const t = useT();
  const rider = useAuthStore((s) => s.rider);
  const changePhone = useAuthStore((s) => s.changePhone);
  const requestEarly = useAuthStore((s) => s.requestEarlyPhoneChange);
  const recentCountries = useAuthStore((s) => s.recentCountries);
  const rememberCountry = useAuthStore((s) => s.rememberCountry);
  const pushToast = useUIStore((s) => s.pushToast);

  const [state, setState] = useState<PhoneChangeState | null>(null);
  const [step, setStep] = useState<Step>('number');

  // Seed the picker from the rider's current number so changing one digit does
  // not mean retyping the country.
  const current = parseE164(rider?.phone ?? '', rider?.phoneCountry);
  const [countryCode, setCountryCode] = useState(current.iso2 ?? 'MY');
  const [national, setNational] = useState('');
  const [reason, setReason] = useState('');
  const [code, setCode] = useState('');

  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // `canRequestEarly` is the server's word for "you are inside the window but
  // may still ask". It decides which of the two submits this screen performs.
  const early = state?.canRequestEarly ?? false;
  const locked = !!state?.nextAllowedAt;

  useEffect(() => {
    void (async () => {
      try {
        setState(await authApi.getPhoneChangeState());
      } catch {
        pushToast({ kind: 'error', message: 'Could not load your phone settings.' });
        router.back();
      }
    })();
  }, [pushToast, router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const sendCode = useCallback(async () => {
    setPhoneError(undefined);
    setReasonError(undefined);

    const resolved = resolveRiderPhone({ countryCode, nationalNumber: national });
    if (!resolved.ok) {
      setPhoneError(t(resolved.error === 'phone_required' ? 'phone.required' : 'phone.invalid'));
      return;
    }
    if (early && !reason.trim()) {
      setReasonError(t('phone.reasonRequired'));
      return;
    }

    setBusy(true);
    try {
      await authApi.sendOtp('phone_change');
      setStep('code');
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      const body = errorBody(err);
      if (body.error === 'rate_limited') {
        setResendIn(Number(body.retryInSeconds) || RESEND_SECONDS);
        setStep('code');
      } else {
        pushToast({ kind: 'error', message: 'Could not send the code. Try again.' });
      }
    } finally {
      setBusy(false);
    }
  }, [countryCode, national, early, reason, t, pushToast]);

  const submit = useCallback(async () => {
    setCodeError(undefined);
    if (code.length !== 6) {
      setCodeError(t('phone.otpInvalid'));
      return;
    }

    setBusy(true);
    try {
      if (early) {
        await requestEarly({
          countryCode,
          nationalNumber: national.trim(),
          otpCode: code,
          reason: reason.trim(),
        });
        pushToast({ kind: 'success', message: t('phone.submitted') });
      } else {
        const nextAllowedAt = await changePhone({
          countryCode,
          nationalNumber: national.trim(),
          otpCode: code,
        });
        pushToast({
          kind: 'success',
          message: `${t('phone.updated')} · ${t('phone.nextChange', {
            date: formatUnlockDate(nextAllowedAt),
          })}`,
        });
      }
      router.back();
    } catch (err) {
      const body = errorBody(err);
      switch (body.error) {
        case 'otp_invalid':
          // The code survives a wrong guess, so the rider retries without a
          // resend — except when they have burned their attempts.
          setCodeError(
            body.reason === 'expired'
              ? t('phone.otpExpired')
              : body.reason === 'too_many_attempts'
                ? t('phone.tooManyAttempts')
                : body.reason === 'no_active_code'
                  ? t('phone.otpNoCode')
                  : t('phone.otpInvalid'),
          );
          setCode('');
          break;
        case 'phone_cooldown':
          // Raced a change on another device: fall back to the request path.
          setState((s) =>
            s
              ? {
                  ...s,
                  nextAllowedAt: typeof body.nextAllowedAt === 'string' ? body.nextAllowedAt : null,
                  canRequestEarly: true,
                }
              : s,
          );
          setStep('number');
          pushToast({ kind: 'info', message: t('phone.requestEarlier') });
          break;
        case 'already_pending':
          pushToast({ kind: 'error', message: t('phone.alreadyPending') });
          router.back();
          break;
        case 'phone_invalid':
        case 'phone_country_not_allowed':
        case 'phone_required':
          setStep('number');
          setPhoneError(t('phone.invalid'));
          break;
        default:
          pushToast({ kind: 'error', message: 'Could not update your number.' });
      }
    } finally {
      setBusy(false);
    }
  }, [code, early, countryCode, national, reason, changePhone, requestEarly, pushToast, router, t]);

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-row items-center pb-3 pt-2">
        <Pressable
          onPress={() => (step === 'code' ? setStep('number') : router.back())}
          haptic="selection"
          className="-ml-2 p-2"
          accessibilityRole="button"
        >
          <Icon name={step === 'code' ? 'arrow-back' : 'close'} size={24} color="#111111" />
        </Pressable>
        <Text weight="bold" className="ml-2 text-lg">
          {t('phone.changeTitle')}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 'number' ? (
          <View className="mt-4 gap-4">
            {locked ? (
              <Card className="bg-muted p-3">
                <Text tone="secondary" className="text-sm">
                  {t('phone.lockedBody', {
                    changed: formatUnlockDate(rider?.phoneChangedAt ?? ''),
                    unlock: formatUnlockDate(state!.nextAllowedAt!),
                  })}
                </Text>
              </Card>
            ) : null}

            <PhoneInput
              country="picker"
              label={t('phone.newNumber')}
              countryCode={countryCode}
              onCountryCodeChange={setCountryCode}
              onCountryUsed={rememberCountry}
              recentCountries={recentCountries}
              value={national}
              onChangeText={(v) => {
                setNational(v);
                if (phoneError) setPhoneError(undefined);
              }}
              error={phoneError}
              autoFocus
              searchPlaceholder={t('phone.searchCountry')}
              recentLabel={t('phone.recent')}
              allCountriesLabel={t('phone.allCountries')}
              noResultsLabel={t('phone.noCountryResults')}
            />

            {early ? (
              <Input
                label={t('phone.reasonLabel')}
                placeholder={t('phone.reasonPlaceholder')}
                value={reason}
                onChangeText={(v) => {
                  setReason(v);
                  if (reasonError) setReasonError(undefined);
                }}
                error={reasonError}
                multiline
                maxLength={300}
              />
            ) : null}
          </View>
        ) : (
          <View className="mt-6 gap-4">
            <Text tone="secondary" className="text-sm">
              {t('phone.codeSentTo', { email: maskEmail(rider?.email) })}
            </Text>
            <OTPInput
              value={code}
              onChange={(v) => {
                setCode(v);
                if (codeError) setCodeError(undefined);
              }}
              error={!!codeError}
            />
            {codeError ? (
              <Text tone="danger" className="text-center text-xs">
                {codeError}
              </Text>
            ) : null}
            <Pressable
              onPress={resendIn > 0 ? undefined : sendCode}
              disabled={resendIn > 0}
              haptic="selection"
              accessibilityRole="button"
              className="self-center py-2"
            >
              <Text tone={resendIn > 0 ? 'faint' : 'brand'} weight="medium" className="text-sm">
                {resendIn > 0 ? t('phone.resendIn', { seconds: resendIn }) : t('phone.resend')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View className="pb-safe pt-2">
        <Button
          label={
            step === 'number'
              ? t('phone.sendCode')
              : early
                ? t('phone.submitForReview')
                : t('phone.confirm')
          }
          onPress={step === 'number' ? sendCode : submit}
          loading={busy}
          disabled={busy || (step === 'code' && code.length !== 6)}
        />
      </View>
    </ScreenContainer>
  );
}

/** 'alex@mail.com' → 'a***@mail.com'. Enough to recognise, not enough to leak. */
function maskEmail(email?: string): string {
  if (!email) return 'your email';
  const [local, domain] = email.split('@');
  if (!domain || !local) return email;
  return `${local[0]}***@${domain}`;
}

function errorBody(err: unknown): { error?: string; reason?: string; [k: string]: unknown } {
  if (!(err instanceof ApiError)) return {};
  try {
    return JSON.parse(err.body);
  } catch {
    return {};
  }
}
