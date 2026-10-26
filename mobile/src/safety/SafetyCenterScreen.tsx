import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Card, StateMessage, Text } from '../components/UI';
import { useAuth } from '../auth/AuthProvider';
import { Screen } from '../components/Screen';
import { theme } from '../components/theme';
import { SafetyApi } from './api';
import { SafetyActions } from './SafetyActions';

function Items({ kind }: { kind: 'blocks' | 'prior-conversations' }) {
  const { api: auth, manager, state } = useAuth();
  const { t } = useTranslation();
  const api = useMemo(() => new SafetyApi(auth, manager), [auth, manager, state.account?.id]);

  const query = useInfiniteQuery({
    queryKey: ['account', state.account?.id, 'safety', kind],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api.list(kind, pageParam),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
    retry: false,
    maxPages: 5,
  });

  const items = [
    ...new Map(
      (query.data?.pages.flatMap((p) => p.items) ?? []).map((item) => [item.id, item])
    ).values(),
  ];

  return (
    <FlatList
      data={query.isError ? [] : items}
      keyExtractor={(item) => item.id}
      windowSize={5}
      initialNumToRender={8}
      contentContainerStyle={styles.listContent}
      refreshing={query.isRefetching}
      onRefresh={() => {
        void query.refetch();
      }}
      ListEmptyComponent={
        <StateMessage
          title={t(
            query.isPending
              ? 'working'
              : query.isError
              ? 'connection_error'
              : 'safety_empty_' + kind
          )}
          loading={query.isPending}
        />
      }
      renderItem={({ item }) => (
        <Card style={styles.itemCard}>
          <View style={styles.cardInfo}>
            <Text style={styles.itemTitle}>
              {t(kind === 'blocks' ? 'safety_blocked_account' : 'safety_prior')}
              {' #' + item.id.slice(0, 8)}
            </Text>
            {item.createdAt ? (
              <Text style={styles.itemDate}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            ) : null}
          </View>
          <SafetyActions
            targetId={kind === 'blocks' ? item.id : undefined}
            conversationId={kind === 'prior-conversations' ? item.id : undefined}
            unblock={kind === 'blocks'}
            closed
          />
        </Card>
      )}
      ListFooterComponent={
        query.hasNextPage ? (
          <View style={{ paddingTop: 8 }}>
            <Button
              disabled={query.isFetchingNextPage}
              title={t('discovery_more')}
              onPress={() => {
                void query.fetchNextPage();
              }}
            />
          </View>
        ) : null
      }
    />
  );
}

export default function SafetyCenterScreen() {
  const { t } = useTranslation();
  const [kind, setKind] = useState<'blocks' | 'prior-conversations'>('blocks');

  return (
    <Screen title={t('blocked_accounts', 'დაბლოკილი ანგარიშები')} scroll={false}>
      <View style={styles.headerBox}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerIcon}>🚫</Text>
          <Text style={styles.headerTitle}>
            {t('blocked_accounts', 'დაბლოკილი ანგარიშები')}
          </Text>
        </View>
        <Text style={styles.headerSubtitle}>
          {t(
            'blocked_accounts_subtitle',
            'მართეთ დაბლოკილი მომხმარებლები და წინა საუბრები'
          )}
        </Text>
      </View>

      <View style={styles.tabSelector}>
        {(['blocks', 'prior-conversations'] as const).map((value) => {
          const isActive = kind === value;
          const label =
            value === 'blocks'
              ? `🚫 ${t('safety_blocks_short', 'დაბლოკილი')}`
              : `💬 ${t('safety_prior_short', 'საუბრები')}`;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => setKind(value)}
              style={[
                styles.tabBtn,
                isActive && styles.tabBtnActive,
              ]}
              testID={`safety-tab-${value}`}
            >
              <Text
                numberOfLines={1}
                style={[styles.tabBtnText, isActive && styles.tabBtnTextActive]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Items key={kind} kind={kind} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBox: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 4,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 18,
  },
  tabSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 14,
    gap: 10,
  },
  tabBtn: {
    flex: 1,
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: '#1C1527',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(251, 113, 133, 0.18)',
    borderColor: '#FB7185',
    shadowColor: '#FB7185',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.muted,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 12,
  },
  itemCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  cardInfo: {
    gap: 2,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  itemDate: {
    fontSize: 12,
    color: theme.colors.muted,
  },
});
