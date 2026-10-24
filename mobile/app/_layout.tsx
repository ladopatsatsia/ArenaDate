import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, DiscoveryCardSkeleton, Text } from '../src/components/UI';
import {PushProvider} from "../src/notifications/PushProvider";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import i18n, { normalizeLanguageCode, registerLanguageBackendSync } from '../src/i18n';
import { Stack } from 'expo-router';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { ProfileApi } from '../src/profile/api';
import { Screen } from '../src/components/Screen';
import { theme } from '../src/components/theme';
import { useReducedMotion } from '../src/components/useReducedMotion';
import { StatusBar } from 'expo-status-bar';

export { ErrorBoundary } from 'expo-router';

function Navigation() {
  const { t } = useTranslation();
  const { state, manager, api } = useAuth();
  const reduced=useReducedMotion();

  const profileQuery = useQuery({
    queryKey: ['account', state.account?.id, 'profile'],
    queryFn: () => new ProfileApi(api, manager).get(),
    enabled: state.status === 'signedIn' && !!state.account?.id,
    staleTime: 60000,
  });

  const hasSyncedInitialLanguage = useRef<string | null>(null);
  useEffect(() => {
    if (state.status === 'signedIn' && profileQuery.data?.appLanguage) {
      const serverLang = normalizeLanguageCode(profileQuery.data.appLanguage);
      if (serverLang && hasSyncedInitialLanguage.current !== state.account?.id) {
        hasSyncedInitialLanguage.current = state.account?.id ?? null;
        if (i18n.language !== serverLang) {
          void i18n.changeLanguage(serverLang);
        }
      }
    }
  }, [state.status, state.account?.id, profileQuery.data?.appLanguage]);

  useEffect(() => {
    if (state.status === 'signedIn' && state.account?.id) {
      const profileApi = new ProfileApi(api, manager);
      registerLanguageBackendSync((code) => {
        void profileApi.setLanguage(code).catch(() => {});
      });
      return () => {
        registerLanguageBackendSync(null);
      };
    } else {
      registerLanguageBackendSync(null);
    }
  }, [state.status, state.account?.id, api, manager]);

  if (state.status === 'booting') return <Screen title="ARENA"><DiscoveryCardSkeleton /></Screen>;
  if (state.status === 'offline') return <Screen title="ARENA">
    <Text>{t(state.notice ?? 'connection_error')}</Text>
    <Button title={t('logout_local')} onPress={() => { void manager.clear('logout_local_only'); }} />
  </Screen>;
  return <Stack key={state.account?.id??'guest'} screenOptions={{ headerTitle: 'ARENA', headerBackTitle: t('back'),headerStyle:{backgroundColor:theme.colors.background},headerTintColor:theme.colors.text,contentStyle:{backgroundColor:theme.colors.background},animation:reduced?'none':'default' }}>
    <Stack.Protected guard={state.status === 'signedIn'}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="safety" options={{ headerShown: false }} />
      <Stack.Screen name="terms" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="today-plans" options={{ headerShown: false }} />
    </Stack.Protected>
    <Stack.Protected guard={state.status !== 'signedIn'}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" options={{ title: t('auth_login') }} />
      <Stack.Screen name="register" options={{ title: t('auth_register') }} />
      <Stack.Screen name="verify" options={{ title: t('auth_verify') }} />
      <Stack.Screen name="forgot" options={{ title: t('auth_forgot') }} />
      <Stack.Screen name="reset" options={{ title: t('auth_reset') }} />
    </Stack.Protected>
    <Stack.Protected guard={__DEV__}>
      <Stack.Screen name="health" options={{ title: t('health') }} />
    </Stack.Protected>
  </Stack>;
}
export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><StatusBar style="light"/><AuthProvider><PushProvider><Navigation /></PushProvider></AuthProvider></SafeAreaProvider></GestureHandlerRootView>;
}
