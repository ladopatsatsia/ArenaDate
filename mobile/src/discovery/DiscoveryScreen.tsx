import { Link } from '../components/UI';
import { Button, Text } from '../components/UI';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../auth/api';
import { Screen } from '../components/Screen';
import { ProfileApi } from '../profile/api';
import { SwipeDeck } from '../matching/SwipeDeck';
import { DiscoveryApi, type Settings } from './api';
import { foregroundFix } from './location';
import { Filters } from './Filters';
export default function DiscoveryScreen() {
  const { state, api: auth, manager } = useAuth(); const { t } = useTranslation(); const cache = useQueryClient();
  const accountId = state.account?.id; const api = new DiscoveryApi(auth, manager);
  const settingsKey = ['account', accountId, 'discovery-settings'];
  const settings = useQuery({ queryKey: settingsKey, queryFn: api.settings });
  const profile = useQuery({ queryKey: ['account', accountId, 'profile'], queryFn: new ProfileApi(auth, manager).get });
  const feed = useInfiniteQuery({ queryKey: ['account', accountId, 'discovery', settings.data?.revision], initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api.page(pageParam), getNextPageParam: page => page.nextCursor ?? undefined,
    enabled: !!settings.data && !!profile.data?.complete && profile.data.visible, retry: false, maxPages: 5 });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [filtersOpen,setFiltersOpen]=useState(false);
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
  if (settings.isPending || profile.isPending) return <Screen title={t('discover')}><Text>{t('working')}</Text></Screen>;
  if (!settings.data || !profile.data) return <Screen title={t('discover')}><Text>{t('connection_error')}</Text>
    <Button title={t('retry')} onPress={() => { void refresh(); }} /></Screen>;
  const eligible = profile.data.complete && profile.data.visible;
  const cards = feed.data?.pages.flatMap(p => p.items) ?? [];
  return <Screen title={t('discover')}>
    <Button title={t(filtersOpen?'filters_hide':'discovery_filters')} selected={filtersOpen} onPress={()=>setFiltersOpen(v=>!v)}/>
    {filtersOpen&&<Filters key={settings.data.revision} settings={settings.data} api={api} saved={saved} />}
    <Text>{t('location_notice')}</Text>
    <Button title={t(busy ? 'working' : 'location_use')} disabled={busy} onPress={() => Alert.alert(t('location_use'), t('location_consent'), [
      { text: t('cancel'), style: 'cancel' }, { text: t('location_allow'), onPress: () => { void locate(); } }])} />
    {settings.data.hasLocation && <Button title={t('location_remove')} disabled={busy} onPress={() => { void clearLocation(); }} />}
    {message && <Text accessibilityRole="alert">{t(message)}</Text>}
    {message === 'location_denied' && <Button title={t('open_settings')} onPress={() => { void Linking.openSettings().catch(() => setMessage('location_unavailable')); }} />}
    {!eligible ? <><Text>{t('discovery_profile_required')}</Text><Link href="/(tabs)/profile">{t('profile')}</Link></> :
      feed.isError ? <><Text accessibilityRole="alert">{t(feed.error instanceof ApiError && feed.error.status === 409 ? 'discovery_changed' : 'discovery_unavailable')}</Text>
        <Button title={t('retry')} onPress={() => { void refresh(); }} /></> :
      feed.isPending ? <Text>{t('working')}</Text> :
      null}
    {eligible && !feed.isPending && !feed.isError && <SwipeDeck key={accountId} cards={cards} refresh={async () => {
      await cache.invalidateQueries({ queryKey: ['account', accountId, 'discovery'] });
    }} />}
    {eligible && feed.hasNextPage && !feed.isError && <Button disabled={feed.isFetchingNextPage} title={t(feed.isFetchingNextPage ? 'working' : 'discovery_more')}
      onPress={() => { void feed.fetchNextPage(); }} />}
    <Button title={t('discovery_refresh')} disabled={feed.isFetching || busy} onPress={() => { void refresh(); }} />
  </Screen>;
}
