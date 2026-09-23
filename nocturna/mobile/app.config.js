// Dynamic Expo config — replaces app.json so store builds can inject
// environment-specific values (API URL, EAS project id) at build time.
//
// Build-time env vars (set in eas.json profiles or your shell):
//   NOCTURNA_API_URL   — backend base URL baked into the app bundle.
//                        Production MUST be https:// (iOS ATS blocks http).
//   EAS_PROJECT_ID     — written by `eas init`; needed for EAS builds + push.
//   APP_VARIANT        — "development" | "preview" | "production" (default).
//                        Non-production variants get a suffixed bundle id so
//                        they can be installed alongside the store app.

const VARIANT = process.env.APP_VARIANT || 'production';

const BUNDLE_ID_BASE = 'app.nocturna.mobile';
const bundleId =
  VARIANT === 'production' ? BUNDLE_ID_BASE : `${BUNDLE_ID_BASE}.${VARIANT}`;

const API_URL =
  process.env.NOCTURNA_API_URL ||
  (VARIANT === 'development'
    ? 'http://localhost:8001'
    : 'https://api.nocturna.app'); // ← replace with your Cloud Run URL before first store build

export default {
  expo: {
    name: VARIANT === 'production' ? 'Nocturna' : `Nocturna (${VARIANT})`,
    slug: 'nocturna',
    version: '1.0.0',
    scheme: 'nocturna',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    icon: './assets/icon.png',
    backgroundColor: '#08070d',
    primaryColor: '#d4af56',

    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#08070d',
    },

    assetBundlePatterns: ['**/*'],

    ios: {
      bundleIdentifier: bundleId,
      buildNumber: '1',
      supportsTablet: true,
      config: {
        usesNonExemptEncryption: false, // standard HTTPS only → skips the export-compliance questionnaire
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Nocturna uses your location to find venues near you and rank tonight’s plans by distance.',
        UIBackgroundModes: ['remote-notification'],
      },
    },

    android: {
      package: bundleId,
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#08070d',
      },
      permissions: [
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
        'POST_NOTIFICATIONS',
      ],
      blockedPermissions: [
        'android.permission.RECORD_AUDIO', // pulled in transitively by expo modules; we never record audio
      ],
    },

    web: { bundler: 'metro' },

    plugins: [
      'expo-router',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Nocturna uses your location to find venues near you and rank tonight’s plans by distance.',
          // We never need background location.
          isAndroidBackgroundLocationEnabled: false,
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#d4af56',
        },
      ],
    ],

    extra: {
      apiUrl: API_URL,
      variant: VARIANT,
      eas: {
        projectId: process.env.EAS_PROJECT_ID || undefined,
      },
    },
  },
};
