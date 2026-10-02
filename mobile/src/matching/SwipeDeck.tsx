import { Button, Text } from '../components/UI';
import { SafetyActions } from "../safety/SafetyActions";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, View } from 'react-native';
import { Card } from '../components/UI';
import { useReducedMotion } from '../components/useReducedMotion';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import type { Card as DiscoveryCard } from '../discovery/api';
import { MatchApi, type SwipeResult } from './api';
import { SwipeCoordinator } from './coordinator';
import { SwipeCard } from './SwipeCard';
const journalSchema = z.object({ pending: z.object({ requestId: z.uuid(), targetId: z.uuid(), kind: z.enum(['like','pass']) }).nullable() });
export function SwipeDeck({ cards, refresh }: { cards: DiscoveryCard[]; refresh: () => Promise<void> }) {
 const { api: auth, manager, state } = useAuth(); const account = state.account!.id; const { t } = useTranslation();
 const reduced=useReducedMotion();
 const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
 const [modal, setModal] = useState<string | null>(null); const [removed, setRemoved] = useState<string[]>([]);
 const lock = useRef(false); const mounted = useRef(true);
 const api = useMemo(() => new MatchApi(auth,manager), [auth,manager]);
 const coordinator = useMemo(() => {
  const key = 'dating.swipe.' + account;
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  return new SwipeCoordinator(api, {
   load: async () => {
    const raw = await SecureStore.getItemAsync(key,options);
    if (!raw) return { pending: null };
    const value: unknown = JSON.parse(raw);
    // Separate backend environments as well as accounts; do not replay an intent at another API.
    const wrapper = z.object({ origin: z.literal(auth.baseUrl), data: journalSchema }).parse(value);
    return wrapper.data;
   },
   hasSeen: async id => await SecureStore.getItemAsync(key + '.match.' + id,options) === '1',
   markSeen: id => SecureStore.setItemAsync(key + '.match.' + id,'1',options),
   save: value => SecureStore.setItemAsync(key,JSON.stringify({ origin: auth.baseUrl, data: value }),options),
  }, Crypto.randomUUID);
 }, [account,api,auth.baseUrl]);
 const refreshRef = useRef(refresh); refreshRef.current = refresh;
 const current = useCallback(() => mounted.current && manager.snapshot().account?.id === account, [account,manager]);
 useEffect(() => { mounted.current = true; void coordinator.restore().then(() => { if (current()) setReady(true); },
  () => { if (current()) setMessage('swipe_storage_failed'); });
  return () => { mounted.current = false; };
 }, [coordinator,current]);
 const matched = useCallback(async (id: string) => {
  const show = await coordinator.claimMatch(id);
  if (show && current()) setModal(id);
 }, [coordinator,current]);
 const confirmed = useCallback(async (result: SwipeResult | null) => {
  if (!result) return;
  if (result.matchId) await matched(result.matchId);
  await coordinator.complete();
  if (current()) { setRemoved(values => [...values,result.targetId].slice(-150)); setMessage('swipe_saved'); await refreshRef.current(); }
 }, [coordinator,current,matched]);
 async function act(kind?: 'like' | 'pass', target?: string) {
  if (!ready || lock.current || modal) return;
  lock.current = true; setBusy(true); setMessage('swipe_sending');
  try { await confirmed(kind && target ? await coordinator.decide(target,kind) : await coordinator.reconcile()); }
  catch { if (current()) { setMessage(coordinator.pending ? 'swipe_uncertain' : 'swipe_rejected'); if (!coordinator.pending) await refresh(); } }
  finally { lock.current = false; if (current()) setBusy(false); }
 }
 // Foreground polling consumes the durable outbox inbox. No SignalR/chat/push is started.
 useFocusEffect(useCallback(() => {
  let active = true;
  const poll = async () => {
   if (!ready || lock.current || modal || AppState.currentState!=='active') return;
   lock.current = true;
   try {
    if (coordinator.pending) await confirmed(await coordinator.reconcile());
    else {
     const notices = await api.notices();
     for (const notice of notices) {
      if (!active || !current()) break;
      if (await coordinator.claimMatch(notice.matchId)) { if (current()) setModal(notice.matchId); break; }
     }
    }
   } catch { if (active && current() && coordinator.pending) setMessage('swipe_uncertain'); }
   finally { lock.current = false; }
  };
  void poll(); const interval = setInterval(() => { void poll(); },10000);const subscription=AppState.addEventListener('change',next=>{if(next==='active')void poll();});
  return () => { active = false; clearInterval(interval);subscription.remove(); };
 }, [ready,modal,coordinator,api,current,confirmed]));
 const card = cards.find(c => !removed.includes(c.id));
 return <View style={{ gap: 12 }}>
  {!!message && <Text accessibilityRole="alert">{t(message)}</Text>}
  {coordinator.pending && <Button disabled={busy || !ready} title={t('swipe_reconcile')} onPress={() => { void act(); }} />}
  {card ? <SwipeCard key={card.id} disabled={!ready || busy || !!coordinator.pending || !!modal} decide={kind => { void act(kind,card.id); }}>
   <Card>
    <Text accessibilityRole="header">{card.displayName}, {card.age}</Text>
    {card.photos[0] && <PrivatePhoto photo={card.photos[0]} />}
    <Text>{card.city}{card.distanceBucket ? ' · ' + t('distance_' + card.distanceBucket) : ''}</Text>
    <Text>{t('choice_' + card.gender)} · {t('choice_' + card.relationshipGoal)}</Text>
    <Text>{card.bio}</Text><Text>{card.interests.map(i => t('choice_' + i)).join(' · ')}</Text><SafetyActions targetId={card.id} onDone={action=>{if(action==="block"){setRemoved(values=>[...values,card.id].slice(-150));void refresh();}}}/>
   </Card>
  </SwipeCard> : <Text>{t('discovery_empty')}</Text>}
  <Modal visible={!!modal} transparent animationType={reduced?'none':'fade'} onRequestClose={() => setModal(null)}>
   <View style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 24 }}>
    <View accessibilityViewIsModal style={{ backgroundColor: 'white', padding: 28, gap: 20, borderRadius: 18 }}>
     <Text accessibilityRole="header">{t('match_title')}</Text><Text>{t('match_confirmed')}</Text>
     <Button title={t('match_continue')} onPress={() => setModal(null)} />
    </View>
   </View>
  </Modal>
 </View>;
}
