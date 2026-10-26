import type { ExpoConfig } from 'expo/config';

const profile = process.env.EAS_BUILD_PROFILE;
const release = profile === 'preview' || profile === 'production';
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (release && (!apiUrl?.startsWith('https://') || !process.env.IOS_BUNDLE_IDENTIFIER || !process.env.ANDROID_APPLICATION_ID || !process.env.EAS_PROJECT_ID)) {
  throw new Error('Preview/production requires HTTPS API URL and owner-provided bundle, package and EAS project IDs.');
}

const config: ExpoConfig = {
  name: 'ARENA',
  slug: 'dating-mvp',
  version: '0.1.0',
  scheme: 'datingmvp',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  icon: './assets/icon.png',
  platforms: ['ios', 'android', 'web'],
  runtimeVersion: { policy: 'appVersion' },
  ios: {
    supportsTablet: false,
    buildNumber: process.env.IOS_BUILD_NUMBER || '1',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSPhotoLibraryUsageDescription: 'Choose photos for your dating profile.',
      NSLocationWhenInUseUsageDescription: 'Use your approximate area to find nearby people.',
    },
    ...(process.env.IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER } : {}),
    ...(process.env.APP_ASSOCIATED_DOMAIN ? { associatedDomains: [`applinks:${process.env.APP_ASSOCIATED_DOMAIN}`] } : {}),
  },
  android: {
    softwareKeyboardLayoutMode: 'resize',
    versionCode: parseInt(process.env.ANDROID_VERSION_CODE || '1', 10),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#120E1C',
    },
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.POST_NOTIFICATIONS',
    ],
    blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION'],
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
    ...(process.env.ANDROID_APPLICATION_ID ? { package: process.env.ANDROID_APPLICATION_ID } : {}),
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    backgroundColor: '#0b0716',
  },
  plugins: [
    ['expo-notifications', { defaultChannel: 'activity' }],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Use your approximate area to find nearby people.',
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    'expo-router',
    'expo-localization',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose photos for your dating profile.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  ...(process.env.EAS_PROJECT_ID ? { extra: { eas: { projectId: process.env.EAS_PROJECT_ID } } } : {}),
};

export default config;
