import { Button, Text } from '../components/UI';
import { SafetyActions } from "../safety/SafetyActions";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { theme } from '../components/theme';
import { useReducedMotion } from '../components/useReducedMotion';
import { useFocusEffect, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import { PhotoViewerModal } from '../components/PhotoViewerModal';
import type { Card as DiscoveryCard } from '../discovery/api';
import { MatchApi, type SwipeResult } from './api';
import { SwipeCoordinator } from './coordinator';
import { SwipeCard } from './SwipeCard';
import { SuperLikeModal } from './SuperLikeModal';
import { WalletModal } from '../components/WalletModal';
import { GameApi } from '../game/GameApi';
import { formatCityName } from '../components/cities';
import { formatLanguageDisplay } from '../components/languages';

const journalSchema = z.object({
  pending: z.object({
    requestId: z.uuid(),
    targetId: z.uuid(),
    kind: z.enum(['like', 'pass']),
  }).nullable(),
});

const CARD_HEIGHT = 480;

export function SwipeDeck({ cards, refresh }: { cards: DiscoveryCard[]; refresh: () => Promise<void> }) {
  const { api: auth, manager, state } = useAuth();
  const account = state.account!.id;
  const { t, i18n } = useTranslation();
  const reduced = useReducedMotion();
  const router = typeof useRouter === 'function' ? useRouter() : { push: () => {}, replace: () => {} };

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [viewPhotos, setViewPhotos] = useState<DiscoveryCard['photos'] | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  const [superLikeTarget, setSuperLikeTarget] = useState<DiscoveryCard | null>(null);
  const [superLikeSending, setSuperLikeSending] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  const lock = useRef(false);
  const mounted = useRef(true);
  const cache = useQueryClient();
  const api = useMemo(() => new MatchApi(auth, manager), [auth, manager]);
  const gameApi = useMemo(() => new GameApi(auth, manager), [auth, manager]);

  const walletQuery = useQuery({
    queryKey: ['game-wallet'],
    queryFn: () => gameApi.getWallet(),
    staleTime: 10_000,
  });

  const handleSuperLikeConfirm = async (note: string) => {
    if (!superLikeTarget || superLikeSending) return;
    setSuperLikeSending(true);
    try {
      const res = await api.superLike({
        requestId: Crypto.randomUUID(),
        targetId: superLikeTarget.id,
        note: note || undefined,
      });

      await cache.invalidateQueries({ queryKey: ['game-wallet'] });
      setRemoved(values => [...values, superLikeTarget.id].slice(-150));
      setSuperLikeTarget(null);

      if (res.matchId) {
        setModal(res.matchId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'superlike_failed';
      setMessage(msg);
    } finally {
      setSuperLikeSending(false);
    }
  };

  const coordinator = useMemo(() => {
    const key = 'dating.swipe.' + account;
    const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
    const isWeb = Platform.OS === 'web';
    const getItem = async (k: string) => {
      if (isWeb) {
        try { return typeof window !== 'undefined' ? window.localStorage.getItem(k) : null; }
        catch { return null; }
      }
      return SecureStore.getItemAsync(k, options);
    };
    const setItem = async (k: string, v: string) => {
      if (isWeb) {
        try { if (typeof window !== 'undefined') window.localStorage.setItem(k, v); }
        catch { /* ignore */ }
        return;
      }
      return SecureStore.setItemAsync(k, v, options);
    };
    const deleteItem = async (k: string) => {
      if (isWeb) {
        try { if (typeof window !== 'undefined') window.localStorage.removeItem(k); }
        catch { /* ignore */ }
        return;
      }
      return SecureStore.deleteItemAsync(k, options);
    };

    return new SwipeCoordinator(api, {
      load: async () => {
        try {
          const raw = await getItem(key);
          if (!raw) return { pending: null };
          const value: unknown = JSON.parse(raw);
          const parsed = z.object({ origin: z.string(), data: journalSchema }).safeParse(value);
          if (!parsed.success || parsed.data.origin !== auth.baseUrl) {
            await deleteItem(key).catch(() => {});
            return { pending: null };
          }
          return parsed.data.data;
        } catch {
          await deleteItem(key).catch(() => {});
          return { pending: null };
        }
      },
      hasSeen: async id => {
        try {
          return (await getItem(key + '.match.' + id)) === '1';
        } catch {
          return false;
        }
      },
      markSeen: id => setItem(key + '.match.' + id, '1').catch(() => {}),
      save: value => setItem(key, JSON.stringify({ origin: auth.baseUrl, data: value })).catch(() => {}),
    }, Crypto.randomUUID);
  }, [account, api, auth.baseUrl]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const current = useCallback(() => mounted.current && manager.snapshot().account?.id === account, [account, manager]);

  useEffect(() => {
    mounted.current = true;
    void coordinator.restore().then(
      () => { if (current()) setReady(true); },
      () => { if (current()) setMessage('swipe_storage_failed'); }
    );
    return () => { mounted.current = false; };
  }, [coordinator, current]);

  const matched = useCallback(async (id: string) => {
    const show = await coordinator.claimMatch(id);
    if (show && current()) setModal(id);
  }, [coordinator, current]);

  const confirmed = useCallback(async (result: SwipeResult | null) => {
    if (!result) return;
    if (result.matchId) await matched(result.matchId);
    await coordinator.complete();
    if (current()) {
      setRemoved(values => [...values, result.targetId].slice(-150));
      setMessage('');
      await refreshRef.current();
    }
  }, [coordinator, current, matched]);

  async function act(kind?: 'like' | 'pass', target?: string) {
    if (!ready || lock.current || modal) return;
    lock.current = true;
    setBusy(true);
    setMessage('');
    try {
      await confirmed(kind && target ? await coordinator.decide(target, kind) : await coordinator.reconcile());
    } catch {
      if (current()) {
        setMessage(coordinator.pending ? 'swipe_uncertain' : 'swipe_rejected');
        if (!coordinator.pending) await refresh();
      }
    } finally {
      lock.current = false;
      if (current()) setBusy(false);
    }
  }

  useFocusEffect(useCallback(() => {
    let active = true;
    const poll = async () => {
      if (!ready || lock.current || modal || AppState.currentState !== 'active') return;
      lock.current = true;
      try {
        if (coordinator.pending) await confirmed(await coordinator.reconcile());
        else {
          const notices = await api.notices();
          for (const notice of notices) {
            if (!active || !current()) break;
            if (await coordinator.claimMatch(notice.matchId)) {
              if (current()) setModal(notice.matchId);
              break;
            }
          }
        }
      } catch {
        if (active && current() && coordinator.pending) setMessage('swipe_uncertain');
      } finally {
        lock.current = false;
      }
    };
    void poll();
    const interval = setInterval(() => { void poll(); }, 10000);
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') void poll(); });
    return () => {
      active = false;
      clearInterval(interval);
      subscription.remove();
    };
  }, [ready, modal, coordinator, api, current, confirmed]));

  const card = cards.find(c => !removed.includes(c.id));
  const lastRecordedCardId = useRef<string | null>(null);

  useEffect(() => {
    if (card && card.id !== lastRecordedCardId.current) {
      lastRecordedCardId.current = card.id;
      api.recordView(card.id).catch(() => {});
    }
  }, [card?.id, api]);

  return (
    <View style={styles.deckContainer}>
      {!!message && message !== 'swipe_saved' && message !== 'swipe_sending' && (
        <Text accessibilityRole="alert">{t(message)}</Text>
      )}
      {coordinator.pending && (
        <Button
          disabled={busy || !ready}
          title={t('swipe_reconcile')}
          onPress={() => { void act(); }}
        />
      )}

      {card ? (
        <SwipeCard
          key={card.id}
          disabled={!ready || busy || !!coordinator.pending || !!modal || superLikeSending}
          decide={kind => { void act(kind, card.id); }}
          onSuperLike={() => setSuperLikeTarget(card)}
        >
          <View style={styles.cardFrame}>
            <ScrollView
              style={styles.cardScroll}
              contentContainerStyle={styles.cardScrollContent}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Main Photo Viewport */}
              <View style={styles.photoViewport}>
                <Pressable
                  accessibilityRole="imagebutton"
                  accessibilityLabel={`${card.displayName}, ${card.age}`}
                  onPress={() => {
                    if (card.photos.length > 0) {
                      setViewPhotos(card.photos);
                      setPhotoIndex(0);
                    }
                  }}
                  style={styles.photoPressable}
                >
                  {card.photos[0] ? (
                    <PrivatePhoto
                      photo={card.photos[0]}
                      style={styles.mainPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.noPhotoPlaceholder}>
                      <Text style={{ fontSize: 72 }}>👤</Text>
                    </View>
                  )}

                  {/* Top Overlay: Name, Age, Gender icon (Left) & Safety dots (Right) */}
                  <View style={styles.topOverlayRow}>
                    <View style={styles.nameBadge}>
                      <Text accessibilityRole="header" style={styles.nameAgeText}>
                        {card.displayName}, {card.age}
                      </Text>
                      {(card.gender === 'woman' || card.gender === 'female') && (
                        <View style={styles.genderBadgeWoman} testID="gender-badge-woman">
                          <Text style={styles.genderIconWoman}>♀</Text>
                        </View>
                      )}
                      {(card.gender === 'man' || card.gender === 'male') && (
                        <View style={styles.genderBadgeMan} testID="gender-badge-man">
                          <Text style={styles.genderIconMan}>♂</Text>
                        </View>
                      )}
                      {card.gender && card.gender !== 'woman' && card.gender !== 'female' && card.gender !== 'man' && card.gender !== 'male' && (
                        <View style={styles.genderBadgeOther}>
                          <Text style={styles.genderIconOther}>⚧</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.safetyIconBackdrop}>
                      <SafetyActions
                        variant="dots"
                        targetId={card.id}
                        onDone={action => {
                          if (action === 'block') {
                            setRemoved(values => [...values, card.id].slice(-150));
                            void refresh();
                          }
                        }}
                      />
                    </View>
                  </View>

                  {/* Bottom Overlay: Location (Left) & Scroll Up Hint (Right) */}
                  <View style={styles.bottomOverlayRow}>
                    <View style={styles.locationBadge}>
                      <Text style={styles.locationText}>
                        📍 {formatCityName(card.city, i18n.language)}
                        {card.distanceBucket ? ' · ' + t('distance_' + card.distanceBucket) : ''}
                      </Text>
                    </View>
                    <View style={styles.scrollHintBadge}>
                      <Text style={styles.scrollHintText}>▲ {t('swipe_more_info', 'მეტი ინფო')}</Text>
                    </View>
                  </View>
                </Pressable>
              </View>

              {/* Scrolled Info Section Inside Card */}
              <View style={styles.detailsSection}>
                {/* Gender & Goal Badges */}
                <View style={styles.badgeRow}>
                  {!!card.gender && (
                    <View style={styles.pillBadge}>
                      <Text style={styles.pillBadgeText}>{t('choice_' + card.gender)}</Text>
                    </View>
                  )}
                  {!!card.relationshipGoal && (
                    <View style={styles.pillBadge}>
                      <Text style={styles.pillBadgeText}>{t('choice_' + card.relationshipGoal)}</Text>
                    </View>
                  )}
                </View>

                {/* Bio */}
                {!!card.bio && (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>{t('profile_bio')}</Text>
                    <Text style={styles.bioContentText}>{card.bio}</Text>
                  </View>
                )}

                {/* Interests */}
                {card.interests && card.interests.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>{t('profile_interests')}</Text>
                    <View style={styles.interestChipsWrap}>
                      {card.interests.map(i => (
                        <View key={i} style={styles.interestChip}>
                          <Text style={styles.interestChipText}>{t('choice_' + i)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Spoken Languages */}
                {card.languages && card.languages.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>🗣️ {t('profile_languages')}</Text>
                    <View style={styles.interestChipsWrap}>
                      {card.languages.map(lang => (
                        <View key={lang} style={styles.interestChip}>
                          <Text style={styles.interestChipText}>{formatLanguageDisplay(lang, i18n.language === 'en' ? 'en' : 'ka')}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Additional Photos Grid */}
                {card.photos && card.photos.length > 1 && (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionTitle}>{t('profile_photos')}</Text>
                    <View style={styles.galleryGrid}>
                      {card.photos.map((p, idx) => (
                        <Pressable
                          key={p.id}
                          onPress={() => {
                            setViewPhotos(card.photos);
                            setPhotoIndex(idx);
                          }}
                          style={styles.galleryThumb}
                        >
                          <PrivatePhoto
                            photo={p}
                            style={styles.thumbImage}
                            resizeMode="cover"
                          />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {/* Empty bottom spacer so floating action buttons (X, Super Like, Heart) never cover about text or details */}
                <View style={styles.scrollBottomSpacer} testID="swipe-card-bottom-spacer" />
              </View>
            </ScrollView>
          </View>
        </SwipeCard>
      ) : (
        <View style={styles.emptyContainer} testID="discovery-empty-state">
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIconEmoji}>🍾</Text>
            </View>
            <Text accessibilityRole="header" style={styles.emptyTitle}>
              {t('discovery_empty_title', 'ახალი პროფილები ჯერ არ არის')}
            </Text>
            <Text style={styles.emptyPitch}>
              {t('discovery_empty_bottle_pitch', 'სცადე ბოთლის თამაში! 🍾 ცოცხალ მაგიდაზე შეიძლება გელოდება ვინმე საინტერესო...')}
            </Text>
            <Text style={styles.emptyFootnote}>
              {t('discovery_empty')}
            </Text>

            <View style={styles.emptyActions}>
              <Pressable
                testID="go-to-bottle-game-btn"
                accessibilityRole="button"
                accessibilityLabel={t('discovery_empty_bottle_btn')}
                onPress={() => router.push('/(tabs)/game')}
                style={({ pressed }) => [
                  styles.emptyPrimaryBtn,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.emptyPrimaryBtnText}>
                  {t('discovery_empty_bottle_btn', '🍾 გადადი ბოთლის თამაშზე')}
                </Text>
              </Pressable>

              <Pressable
                testID="discovery-empty-refresh-btn"
                accessibilityRole="button"
                accessibilityLabel={t('discovery_empty_refresh_btn')}
                onPress={() => { void refresh(); }}
                style={({ pressed }) => [
                  styles.emptySecondaryBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.emptySecondaryBtnText}>
                  {t('discovery_empty_refresh_btn', '🔄 სიის განახლება')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Match Celebration Modal */}
      <Modal
        visible={!!modal}
        transparent
        animationType={reduced ? 'none' : 'fade'}
        onRequestClose={() => setModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalContent}>
            <Text accessibilityRole="header" style={styles.modalTitle}>
              {t('match_title')}
            </Text>
            <Text style={styles.modalSubtitle}>
              {t('match_confirmed')}
            </Text>
            <Button
              variant="primary"
              title={t('match_continue')}
              onPress={() => setModal(null)}
            />
          </View>
        </View>
      </Modal>

      {/* Fullscreen Photo Viewer Modal */}
      {!!viewPhotos && (
        <PhotoViewerModal
          photos={viewPhotos}
          initialIndex={photoIndex}
          visible={true}
          onClose={() => setViewPhotos(null)}
        />
      )}

      {/* Super Like Modal */}
      <SuperLikeModal
        visible={!!superLikeTarget}
        targetUser={superLikeTarget ? {
          id: superLikeTarget.id,
          displayName: superLikeTarget.displayName,
          age: superLikeTarget.age,
          photo: superLikeTarget.photos[0] ?? null,
        } : null}
        userBalance={Number(walletQuery.data?.balance ?? 0)}
        isSending={superLikeSending}
        onClose={() => setSuperLikeTarget(null)}
        onConfirm={handleSuperLikeConfirm}
        onTopUpCrystals={() => setShowWalletModal(true)}
      />

      {/* Wallet Top-up Modal */}
      <WalletModal
        visible={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        gameApi={gameApi}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  deckContainer: {
    gap: 12,
  },
  cardFrame: {
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardScroll: {
    flex: 1,
  },
  cardScrollContent: {
    flexGrow: 1,
  },
  photoViewport: {
    height: CARD_HEIGHT,
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F091C',
  },
  photoPressable: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  mainPhoto: {
    width: '100%',
    height: '100%',
  },
  noPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E172B',
  },
  topOverlayRow: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  nameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 6, 18, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  nameAgeText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  genderIcon: {
    fontSize: 18,
  },
  genderBadgeWoman: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(244, 63, 94, 0.22)',
    borderWidth: 1.5,
    borderColor: '#FB7185',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  genderIconWoman: {
    color: '#FDA4AF',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center',
  },
  genderBadgeMan: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(14, 165, 233, 0.22)',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  genderIconMan: {
    color: '#7DD3FC',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center',
  },
  genderBadgeOther: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
    borderWidth: 1.5,
    borderColor: '#C084FC',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  genderIconOther: {
    color: '#E9D5FF',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  safetyIconBackdrop: {
    borderRadius: 20,
    backgroundColor: 'rgba(10, 6, 18, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  bottomOverlayRow: {
    position: 'absolute',
    bottom: 96,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  locationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 6, 18, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  locationText: {
    color: '#EDEDF2',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollHintBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 6, 18, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  scrollHintText: {
    color: '#D4CDE6',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsSection: {
    minHeight: CARD_HEIGHT,
    padding: 20,
    paddingBottom: 24,
    gap: 18,
    backgroundColor: theme.colors.surface,
  },
  scrollBottomSpacer: {
    height: 120,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#231B33',
    borderWidth: 1,
    borderColor: '#3D3156',
  },
  pillBadgeText: {
    color: '#F0EDF7',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionBlock: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bioContentText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.text,
  },
  interestChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#1E172E',
    borderWidth: 1,
    borderColor: '#382D52',
  },
  interestChipText: {
    color: '#F472B6',
    fontSize: 13,
    fontWeight: '600',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  galleryThumb: {
    width: '48%',
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 6, 18, 0.85)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    padding: 28,
    gap: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: {
    color: theme.colors.match,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSubtitle: {
    textAlign: 'center',
    color: theme.colors.text,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 460,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  emptyCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#161124',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyIconEmoji: {
    fontSize: 38,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  emptyPitch: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E2E8F0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  emptyFootnote: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  emptyActions: {
    width: '100%',
    gap: 10,
  },
  emptyPrimaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyPrimaryBtnText: {
    color: theme.colors.onPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  emptySecondaryBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySecondaryBtnText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
