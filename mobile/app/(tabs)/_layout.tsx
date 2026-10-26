import { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { theme } from '../../src/components/theme';
import { useAuth } from '../../src/auth/AuthProvider';
import { MatchApi, type MatchSummary } from '../../src/matching/api';

export default function TabLayout() {
  const { t } = useTranslation();
  const { state, api, manager } = useAuth();
  const queryClient = useQueryClient();
  const accountId = state.account?.id;

  const matchesBadgeQuery = useQuery({
    queryKey: ['account', accountId, 'matches-badge'],
    queryFn: async () => {
      const matchApi = new MatchApi(api, manager);
      return matchApi.list(null);
    },
    enabled: state.status === 'signedIn' && !!accountId,
    refetchInterval: 5000,
    staleTime: 3000,
  });

  const totalUnread = useMemo(() => {
    // 1. Check infinite matches query cache if loaded
    const cachedInfinite = queryClient.getQueryData<{ pages: Array<{ items: MatchSummary[] }> }>([
      'account',
      accountId,
      'matches',
    ]);
    if (cachedInfinite?.pages && cachedInfinite.pages.length > 0) {
      const allItems = cachedInfinite.pages.flatMap((p) => p.items);
      return allItems.reduce((acc, m) => acc + (Number(m.unreadCount) || 0), 0);
    }
    // 2. Fallback to matchesBadgeQuery data
    const items = matchesBadgeQuery.data?.items ?? [];
    return items.reduce((acc, m) => acc + (Number(m.unreadCount) || 0), 0);
  }, [matchesBadgeQuery.data, accountId, queryClient]);

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
            <View style={styles.tabIconWrapper}>
              <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.65 }}>
                💖
              </Text>
              {totalUnread > 0 && (
                <View
                  testID="tab-matches-unread-badge"
                  style={styles.tabUnreadBadge}
                  accessibilityLabel={`${totalUnread} new messages`}
                >
                  <Text style={styles.tabUnreadBadgeText}>
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </Text>
                </View>
              )}
            </View>
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

const styles = StyleSheet.create({
  tabIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  tabUnreadBadge: {
    position: 'absolute',
    top: -3,
    right: -8,
    backgroundColor: '#EF4444',
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.surface,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  tabUnreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
    textAlign: 'center',
  },
});

