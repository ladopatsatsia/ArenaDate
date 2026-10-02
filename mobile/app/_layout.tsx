import { Button, Text } from '../src/components/UI';
import {PushProvider} from "../src/notifications/PushProvider";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../src/i18n';
import { Stack } from 'expo-router';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { Screen } from '../src/components/Screen';
import { theme } from '../src/components/theme';
import { useReducedMotion } from '../src/components/useReducedMotion';
import { StatusBar } from 'expo-status-bar';

function Navigation() {
  const { t } = useTranslation();
  const { state, manager } = useAuth();
  const reduced=useReducedMotion();
  if (state.status === 'booting') return <Screen title="DatingMVP"><Text>{t('working')}</Text></Screen>;
  if (state.status === 'offline') return <Screen title="DatingMVP">
    <Text>{t(state.notice ?? 'connection_error')}</Text>
    <Button title={t('retry')} onPress={() => { void manager.restore(); }} />
    <Button title={t('logout_local')} onPress={() => { void manager.clear('logout_local_only'); }} />
  </Screen>;
  return <Stack key={state.account?.id??'guest'} screenOptions={{ headerTitle: 'DatingMVP', headerBackTitle: t('back'),headerStyle:{backgroundColor:theme.colors.background},headerTintColor:theme.colors.text,contentStyle:{backgroundColor:theme.colors.background},animation:reduced?'none':'default' }}>
    <Stack.Protected guard={state.status !== 'signedIn'}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" options={{ title: t('auth_login') }} />
      <Stack.Screen name="register" options={{ title: t('auth_register') }} />
      <Stack.Screen name="verify" options={{ title: t('auth_verify') }} />
      <Stack.Screen name="forgot" options={{ title: t('auth_forgot') }} />
      <Stack.Screen name="reset" options={{ title: t('auth_reset') }} />
    </Stack.Protected>
    <Stack.Protected guard={__DEV__}><Stack.Screen name="health" options={{ title: t('health') }} /></Stack.Protected>
    <Stack.Protected guard={state.status === 'signedIn'}><Stack.Screen name="(tabs)" options={{ headerShown: false }} /><Stack.Screen name="notifications" options={{title:t("push_title")}}/><Stack.Screen name="safety" options={{title:t("safety_center")}} /><Stack.Screen name="chat/[id]" options={{ title: t('chat_title') }} /></Stack.Protected>
  </Stack>;
}
export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><StatusBar style="dark"/><AuthProvider><PushProvider><Navigation /></PushProvider></AuthProvider></SafeAreaProvider></GestureHandlerRootView>;
}
