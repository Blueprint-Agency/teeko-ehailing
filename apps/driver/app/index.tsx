import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { resolveRouteAfterAuth, type AuthRoute } from '../lib/routeAfterAuth';

/**
 * A Clerk session persists in SecureStore across app restarts, so on relaunch we
 * know *who* the driver is but not whether they may accept trips — that lives in
 * `driver_applications.state`. Redirecting a signed-in user straight to the tabs
 * would let a pending or rejected driver skip the review screen, so we resolve
 * the same route the login path uses before landing anywhere.
 */
export default function Root() {
  const { isLoaded, isSignedIn } = useAuth();
  const [route, setRoute] = useState<AuthRoute | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    resolveRouteAfterAuth().then((r) => {
      if (!cancelled) setRoute(r);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) return <Splash />;
  if (!isSignedIn) return <Redirect href="/(auth)/login" />;
  if (!route) return <Splash />;
  return <Redirect href={route} />;
}

function Splash() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
