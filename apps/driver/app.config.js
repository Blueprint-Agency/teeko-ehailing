const { withAndroidManifest } = require('@expo/config-plugins');

/** @type {import('expo/config').ExpoConfig} */
const config = require('./app.json').expo;

module.exports = {
  expo: {
    ...config,
    android: {
      ...config.android,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
  },
};
