import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { theme } from '../../src/components/theme';
export default function TabLayout() {
  const { t } = useTranslation();
  return <Tabs screenOptions={{headerStyle:{backgroundColor:theme.colors.background},headerTintColor:theme.colors.text,tabBarActiveTintColor:theme.colors.primary,tabBarInactiveTintColor:theme.colors.muted,tabBarStyle:{backgroundColor:theme.colors.surface},tabBarLabelStyle:{fontSize:13},tabBarAllowFontScaling:true}}><Tabs.Screen name="discover" options={{ title: t('discover'),tabBarButtonTestID:'nav-discover' }} /><Tabs.Screen name="matches" options={{ title: t('matches'),tabBarButtonTestID:'nav-matches' }} /><Tabs.Screen name="profile" options={{ title: t('profile'),tabBarButtonTestID:'nav-profile' }} /></Tabs>;
}
