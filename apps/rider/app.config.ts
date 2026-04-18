import type { ExpoConfig } from 'expo/config';

const mapsKey = process.env.GOOGLE_MAPS_API_KEY ?? '';

const config: ExpoConfig = {
  name: 'Teeko',
  slug: 'teeko-rider',
  version: '0.0.1',
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
  ],
  updates: {
    url: 'https://u.expo.dev/64dad399-68e0-4def-9640-6c1c718e4416',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  experiments: { typedRoutes: true },
  extra: {
    router: {},
    eas: { projectId: '64dad399-68e0-4def-9640-6c1c718e4416' },
  },
  owner: 'chriskke',
};

export default config;
