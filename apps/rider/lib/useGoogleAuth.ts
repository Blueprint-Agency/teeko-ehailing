// Google sign-in via Clerk-brokered OAuth (SSO). Shared by the login and
// signup screens so the flow + error handling live in one place.
//
// Clerk brokers the Google client ID/secret and verifies tokens server-side,
// so there is no GOOGLE_CLIENT_ID in the app — enable the Google connection in
// the Clerk dashboard and allowlist the `teeko://sso-callback` redirect there.
import { useCallback, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useSSO } from '@clerk/clerk-expo';
import { useUIStore } from '@teeko/api';
import { useRouter } from 'expo-router';

// Dismisses the OAuth browser tab and returns control to the app on redirect.
// Safe to call at module scope; must run before the SSO flow starts.
WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const pushToast = useUIStore((s) => s.pushToast);
  const [loading, setLoading] = useState(false);

  const signInWithGoogle = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      // makeRedirectUri resolves to `teeko://sso-callback` in dev/standalone
      // builds and the Expo proxy URL under Expo Go — the value must be
      // allowlisted in Clerk's dashboard exactly as it resolves.
      const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'teeko', path: 'sso-callback' });
      // Copy this exact value into Clerk's allowed redirect URLs. Under Expo Go
      // it prints an `exp://…` proxy URL; in dev/standalone builds `teeko://sso-callback`.
      console.log('[google-auth] redirectUrl =', redirectUrl);

      const { createdSessionId, setActive, authSessionResult } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        // Navigate straight to the app, mirroring the email/password path
        // (login.tsx). Going through the '/' index gate here caused a flash of
        // the signup screen: on the freshly-mounted gate Clerk's reactive
        // `isSignedIn` hasn't propagated yet, so it briefly redirects to
        // /(auth)/signup before settling on the tabs. Google emails are
        // auto-verified server-side, so the verify-email gate isn't needed.
        router.replace('/(main)/(tabs)');
      } else if (authSessionResult?.type === 'success') {
        // Redirect completed but Clerk did not mint a session — the account
        // needs extra steps (e.g. MFA or missing required fields) that this
        // flow doesn't collect. Fall back to the email path.
        pushToast({ kind: 'error', message: 'Google sign-in needs more steps. Try email instead.' });
      }
      // authSessionResult.type of 'cancel' / 'dismiss' → user backed out; stay silent.
    } catch (err) {
      const code = (err as { errors?: Array<{ code?: string }> }).errors?.[0]?.code;
      if (code === 'oauth_access_denied') return; // user declined at Google — not an error
      pushToast({ kind: 'error', message: 'Google sign-in failed. Try again.' });
    } finally {
      setLoading(false);
    }
  }, [loading, router, startSSOFlow, pushToast]);

  return { signInWithGoogle, loading };
}
