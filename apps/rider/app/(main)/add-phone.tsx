import { useState } from 'react';
import { View } from 'react-native';

import { useAuthStore, useUIStore } from '@teeko/api';
import { resolveRiderPhone } from '@teeko/shared';
import { useT } from '@teeko/i18n';
import { Button, PhoneInput, ScreenContainer, Text } from '@teeko/ui';

// The R6 gate: an account that predates required-phone-at-registration, or one
// whose sign-up was interrupted between the Clerk step and the number write.
//
// Deliberately blocking — no back button, no skip, not dismissible. A NULL phone
// silently degrades a ride (the driver's `tel:` deep link has nothing to dial),
// so it has to be fixed before the rider can reach the tabs.
//
// No OTP: there is no existing number to protect. The server refuses to
// overwrite an existing number through this endpoint, so it cannot be used to
// bypass the OTP on a real change.

export default function AddPhoneScreen() {
  const t = useT();
  const setInitialPhone = useAuthStore((s) => s.setInitialPhone);
  const recentCountries = useAuthStore((s) => s.recentCountries);
  const rememberCountry = useAuthStore((s) => s.rememberCountry);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const pushToast = useUIStore((s) => s.pushToast);

  const [countryCode, setCountryCode] = useState('MY');
  const [national, setNational] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(undefined);
    const resolved = resolveRiderPhone({ countryCode, nationalNumber: national });
    if (!resolved.ok) {
      setError(t(resolved.error === 'phone_required' ? 'phone.required' : 'phone.invalid'));
      return;
    }

    setBusy(true);
    try {
      await setInitialPhone({ countryCode, nationalNumber: national.trim() });
      // The gate lives in the layout and keys off `rider.phone`, so refreshing
      // the profile is what dismisses this screen — there is nothing to navigate.
      await fetchProfile();
    } catch {
      pushToast({ kind: 'error', message: 'Could not save your number. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-1 justify-center">
        <Text weight="bold" className="text-3xl leading-tight">
          {t('phone.addTitle')}
        </Text>
        <Text tone="secondary" className="mt-2 text-base">
          {t('phone.addBodyRider')}
        </Text>

        <View className="mt-8">
          <PhoneInput
            country="picker"
            label={t('phone.label')}
            countryCode={countryCode}
            onCountryCodeChange={setCountryCode}
            onCountryUsed={rememberCountry}
            recentCountries={recentCountries}
            value={national}
            onChangeText={(v) => {
              setNational(v);
              if (error) setError(undefined);
            }}
            error={error}
            autoFocus
            searchPlaceholder={t('phone.searchCountry')}
            recentLabel={t('phone.recent')}
            allCountriesLabel={t('phone.allCountries')}
            noResultsLabel={t('phone.noCountryResults')}
          />
        </View>
      </View>

      <View className="pb-safe pt-2">
        <Button label={t('phone.addCta')} onPress={submit} loading={busy} disabled={busy} />
      </View>
    </ScreenContainer>
  );
}
