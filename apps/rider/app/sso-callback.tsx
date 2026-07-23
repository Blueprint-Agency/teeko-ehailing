import { Redirect } from 'expo-router';

import { useT } from '@teeko/i18n';

import { LoadingScreen } from '../components/LoadingScreen';

// Landing route for the Google OAuth deep link (`teeko://sso-callback`).
// Clerk's startSSOFlow has already completed the session by the time the app
// re-opens on this URL; we just bounce to the index gate, which redirects to
// onboarding / verify-email / tabs based on auth + profile state.
export default function SsoCallback() {
  const t = useT();
  return (
    <>
      <LoadingScreen message={t('auth.signingIn')} />
      <Redirect href="/" />
    </>
  );
}
