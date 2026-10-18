import { Link } from '../components/UI';
import { Button, DiscoveryCardSkeleton, Text } from '../components/UI';
import { useCallback, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../auth/api';
import { Screen } from '../components/Screen';
import { theme } from '../components/theme';
import { ProfileApi } from '../profile/api';
import { SwipeDeck } from '../matching/SwipeDeck';
import { DiscoveryApi, type Settings } from './api';
import { foregroundFix } from './location';
import { Filters } from './Filters';

export default function DiscoveryScreen() {
  const router = useRouter();
  const { state, api: auth, manager } = useAuth(); const { t } = useTranslation(); const cache = useQueryClient();

  const accountId = state.account?.id; const api = new DiscoveryApi(auth, manager);
  const settingsKey = ['account', accountId, 'discovery-settings'];
  const settings = useQuery({ queryKey: settingsKey, queryFn: api.settings });
  const profile = useQuery({ queryKey: ['account', accountId, 'profile'], queryFn: new ProfileApi(auth, manager).get });
  const feed = useInfiniteQuery({ queryKey: ['account', accountId, 'discovery', settings.data?.revision], initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api.page(pageParam), getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: !!settings.data && !!profile.data?.complete && profile.data.visible, retry: false, maxPages: 5 });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    void cache.invalidateQueries({ queryKey: ['account', accountId, 'profile'] });
    void cache.invalidateQueries({ queryKey: ['account', accountId, 'discovery-settings'] });
    void cache.invalidateQueries({ queryKey: ['account', accountId, 'discovery'] });
  }, [accountId, cache]));

  async function refresh() {
    await settings.refetch(); await profile.refetch();
    await cache.resetQueries({ queryKey: ['account', accountId, 'discovery'] });
  }
  function saved(value: Settings) {
    cache.setQueryData(settingsKey, value); setMessage('discovery_saved');
    void cache.invalidateQueries({ queryKey: ['account', accountId, 'profile'] });
    cache.removeQueries({ queryKey: ['account', accountId, 'discovery'] });
    setSettingsOpen(false);
  }
  async function locate() {
    setBusy(true); setMessage('');
    try { const point = await foregroundFix(true); saved(await api.location(point.latitude, point.longitude)); setMessage('location_saved'); }
    catch (error) { setMessage(error instanceof ApiError && error.status === 429 ? 'discovery_rate_limited' :
      error instanceof Error && error.message === 'location_denied' ? 'location_denied' : 'location_unavailable'); }
    finally { setBusy(false); }
  }
  async function clearLocation() {
    setBusy(true);
    try { saved(await api.clearLocation()); } catch { setMessage('discovery_save_failed'); } finally { setBusy(false); }
  }

  const settingsButton = (
    <Pressable
      testID="discovery-settings-button"
      accessibilityRole="button"
      accessibilityLabel={t('discovery_filters')}
      onPress={() => setSettingsOpen(true)}
      hitSlop={8}
      style={({ pressed }) => [styles.settingsIconBtn, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.settingsIconText}>⚙️</Text>
    </Pressable>
  );

  if (settings.isPending || profile.isPending) return <Screen title={t('discover')}><DiscoveryCardSkeleton /></Screen>;
  if (!settings.data || !profile.data) return <Screen title={t('discover')}><Text>{t('connection_error')}</Text></Screen>;

  const eligible = profile.data.complete && profile.data.visible;
  const cards = feed.data?.pages.flatMap(p => p.items) ?? [];

  return (
    <Screen title={t('discover')} scroll={false}>
      <View style={styles.container}>
        {eligible && settingsButton}
        {!eligible ? (
          <View style={{ gap: 16, padding: 16 }}>
            <Text style={{ fontSize: 16, color: theme.colors.text, textAlign: 'center', lineHeight: 22 }}>
              {t('discovery_profile_required')}
            </Text>
            <Button
              variant="primary"
              title={t('onboarding_title')}
              onPress={() => router.push('/onboarding')}
            />
            <Link href="/(tabs)/profile">{t('profile')}</Link>
          </View>
        ) : feed.isError ? (
          <View style={{ gap: 16 }}>
            <Text accessibilityRole="alert">
              {t(feed.error instanceof ApiError && feed.error.status === 409 ? 'discovery_changed' : 'discovery_unavailable')}
            </Text>
          </View>
        ) : feed.isPending ? (
          <DiscoveryCardSkeleton />
        ) : (
          <SwipeDeck
            key={accountId}
            cards={cards}
            refresh={async () => {
              await cache.invalidateQueries({ queryKey: ['account', accountId, 'discovery'] });
            }}
          />
        )}
      </View>

      <Modal
        visible={settingsOpen}
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={styles.modalHeader}>
            <Text accessibilityRole="header" style={styles.modalTitle}>{t('discovery_filters')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('cancel')}
              onPress={() => setSettingsOpen(false)}
              hitSlop={8}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Filters
              key={settings.data.revision}
              settings={settings.data}
              api={api}
              saved={saved}
              onClose={() => setSettingsOpen(false)}
            />

            <View style={styles.sectionDivider}>
              <Button
                title={t('discovery_refresh')}
                disabled={feed.isFetching || busy}
                onPress={() => { void refresh(); setSettingsOpen(false); }}
              />
              {eligible && feed.hasNextPage && !feed.isError && (
                <Button
                  disabled={feed.isFetchingNextPage}
                  title={t(feed.isFetchingNextPage ? 'working' : 'discovery_more')}
                  onPress={() => { void feed.fetchNextPage(); }}
                />
              )}
            </View>

            <Button title={t('back')} onPress={() => setSettingsOpen(false)} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  settingsIconBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 100,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(10, 6, 18, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 8,
  },
  settingsIconText: {
    fontSize: 18,
    lineHeight: 22,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  closeBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalContent: {
    padding: 20,
    gap: 20,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
  },
});
