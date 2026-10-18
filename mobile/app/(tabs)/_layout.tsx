import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../src/components/theme';

export default function TabLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 60,
          paddingTop: 4,
          paddingBottom: 4,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{
          title: '',
          tabBarAccessibilityLabel: t('discover'),
          tabBarButtonTestID: 'nav-discover',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.65 }}>
              🔥
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="today-plans"
        options={{
          title: '',
          tabBarAccessibilityLabel: t('today_plans_title', 'დღეს მინდა…'),
          tabBarButtonTestID: 'nav-today-plans',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.65 }}>
              ✨
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="game"
        options={{
          title: '',
          tabBarAccessibilityLabel: t('arena', 'Arena'),
          tabBarButtonTestID: 'nav-game',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.65 }}>
              🍾
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: '',
          tabBarAccessibilityLabel: t('matches'),
          tabBarButtonTestID: 'nav-matches',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.65 }}>
              💖
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '',
          tabBarAccessibilityLabel: t('profile'),
          tabBarButtonTestID: 'nav-profile',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.65 }}>
              👤
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="safety"
        options={{
          href: null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="terms"
        options={{
          href: null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
