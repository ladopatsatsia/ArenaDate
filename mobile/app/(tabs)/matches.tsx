import { Button, Text } from '../../src/components/UI';
import { SafetyActions } from "../../src/safety/SafetyActions";
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, MatchListSkeleton, StateMessage } from '../../src/components/UI';
import { useFocusEffect, useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/auth/AuthProvider';
import { MatchApi, type MatchSummary } from '../../src/matching/api';
import { PrivatePhoto } from '../../src/profile/PrivatePhoto';
import { PhotoViewerModal } from '../../src/components/PhotoViewerModal';
import type { Photo } from '../../src/profile/api';
import * as Crypto from 'expo-crypto';
import { theme } from '../../src/components/theme';
import { formatCityName } from '../../src/components/cities';
import { CHOICE_EMOJIS } from '../../src/profile/ProfileEditor';
import { PremiumModal } from '../../src/premium/PremiumModal';
import { PremiumApi } from '../../src/premium/PremiumApi';
import { SuperLikeModal } from '../../src/matching/SuperLikeModal';
import { GameApi } from '../../src/game/GameApi';
import { formatMessageSnippet } from '../../src/chat/ChatMediaUtils';

interface CandidateProfileModalData {
  mode: 'match' | 'request' | 'view' | 'you_viewed';
  id: string;
  userId?: string | null;
  conversationId?: string;
  displayName: string;
  age: number | string;
  city?: string | null;
  bio?: string | null;
  gender?: string | null;
  relationshipGoal?: string | null;
  interests?: string[] | null;
  photo?: Photo | null;
  photos?: Photo[] | null;
  origin?: string | null;
  note?: string | null;
  viewedAt?: string | null;
}

type MatchesSection = 'viewed_you' | 'you_viewed' | 'matches' | 'requests';

function formatRelativeTime(dateString?: string | null, t?: TFunction): string {
  if (!dateString) return '';
  const diffMs = Math.max(0, Date.now() - new Date(dateString).getTime());
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t ? t('viewed_just_now', 'ახლახანს') : 'ახლახანს';
  if (mins < 60) return t ? t('viewed_minutes_ago', { count: mins, defaultValue: `${mins} წთ წინ` }) : `${mins} წთ წინ`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t ? t('viewed_hours_ago', { count: hours, defaultValue: `${hours} სთ წინ` }) : `${hours} სთ წინ`;
  const days = Math.floor(hours / 24);
  return t ? t('viewed_days_ago', { count: days, defaultValue: `${days} დღის წინ` }) : `${days} დღის წინ`;
}


export default function Matches() {
  const { t, i18n } = useTranslation();
  const { state, api: auth, manager } = useAuth();
  const router = useRouter();
  const cache = useQueryClient();
  const insets = useSafeAreaInsets();
  const accountId = state.account?.id;
  const api = useMemo(() => new MatchApi(auth, manager), [auth, manager, accountId]);
  const premiumApi = useMemo(() => new PremiumApi(auth, manager), [auth, manager]);

  const [section, setSection] = useState<MatchesSection>('matches');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<CandidateProfileModalData | null>(null);
  const [viewPhotos, setViewPhotos] = useState<Photo[] | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [unlockMatchCandidate, setUnlockMatchCandidate] = useState<MatchSummary | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);
  const [superLikeTarget, setSuperLikeTarget] = useState<{
    id: string;
    displayName: string;
    age: number | string;
    photo?: Photo | null;
  } | null>(null);
  const [superLikeSending, setSuperLikeSending] = useState(false);
  const [superLikeFeedback, setSuperLikeFeedback] = useState<string | null>(null);
  const [locallyReadConversations, setLocallyReadConversations] = useState<Record<string, boolean>>({});

  const gameApi = useMemo(() => new GameApi(auth, manager), [auth, manager]);
  const wallet = useQuery({
    queryKey: ['game-wallet'],
    queryFn: () => gameApi.getWallet(),
    retry: false,
  });
  const userBalance = wallet.data?.balance ?? 0;

  const matchesKey = ['account', accountId, 'matches'];
  const requestsKey = ['account', accountId, 'requests'];
  const viewedYouKey = ['account', accountId, 'viewed-you'];
  const youViewedKey = ['account', accountId, 'you-viewed'];
  const premiumStatusKey = ['account', accountId, 'premium-status'];

  const matches = useInfiniteQuery({
    queryKey: matchesKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api.list(pageParam),
    getNextPageParam: page => page.nextCursor ?? undefined,
    retry: false,
    maxPages: 5,
  });

  const requests = useQuery({
    queryKey: requestsKey,
    queryFn: api.requests,
    retry: false,
  });

  const viewedYou = useQuery({
    queryKey: viewedYouKey,
    queryFn: api.viewedYou,
    retry: false,
  });

  const youViewed = useQuery({
    queryKey: youViewedKey,
    queryFn: api.youViewed,
    retry: false,
  });

  const premiumStatus = useQuery({
    queryKey: premiumStatusKey,
    queryFn: premiumApi.status,
    retry: false,
  });
  const hasPremium = premiumStatus.data?.hasPremium === true;

  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void cache.invalidateQueries({ queryKey: matchesKey });
      void cache.invalidateQueries({ queryKey: requestsKey });
      void cache.invalidateQueries({ queryKey: viewedYouKey });
      void cache.invalidateQueries({ queryKey: youViewedKey });
      void cache.invalidateQueries({ queryKey: premiumStatusKey });
    }, [accountId, cache])
  );

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        matches.refetch(),
        requests.refetch(),
        viewedYou.refetch(),
        youViewed.refetch(),
        premiumStatus.refetch(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [matches, requests, viewedYou, youViewed, premiumStatus]);

  async function handleDecision(targetId: string, kind: 'like' | 'pass') {
    if (actionBusy) return;
    setActionBusy(targetId);
    try {
      await api.decide({
        requestId: Crypto.randomUUID(),
        targetId,
        kind,
      });
      await Promise.all([
        cache.invalidateQueries({ queryKey: requestsKey }),
        cache.invalidateQueries({ queryKey: matchesKey }),
        cache.invalidateQueries({ queryKey: viewedYouKey }),
        cache.invalidateQueries({ queryKey: youViewedKey }),
      ]);
      if (kind === 'like') {
        setSection('matches');
      }
    } finally {
      setActionBusy(null);
    }
  }

  const handleSuperLikeConfirm = async (note: string) => {
    if (!superLikeTarget || superLikeSending) return;
    setSuperLikeSending(true);
    try {
      await api.superLike({
        requestId: Crypto.randomUUID(),
        targetId: superLikeTarget.id,
        note: note.trim() || undefined,
      });
      await cache.invalidateQueries({ queryKey: ['game-wallet'] });
      setSuperLikeTarget(null);
      setSelectedProfile(null);
      setSuperLikeFeedback(t('superlike_sent_success', '⭐ სუპერ ლაიქი წარმატებით გაიგზავნა!'));
      setTimeout(() => setSuperLikeFeedback(null), 3500);
      void handleManualRefresh();
    } catch (err: unknown) {
      console.warn('Super like failed:', err);
      const msg = err instanceof Error ? err.message : 'superlike_failed';
      setSuperLikeFeedback(t(msg, 'სუპერ ლაიქის გაგზავნა ვერ მოხერხდა.'));
      setTimeout(() => setSuperLikeFeedback(null), 3500);
    } finally {
      setSuperLikeSending(false);
    }
  };

  const markConversationReadLocally = useCallback((conversationId?: string) => {
    if (!conversationId) return;
    setLocallyReadConversations(prev => ({ ...prev, [conversationId]: true }));
    if (!accountId) return;
    cache.setQueryData(matchesKey, (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          items: page.items.map((m: any) => m.conversationId === conversationId ? { ...m, unreadCount: 0 } : m),
        })),
      };
    });
    cache.setQueryData(['account', accountId, 'matches-badge'], (old: any) => {
      if (!old?.items) return old;
      return {
        ...old,
        items: old.items.map((m: any) => m.conversationId === conversationId ? { ...m, unreadCount: 0 } : m),
      };
    });
  }, [cache, accountId, matchesKey]);

  const openMatchChat = useCallback((match: MatchSummary) => {
    markConversationReadLocally(match.conversationId);
    router.push({
      pathname: '/chat/[id]',
      params: { id: match.conversationId, name: match.displayName },
    });
  }, [markConversationReadLocally, router]);

  const matchItems = [...new Map((matches.data?.pages.flatMap(page => page.items) ?? []).map(m => [m.id, m])).values()]
    .map(m => locallyReadConversations[m.conversationId] ? { ...m, unreadCount: 0 } : m)
    .sort((a, b) => {
      if (a.hasChatEntitlement === false && b.hasChatEntitlement !== false) return -1;
      if (a.hasChatEntitlement !== false && b.hasChatEntitlement === false) return 1;
      return 0;
    });
  const totalUnreadMatches = useMemo(() => {
    return matchItems.reduce((acc, m) => acc + (Number(m.unreadCount) || 0), 0);
  }, [matchItems]);
  const requestItems = requests.data ?? [];
  const lockedGameMatches = matchItems.filter(m => m.origin === 'GameArena' && m.hasChatEntitlement === false);
  const viewedYouItems = viewedYou.data ?? [];
  const youViewedItems = youViewed.data ?? [];

  const refreshButton = (
    <Pressable
      testID="matches-refresh-btn"
      accessibilityRole="button"
      accessibilityLabel={t('discovery_refresh')}
      onPress={() => { void handleManualRefresh(); }}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.iconBtnText}>🔄</Text>
    </Pressable>
  );

  return (
    <Screen title={t('matches')} scroll={false} headerRight={refreshButton}>
      {!!superLikeFeedback && (
        <View style={styles.superLikeFeedbackBanner} testID="superlike-feedback-banner">
          <Text style={styles.superLikeFeedbackText}>{superLikeFeedback}</Text>
        </View>
      )}
      <View style={styles.gridContainer}>
        {/* Row 1: კავშირები და რექუესტები */}
        <View style={styles.gridRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('matches')}
            testID="tab-matches-section"
            onPress={() => setSection('matches')}
            style={[styles.gridTile, section === 'matches' && styles.gridTileActive]}
          >
            <View style={styles.gridTileContentRow}>
              <Text style={[styles.gridTileText, section === 'matches' && styles.gridTileTextActive]}>
                💖 {t('matches')} {matchItems.length > 0 ? `(${matchItems.length})` : ''}
              </Text>
              {totalUnreadMatches > 0 && (
                <View style={styles.unreadRedDot} testID="matches-section-unread-dot">
                  <Text style={styles.unreadRedDotText}>
                    {totalUnreadMatches > 99 ? '99+' : totalUnreadMatches}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('requests')}
            onPress={() => setSection('requests')}
            style={[styles.gridTile, section === 'requests' && styles.gridTileActive]}
          >
            <Text style={[styles.gridTileText, section === 'requests' && styles.gridTileTextActive]}>
              💌 {t('requests')} {requestItems.length > 0 ? `(${requestItems.length})` : ''}
            </Text>
          </Pressable>
        </View>

        {/* Row 2: ნახვები - შენ ნახე და შენ გნახა */}
        <View style={styles.gridRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('you_viewed')}
            testID="tab-you-viewed"
            onPress={() => setSection('you_viewed')}
            style={[styles.gridTile, section === 'you_viewed' && styles.gridTileActive]}
          >
            <Text style={[styles.gridTileText, section === 'you_viewed' && styles.gridTileTextActive]}>
              👀 {t('you_viewed')} {youViewedItems.length > 0 ? `(${youViewedItems.length})` : ''}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('viewed_you')}
            testID="tab-viewed-you"
            onPress={() => setSection('viewed_you')}
            style={[styles.gridTile, section === 'viewed_you' && styles.gridTileActive]}
          >
            <Text style={[styles.gridTileText, section === 'viewed_you' && styles.gridTileTextActive]}>
              👁️ {t('viewed_you')} {viewedYouItems.length > 0 ? `(${viewedYouItems.length})` : ''}
            </Text>
          </Pressable>
        </View>
      </View>

      {section === 'viewed_you' ? (
        <FlatList
          data={viewedYou.isError ? [] : viewedYouItems}
          keyExtractor={v => v.userId}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => { void handleManualRefresh(); }}
          ListHeaderComponent={
            viewedYou.isPending || viewedYou.isError || viewedYouItems.length === 0 ? null : !hasPremium ? (
              <Pressable
                style={styles.premiumPromoBanner}
                onPress={() => setPremiumModalVisible(true)}
                testID="viewed-you-promo-banner"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.crownBannerIcon}>
                    <Text style={{ fontSize: 22 }}>👁️</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promoBannerTitle}>
                      {t('matches_who_viewed_title', 'ვინ მნახა — Arena Black')}
                    </Text>
                    <Text style={styles.promoBannerDesc}>
                      {t('matches_who_viewed_sub', 'ჩართე Arena Black ფოტოების და პროფილების სანახავად')}
                    </Text>
                  </View>
                  <Text style={styles.promoBannerArrow}>›</Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.premiumActiveBadge}>
                <Text style={styles.premiumActiveBadgeText}>
                  {t('matches_who_viewed_active', '👁️ Arena Black — ყველა ნახვა სრულად ხილვადია')}
                </Text>
              </View>
            )
          }
          ListEmptyComponent={
            viewedYou.isPending ? (
              <MatchListSkeleton count={4} />
            ) : (
              <StateMessage
                title={t(viewedYou.isError ? 'connection_error' : 'viewed_you_empty')}
              />
            )
          }
          renderItem={({ item: viewUser }) => {
            const isLocked = !hasPremium || viewUser.isBlurred;
            if (isLocked) {
              return (
                <Card style={[styles.card, styles.lockedCard]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${viewUser.displayName}, ${viewUser.age}. ${t('matches_unlock_photo_btn', '🖤 Arena Black — გახსნა')}`}
                    onPress={() => setPremiumModalVisible(true)}
                    style={({ pressed }) => [styles.cardPressable, pressed && { opacity: 0.85 }]}
                    testID={`viewed-you-locked-${viewUser.userId}`}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.nameRow}>
                          <Text accessibilityRole="header" style={styles.nameHeading}>
                            {viewUser.displayName}, {viewUser.age}
                          </Text>
                          
                        </View>
                        <View style={styles.timeBadge}>
                          <Text style={styles.timeBadgeText}>
                            👁️ {formatRelativeTime(viewUser.viewedAt, t)}
                          </Text>
                        </View>
                        <Text style={styles.blurHintText}>
                          {t('matches_enable_black_to_unlock', 'ჩართე Arena Black ფოტოს გასახსნელად და სანახავად')}
                        </Text>
                      </View>

                      <View style={styles.blurredAvatarWrapper}>
                        {viewUser.photo ? (
                          <View style={styles.blurPhotoWrapper}>
                            <PrivatePhoto photo={viewUser.photo} avatar blurRadius={25} style={styles.blurredPhotoImage} />
                            
                          </View>
                        ) : (
                          <View style={styles.avatarOvalLocked}><Text style={{ fontSize: 24, color: theme.colors.muted }}>👤</Text></View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                  <View style={styles.requestActionsRow}>
                    <Button
                      variant="primary"
                      title={t('matches_unlock_photo_btn', '🖤 Arena Black — გახსნა')}
                      onPress={() => setPremiumModalVisible(true)}
                      style={styles.premiumUnlockBtn}
                      textStyle={styles.premiumUnlockBtnText}
                      testID={`unlock-premium-viewed-you-${viewUser.userId}`}
                    />
                  </View>
                </Card>
              );
            }

            return (
              <Card style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${viewUser.displayName}, ${viewUser.age}. ${t('view_profile')}`}
                  onPress={() => {
                    setSelectedProfile({
                      mode: 'view',
                      id: viewUser.userId,
                      userId: viewUser.userId,
                      displayName: viewUser.displayName,
                      age: viewUser.age,
                      city: viewUser.city,
                      bio: viewUser.bio,
                      gender: viewUser.gender,
                      relationshipGoal: viewUser.relationshipGoal,
                      interests: viewUser.interests,
                      photo: viewUser.photo,
                      photos: viewUser.photos,
                      viewedAt: viewUser.viewedAt,
                    });
                    void api.recordView(viewUser.userId).catch(() => {});
                  }}
                  style={({ pressed }) => [styles.cardPressable, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.nameRow}>
                        <Text accessibilityRole="header" style={styles.nameHeading}>
                          {viewUser.displayName}, {viewUser.age}
                        </Text>
                        <View style={styles.timeBadge}>
                          <Text style={styles.timeBadgeText}>
                            👁️ {formatRelativeTime(viewUser.viewedAt, t)}
                          </Text>
                        </View>
                      </View>
                      {!!viewUser.city && <Text style={styles.subText}>📍 {formatCityName(viewUser.city, i18n.language)}</Text>}
                      {!!viewUser.bio && <Text style={styles.bioText} numberOfLines={2}>{viewUser.bio}</Text>}
                      <Text style={styles.viewBadge}>{t('view_profile')} ›</Text>
                    </View>
                    <View style={styles.cardRightGroup}>
                      <View style={styles.avatarOvalLarge}>
                        {viewUser.photo ? (
                          <PrivatePhoto photo={viewUser.photo} avatar />
                        ) : (
                          <Text style={{ fontSize: 24, color: theme.colors.muted }}>👤</Text>
                        )}
                      </View>
                      <SafetyActions
                        targetId={viewUser.userId}
                        variant="dots"
                        onDone={() => { void handleManualRefresh(); }}
                      />
                    </View>
                  </View>
                </Pressable>

                <View style={styles.swipeSuperLikeCardRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('swipe_superlike', 'სუპერ ლაიქი')}
                    testID={`card-superlike-${viewUser.userId}`}
                    onPress={() => {
                      setSuperLikeTarget({
                        id: viewUser.userId,
                        displayName: viewUser.displayName,
                        age: viewUser.age,
                        photo: viewUser.photo,
                      });
                    }}
                    style={({ pressed }) => [
                      styles.swipeSuperLikeButton,
                      pressed && styles.swipeSuperLikeButtonPressed,
                    ]}
                  >
                    <View style={styles.swipeSuperLikeStarContainer}>
                      <Text style={styles.swipeSuperLikeStarEmoji}>⭐</Text>
                    </View>
                  </Pressable>
                </View>
              </Card>
            );
          }}
        />
      ) : section === 'you_viewed' ? (
        <FlatList
          data={youViewed.isError ? [] : youViewedItems}
          keyExtractor={v => v.userId}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => { void handleManualRefresh(); }}
          ListHeaderComponent={
            youViewed.isPending || youViewed.isError || youViewedItems.length === 0 ? null : !hasPremium ? (
              <Pressable
                style={styles.premiumPromoBanner}
                onPress={() => setPremiumModalVisible(true)}
                testID="you-viewed-promo-banner"
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.crownBannerIcon}>
                    <Text style={{ fontSize: 22 }}>👀</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promoBannerTitle}>
                      {t('matches_who_i_viewed_title', 'ვინ ვნახე — Arena Black')}
                    </Text>
                    <Text style={styles.promoBannerDesc}>
                      {t('matches_who_i_viewed_sub', 'ჩართე Arena Black მონახულებული პროფილების სრულად სანახავად')}
                    </Text>
                  </View>
                  <Text style={styles.promoBannerArrow}>›</Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.premiumActiveBadge}>
                <Text style={styles.premiumActiveBadgeText}>
                  {t('matches_who_i_viewed_active', '👀 Arena Black — ყველა ნახვა სრულად ხილვადია')}
                </Text>
              </View>
            )
          }
          ListEmptyComponent={
            youViewed.isPending ? (
              <MatchListSkeleton count={4} />
            ) : (
              <StateMessage
                title={t(youViewed.isError ? 'connection_error' : 'you_viewed_empty')}
              />
            )
          }
          renderItem={({ item: viewUser }) => {
            const isLocked = !hasPremium || viewUser.isBlurred;
            if (isLocked) {
              return (
                <Card style={[styles.card, styles.lockedCard]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${viewUser.displayName}, ${viewUser.age}. ${t('matches_unlock_photo_btn', '🖤 Arena Black — გახსნა')}`}
                    onPress={() => setPremiumModalVisible(true)}
                    style={({ pressed }) => [styles.cardPressable, pressed && { opacity: 0.85 }]}
                    testID={`you-viewed-locked-${viewUser.userId}`}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.nameRow}>
                          <Text accessibilityRole="header" style={styles.nameHeading}>
                            {viewUser.displayName}, {viewUser.age}
                          </Text>
                          
                        </View>
                        <View style={styles.timeBadge}>
                          <Text style={styles.timeBadgeText}>
                            👀 {formatRelativeTime(viewUser.viewedAt, t)}
                          </Text>
                        </View>
                        <Text style={styles.blurHintText}>
                          {t('matches_enable_black_to_unlock', 'ჩართე Arena Black ფოტოს გასახსნელად და სანახავად')}
                        </Text>
                      </View>

                      <View style={styles.blurredAvatarWrapper}>
                        {viewUser.photo ? (
                          <View style={styles.blurPhotoWrapper}>
                            <PrivatePhoto photo={viewUser.photo} avatar blurRadius={25} style={styles.blurredPhotoImage} />
                            
                          </View>
                        ) : (
                          <View style={styles.avatarOvalLocked}><Text style={{ fontSize: 24, color: theme.colors.muted }}>👤</Text></View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                  <View style={styles.requestActionsRow}>
                    <Button
                      variant="primary"
                      title={t('matches_unlock_photo_btn', '🖤 Arena Black — გახსნა')}
                      onPress={() => setPremiumModalVisible(true)}
                      style={styles.premiumUnlockBtn}
                      textStyle={styles.premiumUnlockBtnText}
                      testID={`unlock-premium-you-viewed-${viewUser.userId}`}
                    />
                  </View>
                </Card>
              );
            }

            return (
              <Card style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${viewUser.displayName}, ${viewUser.age}. ${t('view_profile')}`}
                  onPress={() => setSelectedProfile({
                    mode: 'you_viewed',
                    id: viewUser.userId,
                    userId: viewUser.userId,
                    displayName: viewUser.displayName,
                    age: viewUser.age,
                    city: viewUser.city,
                    bio: viewUser.bio,
                    gender: viewUser.gender,
                    relationshipGoal: viewUser.relationshipGoal,
                    interests: viewUser.interests,
                    photo: viewUser.photo,
                    photos: viewUser.photos,
                    viewedAt: viewUser.viewedAt,
                  })}
                  style={({ pressed }) => [styles.cardPressable, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.nameRow}>
                        <Text accessibilityRole="header" style={styles.nameHeading}>
                          {viewUser.displayName}, {viewUser.age}
                        </Text>
                        <View style={styles.timeBadge}>
                          <Text style={styles.timeBadgeText}>
                            👀 {formatRelativeTime(viewUser.viewedAt, t)}
                          </Text>
                        </View>
                      </View>
                      {!!viewUser.city && <Text style={styles.subText}>📍 {formatCityName(viewUser.city, i18n.language)}</Text>}
                      {!!viewUser.bio && <Text style={styles.bioText} numberOfLines={2}>{viewUser.bio}</Text>}
                      <Text style={styles.viewBadge}>{t('view_profile')} ›</Text>
                    </View>
                    <View style={styles.cardRightGroup}>
                      <View style={styles.avatarOvalLarge}>
                        {viewUser.photo ? (
                          <PrivatePhoto photo={viewUser.photo} avatar />
                        ) : (
                          <Text style={{ fontSize: 24, color: theme.colors.muted }}>👤</Text>
                        )}
                      </View>
                      <SafetyActions
                        targetId={viewUser.userId}
                        variant="dots"
                        onDone={() => { void handleManualRefresh(); }}
                      />
                    </View>
                  </View>
                </Pressable>

                <View style={styles.swipeSuperLikeCardRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('swipe_superlike', 'სუპერ ლაიქი')}
                    testID={`card-superlike-${viewUser.userId}`}
                    onPress={() => {
                      setSuperLikeTarget({
                        id: viewUser.userId,
                        displayName: viewUser.displayName,
                        age: viewUser.age,
                        photo: viewUser.photo,
                      });
                    }}
                    style={({ pressed }) => [
                      styles.swipeSuperLikeButton,
                      pressed && styles.swipeSuperLikeButtonPressed,
                    ]}
                  >
                    <View style={styles.swipeSuperLikeStarContainer}>
                      <Text style={styles.swipeSuperLikeStarEmoji}>⭐</Text>
                    </View>
                  </Pressable>
                </View>
              </Card>
            );
          }}
        />
      ) : section === 'matches' ? (
        <FlatList
          data={matches.isError ? [] : matchItems}
          keyExtractor={m => m.id}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => { void handleManualRefresh(); }}
          ListEmptyComponent={
            matches.isPending ? (
              <MatchListSkeleton count={5} />
            ) : (
              <StateMessage
                title={t(matches.isError ? 'connection_error' : 'matches_empty')}
              />
            )
          }
          renderItem={({ item: match }) => {
            const unreadNum = Number(match.unreadCount) || 0;
            const messageSnippet = match.lastMessage
              ? formatMessageSnippet(match.lastMessage, (k, d) => t(k, d || ''))
              : t('new_match_chat_hint', 'ახალი წყვილი! დაიწყეთ საუბარი 💬');

            return (
              <Card style={styles.card}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${match.displayName}, ${match.age}. ${messageSnippet}`}
                  onPress={() => {
                    if (match.hasChatEntitlement === false) {
                      setUnlockMatchCandidate(match);
                    } else {
                      openMatchChat(match);
                    }
                  }}
                  style={({ pressed }) => [styles.cardPressable, pressed && { opacity: 0.85 }]}
                  testID={`match-card-${match.id}`}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.nameRow}>
                        <Text accessibilityRole="header" style={styles.nameHeading}>
                          {match.displayName}, {match.age}
                        </Text>
                        {match.origin === 'GameArena' && (
                          <View style={{ backgroundColor: '#f3e8ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#d8b4fe' }}>
                            <Text style={{ fontSize: 11, color: '#7e22ce', fontWeight: 'bold' }}>Arena 💋</Text>
                          </View>
                        )}
                        {unreadNum > 0 && (
                          <View style={styles.matchUnreadBadge} testID={`unread-badge-${match.id}`}>
                            <Text style={styles.matchUnreadBadgeText}>{unreadNum > 99 ? '99+' : unreadNum}</Text>
                          </View>
                        )}
                      </View>
                      {!!match.city && <Text style={styles.subText}>📍 {formatCityName(match.city, i18n.language)}</Text>}
                      <Text style={[styles.bioText, unreadNum > 0 && { color: theme.colors.text, fontWeight: '600' }]} numberOfLines={1}>
                        {messageSnippet}
                      </Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${match.displayName} ${t('view_profile')}`}
                      hitSlop={6}
                      onPress={(e) => {
                        e.stopPropagation();
                        setSelectedProfile({
                          mode: 'match',
                          id: match.id,
                          userId: match.userId,
                          conversationId: match.conversationId,
                          displayName: match.displayName,
                          age: match.age,
                          city: match.city,
                          bio: match.bio,
                          gender: match.gender,
                          relationshipGoal: match.relationshipGoal,
                          interests: match.interests,
                          photo: match.photo,
                          photos: match.photos,
                          origin: match.origin,
                        });
                      }}
                      style={styles.cardRightGroup}
                    >
                      <View style={styles.avatarWrapper}>
                        <View style={styles.avatarOval}>
                          {match.photo ? (
                            <PrivatePhoto photo={match.photo} avatar />
                          ) : (
                            <Text style={{ fontSize: 18, color: theme.colors.muted }}>👤</Text>
                          )}
                        </View>
                        {unreadNum > 0 && (
                          <View style={styles.avatarUnreadDot} testID={`avatar-unread-dot-${match.id}`} />
                        )}
                      </View>
                      <SafetyActions conversationId={match.conversationId} variant="dots" onDone={() => { void handleManualRefresh(); }} />
                    </Pressable>
                  </View>
                </Pressable>

                <View style={styles.cardFooterRow}>
                  <Button
                    title={`👤 ${t('view_profile', 'პროფილი')}`}
                    onPress={() => setSelectedProfile({
                      mode: 'match',
                      id: match.id,
                      userId: match.userId,
                      conversationId: match.conversationId,
                      displayName: match.displayName,
                      age: match.age,
                      city: match.city,
                      bio: match.bio,
                      gender: match.gender,
                      relationshipGoal: match.relationshipGoal,
                      interests: match.interests,
                      photo: match.photo,
                      photos: match.photos,
                      origin: match.origin,
                    })}
                    style={styles.matchProfileBtn}
                    textStyle={styles.matchProfileBtnText}
                  />

                  <Button
                    variant="primary"
                    title={match.hasChatEntitlement === false ? `💎 25 ${t('chat_open', 'ჩატი')}` : `💬 ${t('chat_open', 'ჩატი')}`}
                    onPress={() => {
                      if (match.hasChatEntitlement === false) {
                        setUnlockMatchCandidate(match);
                      } else {
                        openMatchChat(match);
                      }
                    }}
                    style={styles.openChatBtn}
                    textStyle={styles.openChatBtnText}
                    testID={`open-chat-${match.id}`}
                  />
                </View>
              </Card>
            );
          }}
          ListFooterComponent={
            matches.hasNextPage ? (
              <View style={{ gap: 12 }}>
                <Button
                  title={t('discovery_more')}
                  disabled={matches.isFetchingNextPage}
                  onPress={() => { void matches.fetchNextPage(); }}
                />
              </View>
            ) : null
          }
        />
      ) : (
        <FlatList
          data={requests.isError ? [] : requestItems}
          keyExtractor={r => r.userId}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={() => { void handleManualRefresh(); }}
          ListEmptyComponent={
            requests.isPending ? (
              <MatchListSkeleton count={4} />
            ) : lockedGameMatches.length > 0 ? (
              <View style={{ gap: 12 }}>
                <View style={{ padding: 14, backgroundColor: '#fdf2f8', borderRadius: 14, borderWidth: 1, borderColor: '#fbcfe8' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontWeight: 'bold', color: '#db2777', fontSize: 14 }}>
                      💋 ბოთლის თამაში: {lockedGameMatches.length} ახალი მეჩი
                    </Text>
                    <Pressable hitSlop={6} onPress={() => setSection('matches')}>
                      <Text style={{ color: '#db2777', fontWeight: 'bold', fontSize: 12 }}>
                        წყვილებში გადასვლა ›
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={{ fontSize: 12, color: '#9d174d', marginBottom: 10 }}>
                    ერთმანეთს კოცნა გაუგზავნეთ! ჩატის გასახსნელად საჭიროა 25 კრისტალი.
                  </Text>
                  {lockedGameMatches.map(lm => (
                    <View key={lm.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderColor: '#fce7f3' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#831843', fontWeight: 'bold', fontSize: 14 }}>
                          {lm.displayName}, {lm.age}
                        </Text>
                        {!!lm.city && <Text style={{ color: '#9d174d', fontSize: 12 }}>📍 {formatCityName(lm.city, i18n.language)}</Text>}
                      </View>
                      <Button
                        variant="primary"
                        title="💎 25 ჩატი"
                        onPress={() => setUnlockMatchCandidate(lm)}
                        style={{ paddingVertical: 6, paddingHorizontal: 12, minHeight: 32 }}
                        textStyle={{ fontSize: 13, fontWeight: 'bold' }}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <StateMessage
                title={t(requests.isError ? 'connection_error' : 'requests_empty')}
              />
            )
          }
          ListHeaderComponent={
            <View>
              {lockedGameMatches.length > 0 && requestItems.length > 0 && (
                <View style={{ marginBottom: 12, padding: 12, backgroundColor: '#fdf2f8', borderRadius: 12, borderWidth: 1, borderColor: '#fbcfe8' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontWeight: 'bold', color: '#db2777', fontSize: 13 }}>
                      💋 ბოთლის თამაში: {lockedGameMatches.length} ახალი მეჩი
                    </Text>
                    <Pressable hitSlop={6} onPress={() => setSection('matches')}>
                      <Text style={{ color: '#db2777', fontWeight: 'bold', fontSize: 12 }}>
                        წყვილებში გადასვლა ›
                      </Text>
                    </Pressable>
                  </View>
                  {lockedGameMatches.map(lm => (
                    <View key={lm.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderColor: '#fce7f3' }}>
                      <Text style={{ color: '#831843', fontWeight: '600', fontSize: 13 }}>
                        {lm.displayName}, {lm.age}
                      </Text>
                      <Button
                        variant="primary"
                        title="💎 25 ჩატი"
                        onPress={() => setUnlockMatchCandidate(lm)}
                        style={{ paddingVertical: 4, paddingHorizontal: 10, minHeight: 28 }}
                        textStyle={{ fontSize: 12, fontWeight: 'bold' }}
                      />
                    </View>
                  ))}
                </View>
              )}
              {requests.isPending || requests.isError || requestItems.length === 0 ? null : !hasPremium ? (
                <Pressable
                  style={styles.premiumPromoBanner}
                  onPress={() => setPremiumModalVisible(true)}
                  testID="premium-promo-banner"
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.crownBannerIcon}>
                      <Text style={{ fontSize: 22 }}>🖤</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.promoBannerTitle}>
                        {t('matches_promo_banner_title', 'გაიგე ვინ დაგამეჩა — Arena Black')}
                      </Text>
                      <Text style={styles.promoBannerDesc}>
                        {t('matches_promo_banner_sub', 'ჩართე Arena Black და ნახე ყველა შემომავალი მოწონება')}
                      </Text>
                    </View>
                    <Text style={styles.promoBannerArrow}>›</Text>
                  </View>
                </Pressable>
              ) : (
                <View style={styles.premiumActiveBadge}>
                  <Text style={styles.premiumActiveBadgeText}>
                    {t('matches_vip_badge_banner', '🖤 Arena Black წევრი — ყველა რექუესტი ხილვადია')}
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item: req }) => {
            const isLocked = (req.isBlurred || !hasPremium) && req.origin !== 'GameArena';
            if (isLocked) {
              return (
                <Card style={[styles.card, styles.lockedCard]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${req.displayName}, ${req.age}. ${t('matches_unlock_photo_btn', '🖤 Arena Black — ფოტოს გახსნა')}`}
                    onPress={() => setPremiumModalVisible(true)}
                    style={({ pressed }) => [styles.cardPressable, pressed && { opacity: 0.85 }]}
                    testID={`request-locked-${req.userId}`}
                  >
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <View style={styles.nameRow}>
                          <Text accessibilityRole="header" style={styles.nameHeading}>
                            {req.displayName}, {req.age}
                          </Text>
                          
                        </View>
                        <Text style={styles.subText}>
                          {req.origin === 'SuperLike'
                            ? t('matches_sent_superlike', '⭐ გამოგიგზავნათ სუპერ ლაიქი!')
                            : t('matches_sent_like', 'მოგცათ მოწონება!')}
                        </Text>
                        <Text style={styles.blurHintText}>
                          {t('matches_enable_black_to_unlock', 'ჩართე Arena Black ფოტოს გასახსნელად და სასაუბროდ')}
                        </Text>
                      </View>

                      {/* Blurred Photo with Lock Icon */}
                      <View style={styles.blurredAvatarWrapper}>
                        {req.photo ? (
                          <View style={styles.blurPhotoWrapper}>
                            <PrivatePhoto photo={req.photo} avatar blurRadius={25} style={styles.blurredPhotoImage} />
                            
                          </View>
                        ) : (
                          <View style={styles.avatarOvalLocked}><Text style={{ fontSize: 24, color: theme.colors.muted }}>👤</Text></View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                  <View style={styles.requestActionsRow}>
                    <Button
                      variant="primary"
                      title={t('matches_unlock_photo_btn', '🖤 Arena Black — ფოტოს გახსნა')}
                      onPress={() => setPremiumModalVisible(true)}
                      style={styles.premiumUnlockBtn}
                      textStyle={styles.premiumUnlockBtnText}
                      testID={`unlock-premium-btn-${req.userId}`}
                    />
                  </View>
                </Card>
              );
            }

            return (
              <Card style={[styles.card, req.origin === 'SuperLike' && styles.superLikeCard]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${req.displayName}, ${req.age}. ${t('view_profile')}`}
                  onPress={() => setSelectedProfile({
                    mode: 'request',
                    id: req.userId,
                    userId: req.userId,
                    displayName: req.displayName,
                    age: req.age,
                    city: req.city,
                    bio: req.bio,
                    gender: req.gender,
                    relationshipGoal: req.relationshipGoal,
                    interests: req.interests,
                    photo: req.photo,
                    photos: req.photos,
                    origin: req.origin,
                    note: req.note,
                  })}
                  style={({ pressed }) => [styles.cardPressable, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={styles.nameRow}>
                        <Text accessibilityRole="header" style={styles.nameHeading}>
                          {req.displayName}, {req.age}
                        </Text>
                        {req.origin === 'SuperLike' && (
                          <View style={styles.superLikeBadge}>
                            <Text style={styles.superLikeBadgeText}>
                              {t('matches_superlike_badge', '⭐ სუპერ ლაიქი')}
                            </Text>
                          </View>
                        )}
                        {req.origin === 'GameArena' && (
                          <View style={{ backgroundColor: '#fdf2f8', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#fbcfe8' }}>
                            <Text style={{ fontSize: 11, color: '#db2777', fontWeight: 'bold' }}>
                              {req.note || t('matches_bottle_kiss_note', '💋 დავიმეჩე ბოთლის თამაშში')}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.viewBadge}>{t('view_profile')} ›</Text>
                      </View>
                      {req.origin === 'SuperLike' && !!req.note && (
                        <View style={styles.superLikeNoteCard}>
                          <Text style={styles.superLikeNoteQuote} numberOfLines={3}>
                            💬 "{req.note}"
                          </Text>
                        </View>
                      )}
                      {!!req.city && <Text style={styles.subText}>📍 {formatCityName(req.city, i18n.language)}</Text>}
                      {!!req.bio && <Text style={styles.bioText} numberOfLines={2}>{req.bio}</Text>}
                    </View>
                    <View style={styles.avatarOvalLarge}>
                      {req.photo ? (
                        <PrivatePhoto photo={req.photo} avatar />
                      ) : (
                        <Text style={{ fontSize: 24, color: theme.colors.muted }}>👤</Text>
                      )}
                    </View>
                  </View>
                </Pressable>
                <View style={styles.requestActionsRow}>
                  <Button
                    title={`✕ ${t('request_decline')}`}
                    disabled={actionBusy === req.userId}
                    onPress={() => { void handleDecision(req.userId, 'pass'); }}
                    style={styles.declineBtn}
                    textStyle={styles.declineBtnText}
                  />
                  <Button
                    variant="primary"
                    title={`❤️ ${t('request_confirm')}`}
                    disabled={actionBusy === req.userId}
                    onPress={() => { void handleDecision(req.userId, 'like'); }}
                    style={styles.confirmBtn}
                  />
                </View>
              </Card>
            );
          }}
          ListFooterComponent={null}
        />
      )}

      {/* Candidate Full Profile Modal (Viewed You, You Viewed, Matches & Requests) */}
      <Modal
        visible={!!selectedProfile}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedProfile(null)}
      >
        {selectedProfile && (
          <View style={[styles.modalContainer, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('close')}
                onPress={() => setSelectedProfile(null)}
                hitSlop={12}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </Pressable>
              <Text accessibilityRole="header" style={styles.modalHeaderText} numberOfLines={1}>
                {selectedProfile.displayName}, {selectedProfile.age}
              </Text>
              {selectedProfile.mode === 'match' ? (
                <SafetyActions
                  conversationId={selectedProfile.conversationId}
                  variant="dots"
                  onDone={action => {
                    if (action === 'block' || action === 'unmatch') {
                      setSelectedProfile(null);
                      void handleManualRefresh();
                    }
                  }}
                />
              ) : (
                <SafetyActions
                  targetId={selectedProfile.userId ?? undefined}
                  variant="dots"
                  onDone={action => {
                    if (action === 'block') {
                      setSelectedProfile(null);
                      void handleManualRefresh();
                    }
                  }}
                />
              )}
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollBody} showsVerticalScrollIndicator={false}>
              {/* Photo(s) */}
              {(() => {
                const profilePhotos = selectedProfile.photos && selectedProfile.photos.length > 0
                  ? selectedProfile.photos
                  : selectedProfile.photo
                  ? [selectedProfile.photo]
                  : [];
                if (profilePhotos.length > 0) {
                  return (
                    <View style={styles.photosWrapper}>
                      {profilePhotos.map((p, idx) => (
                        <Pressable
                          key={p.id}
                          onPress={() => {
                            setViewPhotos(profilePhotos);
                            setPhotoIndex(idx);
                          }}
                          style={styles.photoContainer}
                        >
                          <PrivatePhoto photo={p} />
                        </Pressable>
                      ))}
                    </View>
                  );
                }
                return (
                  <View style={styles.modalNoPhoto}>
                    <Text style={{ fontSize: 64 }}>👤</Text>
                  </View>
                );
              })()}

              {/* Profile Details Card */}
              <View style={styles.modalDetailsCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.modalMainName}>
                    {selectedProfile.displayName}, {selectedProfile.age}
                  </Text>
                  {!!selectedProfile.viewedAt && (
                    <Text style={styles.modalTimeText}>
                      {formatRelativeTime(selectedProfile.viewedAt, t)}
                    </Text>
                  )}
                </View>

                {selectedProfile.origin === 'SuperLike' && (
                  <View style={styles.modalSuperLikeContainer}>
                    <View style={styles.superLikeBadge}>
                      <Text style={styles.superLikeBadgeText}>
                        {t('matches_superlike_badge', '⭐ სუპერ ლაიქი')}
                      </Text>
                    </View>
                    {!!selectedProfile.note && (
                      <View style={styles.modalSuperLikeNoteBox}>
                        <Text style={styles.modalSuperLikeNoteLabel}>
                          {t('matches_superlike_message_label', 'მესიჯი სუპერ ლაიქით:')}
                        </Text>
                        <Text style={styles.modalSuperLikeNoteText}>"{selectedProfile.note}"</Text>
                      </View>
                    )}
                  </View>
                )}
                {selectedProfile.origin === 'GameArena' && (
                  <View style={{ backgroundColor: '#fdf2f8', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#fbcfe8', alignSelf: 'flex-start', marginTop: 4, marginBottom: 4 }}>
                    <Text style={{ fontSize: 12, color: '#db2777', fontWeight: 'bold' }}>
                      {selectedProfile.note || t('matches_bottle_kiss_note', '💋 დავიმეჩე ბოთლის თამაშში')}
                    </Text>
                  </View>
                )}
                {!!selectedProfile.city && (
                  <Text style={styles.modalCityText}>📍 {formatCityName(selectedProfile.city, i18n.language)}</Text>
                )}

                {/* Badges for Gender & Goal */}
                <View style={styles.badgeRow}>
                  {!!selectedProfile.gender && (
                    <View style={styles.detailBadge}>
                      <Text style={styles.detailBadgeText}>
                        {CHOICE_EMOJIS[selectedProfile.gender] ? `${CHOICE_EMOJIS[selectedProfile.gender]} ` : ''}{t(`choice_${selectedProfile.gender}`, selectedProfile.gender)}
                      </Text>
                    </View>
                  )}
                  {!!selectedProfile.relationshipGoal && (
                    <View style={[styles.detailBadge, styles.goalBadge]}>
                      <Text style={[styles.detailBadgeText, styles.goalBadgeText]}>
                        {CHOICE_EMOJIS[selectedProfile.relationshipGoal] ? `${CHOICE_EMOJIS[selectedProfile.relationshipGoal]} ` : '🎯 '}{t(`choice_${selectedProfile.relationshipGoal}`, selectedProfile.relationshipGoal)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Bio */}
                {!!selectedProfile.bio && (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionLabel}>{t('section_about')}</Text>
                    <Text style={styles.modalBioText}>{selectedProfile.bio}</Text>
                  </View>
                )}

                {/* Interests */}
                {selectedProfile.interests && selectedProfile.interests.length > 0 && (
                  <View style={styles.sectionBlock}>
                    <Text style={styles.sectionLabel}>{t('profile_interests')}</Text>
                    <View style={styles.chipsRow}>
                      {selectedProfile.interests.map((interest, i) => (
                        <View key={i} style={styles.interestChip}>
                          <Text style={styles.interestChipText}>
                            {CHOICE_EMOJIS[interest] ? `${CHOICE_EMOJIS[interest]} ` : '✨ '}{t(`choice_${interest}`, interest)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Bottom Fixed Action Bar */}
            {selectedProfile.mode === 'match' ? (
              <View style={styles.modalActionBar}>
                <Button
                  variant="primary"
                  title={`💬 ${t('chat_open')}`}
                  onPress={() => {
                    const convId = selectedProfile.conversationId;
                    const peerName = selectedProfile.displayName;
                    if (convId) {
                      markConversationReadLocally(convId);
                    }
                    setSelectedProfile(null);
                    if (convId) {
                      router.push({
                        pathname: '/chat/[id]',
                        params: { id: convId, name: peerName },
                      });
                    }
                  }}
                  style={styles.modalChatBtn}
                />
              </View>
            ) : selectedProfile.mode === 'request' ? (
              <View style={styles.modalActionBar}>
                <Button
                  title={`✕ ${t('request_decline')}`}
                  disabled={actionBusy === selectedProfile.userId}
                  onPress={() => {
                    const uid = selectedProfile.userId!;
                    setSelectedProfile(null);
                    void handleDecision(uid, 'pass');
                  }}
                  style={styles.declineBtn}
                  textStyle={styles.declineBtnText}
                />
                <Button
                  variant="primary"
                  title={`❤️ ${t('request_confirm')}`}
                  disabled={actionBusy === selectedProfile.userId}
                  onPress={() => {
                    const uid = selectedProfile.userId!;
                    setSelectedProfile(null);
                    void handleDecision(uid, 'like');
                  }}
                  style={styles.confirmBtn}
                />
              </View>
            ) : selectedProfile.mode === 'you_viewed' || selectedProfile.mode === 'view' ? (
              <View style={[styles.modalActionBar, { justifyContent: 'center' }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('swipe_superlike', 'სუპერ ლაიქი')}
                  testID={selectedProfile.mode === 'you_viewed' ? 'you-viewed-modal-superlike-btn' : 'viewed-you-modal-superlike-btn'}
                  onPress={() => {
                    setSuperLikeTarget({
                      id: selectedProfile.userId!,
                      displayName: selectedProfile.displayName,
                      age: selectedProfile.age,
                      photo: selectedProfile.photo,
                    });
                  }}
                  style={({ pressed }) => [
                    styles.swipeSuperLikeButton,
                    pressed && styles.swipeSuperLikeButtonPressed,
                  ]}
                >
                  <View style={styles.swipeSuperLikeStarContainer}>
                    <Text style={styles.swipeSuperLikeStarEmoji}>⭐</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={styles.modalActionBar}>
                <Button
                  title={`✕ ${t('swipe_pass')}`}
                  disabled={actionBusy === selectedProfile.id}
                  onPress={async () => {
                    if (selectedProfile.userId) {
                      await handleDecision(selectedProfile.userId, 'pass');
                    }
                    setSelectedProfile(null);
                  }}
                  style={styles.declineBtn}
                  textStyle={styles.declineBtnText}
                />
                <Button
                  variant="primary"
                  title={`❤️ ${t('swipe_like')}`}
                  disabled={actionBusy === selectedProfile.id}
                  onPress={async () => {
                    if (selectedProfile.userId) {
                      await handleDecision(selectedProfile.userId, 'like');
                    }
                    setSelectedProfile(null);
                  }}
                  style={styles.confirmBtn}
                />
              </View>
            )}
          </View>
        )}
      </Modal>

      {/* Super Like Modal for You Viewed */}
      <SuperLikeModal
        visible={!!superLikeTarget}
        targetUser={superLikeTarget}
        userBalance={userBalance}
        isSending={superLikeSending}
        onClose={() => setSuperLikeTarget(null)}
        onConfirm={handleSuperLikeConfirm}
        onTopUpCrystals={() => {
          setSuperLikeTarget(null);
          router.push('/(tabs)/game');
        }}
      />

      {/* Fullscreen Photo Viewer Modal */}
      {!!viewPhotos && (
        <PhotoViewerModal
          photos={viewPhotos}
          initialIndex={photoIndex}
          visible={true}
          onClose={() => setViewPhotos(null)}
        />
      )}

      {/* Unlock Match Conversation Modal */}
      <Modal
        visible={!!unlockMatchCandidate}
        animationType="fade"
        transparent
        onRequestClose={() => setUnlockMatchCandidate(null)}
      >
        <View style={styles.unlockModalOverlay}>
          <Card style={styles.unlockModalContent}>
            <Text style={styles.unlockModalTitle}>
              {t('matches_unlock_chat_modal_title', '💎 ჩატის გახსნა')}
            </Text>
            <Text style={styles.unlockModalBody}>
              {t('matches_unlock_chat_modal_desc', {
                name: unlockMatchCandidate?.displayName,
                defaultValue: `${unlockMatchCandidate?.displayName}-თან ჩატისა და სრული პროფილის გახსნა ღირს 25 კრისტალი.`,
              })}
              {'\n\n'}
              {t('matches_unlock_chat_modal_sub', 'გახსნა მოქმედებს ორივე მონაწილისთვის და თითო მესიჯზე დამატებითი გადასახადი აღარ იქნება.')}
            </Text>
            {unlockError ? (
              <Text style={styles.unlockErrorText}>{unlockError}</Text>
            ) : null}
            <View style={styles.unlockActionsRow}>
              <Button
                variant="secondary"
                title={t('cancel')}
                disabled={unlocking}
                onPress={() => {
                  setUnlockMatchCandidate(null);
                  setUnlockError(null);
                }}
              />
              <Button
                variant="primary"
                title={t('matches_unlock_chat_confirm_btn', 'გახსნა (💎 25)')}
                busy={unlocking}
                onPress={async () => {
                  if (!unlockMatchCandidate) return;
                  setUnlocking(true);
                  setUnlockError(null);
                  try {
                    const res = await api.unlock(unlockMatchCandidate.id, Crypto.randomUUID());
                    const convId = res.conversationId;
                    const peerName = unlockMatchCandidate.displayName;
                    markConversationReadLocally(convId);
                    await cache.invalidateQueries({ queryKey: matchesKey });
                    setUnlockMatchCandidate(null);
                    router.push({
                      pathname: '/chat/[id]',
                      params: { id: convId, name: peerName },
                    });
                  } catch (err: unknown) {
                    const e = err as { code?: string; message?: string; status?: number };
                    if (e.status === 400 && (e.message?.includes('insufficient') || e.code === 'insufficient_crystals')) {
                      setUnlockError(t('matches_insufficient_crystals', 'არასაკმარისი კრისტალები (საჭიროა 25 💎).'));
                    } else {
                      setUnlockError(t('matches_chat_unlock_failed', 'ჩატის გახსნა ვერ მოხერხდა.'));
                    }
                  } finally {
                    setUnlocking(false);
                  }
                }}
              />
            </View>
          </Card>
        </View>
      </Modal>
      <PremiumModal
        visible={premiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
        onSuccess={() => void handleManualRefresh()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gridTile: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTileActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  gridTileText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.muted,
    textAlign: 'center',
  },
  gridTileTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    gap: 10,
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardPressable: {
    width: '100%',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardRightGroup: {
    alignItems: 'center',
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  nameHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  viewBadge: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  subText: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  bioText: {
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 18,
    marginTop: 2,
  },
  timeBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  timeBadgeText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  avatarOval: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: theme.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  avatarOvalLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: theme.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  gridTileContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  unreadRedDot: {
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
    shadowRadius: 3,
    elevation: 4,
  },
  unreadRedDotText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
    textAlign: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarUnreadDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: theme.colors.surface,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 4,
  },
  matchUnreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.7,
    shadowRadius: 3,
    elevation: 3,
  },
  matchUnreadBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  matchProfileBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  matchProfileBtnText: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  openChatBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  openChatBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  requestActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    borderRadius: 10,
  },
  declineBtnText: {
    color: '#f87171',
    fontWeight: 'bold',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: theme.colors.match,
    paddingVertical: 10,
    borderRadius: 10,
  },
  iconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  iconBtnText: {
    fontSize: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseIcon: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  modalHeaderText: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  modalScrollBody: {
    paddingBottom: 24,
  },
  photosWrapper: {
    width: '100%',
    gap: 12,
    padding: 16,
  },
  photoContainer: {
    width: '100%',
    height: 380,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  modalNoPhoto: {
    width: '100%',
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  modalDetailsCard: {
    paddingHorizontal: 20,
    gap: 12,
  },
  modalMainName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalTimeText: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  modalCityText: {
    fontSize: 14,
    color: theme.colors.muted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  detailBadge: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  detailBadgeText: {
    fontSize: 13,
    color: theme.colors.text,
  },
  goalBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  goalBadgeText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  sectionBlock: {
    gap: 6,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalBioText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.text,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  interestChipText: {
    fontSize: 13,
    color: theme.colors.text,
  },
  modalActionBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  modalChatBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
  },
  unlockModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  unlockModalContent: {
    width: '100%',
    padding: 24,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  unlockModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
  },
  unlockModalBody: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
    textAlign: 'center',
  },
  unlockErrorText: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
  },
  unlockActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    justifyContent: 'center',
  },
  lockedCard: {
    borderColor: '#78350f',
    backgroundColor: '#1c1528',
  },
  lockedHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fbbf24',
  },
  lockedBadge: {
    backgroundColor: '#b45309',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  lockedSubText: {
    fontSize: 12,
    color: '#d4d4d8',
    marginTop: 2,
    lineHeight: 16,
  },
  avatarOvalLocked: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumUnlockBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    paddingVertical: 10,
  },
  premiumUnlockBtnText: {
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 14,
  },
  premiumPromoBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  crownBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoBannerTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  promoBannerDesc: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  promoBannerArrow: {
    fontSize: 22,
    color: '#94A3B8',
    fontWeight: 'bold',
  },
  premiumActiveBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  premiumActiveBadgeText: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
  },
  superLikeCard: {
    borderColor: '#0284C7',
    borderWidth: 1.5,
    backgroundColor: 'rgba(2, 132, 199, 0.05)',
  },
  superLikeBadge: {
    backgroundColor: '#0369A1',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  superLikeBadgeText: {
    fontSize: 11,
    color: '#F0F9FF',
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  superLikeNoteCard: {
    backgroundColor: 'rgba(2, 132, 199, 0.12)',
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  superLikeNoteQuote: {
    fontSize: 13,
    color: '#E0F2FE',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  modalSuperLikeContainer: {
    alignSelf: 'flex-start',
    marginTop: 4,
    marginBottom: 8,
    gap: 6,
    width: '100%',
  },
  modalSuperLikeNoteBox: {
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderRadius: 12,
    padding: 12,
    width: '100%',
  },
  modalSuperLikeNoteLabel: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalSuperLikeNoteText: {
    fontSize: 14,
    color: '#F0F9FF',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  gateScrollContent: {
    padding: 16,
    paddingTop: 24,
    alignItems: 'center',
  },
  gateCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  gateIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  gateIconEmoji: {
    fontSize: 34,
  },
  gateLockBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateLockEmoji: {
    fontSize: 13,
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 8,
  },
  gateSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  gateBenefitsList: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  gateBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gateBenefitCheck: {
    fontSize: 15,
    fontWeight: '900',
    color: '#38BDF8',
  },
  gateBenefitText: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '600',
    flex: 1,
  },
  gateActionBtn: {
    width: '100%',
    backgroundColor: '#0284C7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  blurTagBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  blurTagBadgeText: {
    fontSize: 11,
    color: '#FBBF24',
    fontWeight: '700',
  },
  blurHintText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  blurredAvatarWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  blurPhotoWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  blurredPhotoImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  blurGlassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blurLockIcon: {
    fontSize: 20,
  },
  swipeSuperLikeCardRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  swipeSuperLikeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(8, 20, 44, 0.95)',
    borderWidth: 2.5,
    borderColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 8,
  },
  swipeSuperLikeButtonPressed: {
    transform: [{ scale: 0.92 }],
    borderColor: '#7DF9FF',
    backgroundColor: '#0F326A',
  },
  swipeSuperLikeStarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeSuperLikeStarEmoji: {
    fontSize: 26,
    lineHeight: 30,
    textAlign: 'center',
  },
  superLikeFeedbackBanner: {
    backgroundColor: '#d97706',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  superLikeFeedbackText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
