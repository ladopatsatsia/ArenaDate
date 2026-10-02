import type { ExpoConfig } from 'expo/config';

const profile = process.env.EAS_BUILD_PROFILE;
const release = profile === 'preview' || profile === 'production';
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (release && (!apiUrl?.startsWith('https://') || !process.env.IOS_BUNDLE_IDENTIFIER || !process.env.ANDROID_APPLICATION_ID || !process.env.EAS_PROJECT_ID)) {
  throw new Error('Preview/production requires HTTPS API URL and owner-provided bundle, package and EAS project IDs.');
}
const config: ExpoConfig = {
  name: 'DatingMVP', slug: 'dating-mvp', version: '0.1.0', scheme: 'datingmvp',
  orientation: 'portrait', userInterfaceStyle: 'light',
  platforms: ['ios', 'android'],
  ios: { supportsTablet: false, ...(process.env.IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER } : {}) },
  android: { softwareKeyboardLayoutMode:'resize', ...(process.env.GOOGLE_SERVICES_JSON ? {googleServicesFile:process.env.GOOGLE_SERVICES_JSON} : {}), ...(process.env.ANDROID_APPLICATION_ID ? { package: process.env.ANDROID_APPLICATION_ID } : {}) },
  plugins: [['expo-notifications', {defaultChannel:'activity'}], ['expo-location', { locationWhenInUsePermission: 'Use your approximate area to find nearby people.', locationAlwaysAndWhenInUsePermission: false, locationAlwaysPermission: false, isIosBackgroundLocationEnabled: false, isAndroidBackgroundLocationEnabled: false, isAndroidForegroundServiceEnabled: false }], 'expo-router', 'expo-localization', 'expo-secure-store', ['expo-image-picker', { photosPermission: 'Choose photos for your dating profile.', cameraPermission: false, microphonePermission: false }]],
  ...(process.env.EAS_PROJECT_ID ? { extra: { eas: { projectId: process.env.EAS_PROJECT_ID } } } : {}),
};
export default config;
