import type { ExpoConfig } from 'expo/config';

const mapsKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

const config: ExpoConfig = {
  name: 'Teeko',
  slug: 'teeko-rider',
  version: '0.0.11',
  orientation: 'portrait',
  scheme: 'teeko',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  platforms: ['ios', 'android', 'web'],
  web: { bundler: 'metro', output: 'single' },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.teeko.rider',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Teeko uses your location to set your pickup point and show nearby drivers.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Teeko uses your location to show trip progress while riding.',
      ITSAppUsesNonExemptEncryption: false,
    },
    config: { googleMapsApiKey: mapsKey },
  },
  android: {
    package: 'com.teeko.rider',
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'POST_NOTIFICATIONS',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
    config: { googleMaps: { apiKey: mapsKey } },
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Teeko uses your location to set your pickup point and show nearby drivers.',
      },
    ],
    'expo-notifications',
    'expo-localization',
    'expo-font',
    [
      '@stripe/stripe-react-native',
      {
        // Apple Pay merchant id (used later; harmless placeholder for now).
        merchantIdentifier: 'merchant.com.teeko.rider',
        enableGooglePay: true,
      },
    ],
  ],
  updates: {
    url: 'https://u.expo.dev/64dad399-68e0-4def-9640-6c1c718e4416',
  },
  // Bare workflow (an ios/ project exists), so runtime-version policies like
  // { policy: 'appVersion' } aren't supported — it must be a literal string.
  // Pinned to the current appVersion to stay continuous with updates published
  // under the old policy. Bump this manually on native/runtime-breaking changes.
  runtimeVersion: '0.0.11',
  experiments: { typedRoutes: true },
  extra: {
    router: {},
    eas: { projectId: '64dad399-68e0-4def-9640-6c1c718e4416' },
  },
  owner: 'teeko-ai',
};

export default config;
