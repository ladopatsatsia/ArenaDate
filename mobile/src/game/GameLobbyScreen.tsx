import React, { useEffect, useMemo, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { GameApi, type GameRoomSummary, type GameMember } from './GameApi';
import { theme } from '../components/theme';
import { Text, Card, Button, TextInput, GameLobbySkeleton } from '../components/UI';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import type { Photo } from '../profile/api';
import { GameTable } from './GameTable';
import { getTelegramWebApp } from '../telegram/telegramSdk';
import { Screen } from '../components/Screen';
import { WalletModal } from '../components/WalletModal';

function extractErrorCode(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const record = err as Record<string, unknown>;
    const response = record.response as Record<string, unknown> | undefined;
    if (typeof response?.code === 'string') return response.code;
    if (typeof record.message === 'string') return record.message;
  }
  return fallback;
}

const TABLE_MODES = [
  {
    capacity: 6,
    icon: '⚡',
    titleKey: 'game_mode_6_title',
    titleFallback: '6 მოთამაშე',
    tagKey: 'game_mode_6_tag',
    tagFallback: 'სწრაფი',
    quotaKey: 'game_mode_6_quota',
    quotaFallback: '3 ♀ + 3 ♂ ბალანსი',
    testId: 'queue-btn-6',
    iconBg: 'rgba(139, 92, 246, 0.15)',
  },
  {
    capacity: 8,
    icon: '🎯',
    titleKey: 'game_mode_8_title',
    titleFallback: '8 მოთამაშე',
    tagKey: 'game_mode_8_tag',
    tagFallback: 'კლასიკური',
    quotaKey: 'game_mode_8_quota',
    quotaFallback: '4 ♀ + 4 ♂ ბალანსი',
    testId: 'queue-btn-8',
    iconBg: 'rgba(251, 113, 133, 0.15)',
  },
  {
    capacity: 10,
    icon: '👑',
    titleKey: 'game_mode_10_title',
    titleFallback: '10 მოთამაშე',
    tagKey: 'game_mode_10_tag',
    tagFallback: 'დიდი არენა',
    quotaKey: 'game_mode_10_quota',
    quotaFallback: '5 ♀ + 5 ♂ ბალანსი',
    testId: 'queue-btn-10',
    iconBg: 'rgba(245, 158, 11, 0.15)',
  },
] as const;

export function GameLobbyScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { api: auth, manager, state: authState } = useAuth();
  const cache = useQueryClient();
  const gameApi = useMemo(() => new GameApi(auth, manager), [auth, manager]);
  const currentUserId = authState.account?.id;

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [createCapacity, setCreateCapacity] = useState<number>(10);
  const [createPassword, setCreatePassword] = useState('');
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedRoomForPassword, setSelectedRoomForPassword] = useState<GameRoomSummary | null>(null);
  const [enteredPassword, setEnteredPassword] = useState('');
  const [walletModalVisible, setWalletModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const walletQuery = useQuery({
    queryKey: ['game-wallet'],
    queryFn: async () => {
      try {
        const res = await gameApi.getWallet();
        return res ?? { balance: 0, outstandingDebt: 0 };
      } catch {
        return { balance: 0, outstandingDebt: 0 };
      }
    },
    refetchInterval: 10000,
  });
  const crystalBalance = walletQuery.data?.balance ?? 0;

  // Poll current user's active room / queue membership
  const currentQuery = useQuery({
    queryKey: ['game', 'current'],
    queryFn: () => gameApi.getCurrentRoom(),
    refetchInterval: 3000,
  });

  // Keep activeRoomId in sync with currentQuery
  useEffect(() => {
    if (currentQuery.data) {
      setActiveRoomId(currentQuery.data.id);
    } else if (!currentQuery.data && !currentQuery.isLoading) {
      setActiveRoomId(null);
    }
  }, [currentQuery.data, currentQuery.isLoading]);

  // Periodic heartbeat while in room (keeps membership active and refreshes LastHeartbeatUtc)
  useEffect(() => {
    if (!activeRoomId) return;

    // Send immediate heartbeat on room active
    if (typeof gameApi.heartbeat === 'function') {
      gameApi.heartbeat(activeRoomId).catch(() => {});
    }

    const interval = setInterval(() => {
      if (typeof gameApi.heartbeat === 'function') {
        gameApi.heartbeat(activeRoomId).catch(() => {});
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [activeRoomId, gameApi]);

  // Leave lobby immediately if user closes window/tab or navigates away on web
  useEffect(() => {
    if (!activeRoomId || Platform.OS !== 'web') return;

    const handleUnload = () => {
      try {
        gameApi.leaveRoom(activeRoomId).catch(() => {});
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [activeRoomId, gameApi]);

  // Handle hardware back button on Android (or Telegram WebApp BackButton) to leave the waiting room
  useEffect(() => {
    if (!activeRoomId) return;
    if (Platform.OS === 'web') {
      const tg = getTelegramWebApp();
      if (tg?.BackButton) {
        tg.BackButton.show();
        const handler = () => leaveMutation.mutate(activeRoomId);
        tg.BackButton.onClick(handler);
        return () => {
          tg.BackButton.offClick(handler);
          tg.BackButton.hide();
        };
      }
      return;
    }
    const onBackPress = () => {
      leaveMutation.mutate(activeRoomId);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [activeRoomId]);

  // Poll room list (only open Lobby rooms)
  const roomsQuery = useQuery({
    queryKey: ['game', 'rooms'],
    queryFn: () => gameApi.listRooms(),
    refetchInterval: 5000,
    enabled: !activeRoomId,
  });

  // Query active room detail if in a room
  const activeRoomQuery = useQuery({
    queryKey: ['game', 'room', activeRoomId],
    queryFn: () => (activeRoomId ? gameApi.getRoom(activeRoomId) : null),
    enabled: !!activeRoomId,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (activeRoomQuery.data) {
      if (!activeRoomQuery.data.isJoined) {
        setActiveRoomId(null);
      }
    }
  }, [activeRoomQuery.data]);

  const queueMutation = useMutation({
    mutationFn: (capacity: number) => gameApi.joinQueue(capacity),
    onSuccess: (room) => {
      setErrorMessage(null);
      setActiveRoomId(room.id);
      cache.invalidateQueries({ queryKey: ['game', 'current'] });
      cache.invalidateQueries({ queryKey: ['game', 'room', room.id] });
    },
    onError: (err: unknown) => {
      const code = extractErrorCode(err, 'queue_failed');
      setErrorMessage(mapErrorCode(code));
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: { title?: string; capacity: number; password?: string }) =>
      gameApi.createRoom({
        title: data.title,
        capacity: data.capacity,
        password: data.password,
      }),
    onSuccess: (room) => {
      setCreateModalVisible(false);
      setCustomTitle('');
      setCreatePassword('');
      setErrorMessage(null);
      setActiveRoomId(room.id);
      cache.invalidateQueries({ queryKey: ['game', 'rooms'] });
      cache.invalidateQueries({ queryKey: ['game', 'current'] });
      cache.invalidateQueries({ queryKey: ['game', 'room', room.id] });
      cache.invalidateQueries({ queryKey: ['game-wallet'] });
    },
    onError: (err: unknown) => {
      const code = extractErrorCode(err, 'create_failed');
      setErrorMessage(mapErrorCode(code));
    },
  });

  const joinMutation = useMutation({
    mutationFn: ({ roomId, password }: { roomId: string; password?: string }) =>
      gameApi.joinRoom(roomId, password ? { password } : undefined),
    onSuccess: (_, variables) => {
      setPasswordModalVisible(false);
      setSelectedRoomForPassword(null);
      setEnteredPassword('');
      setErrorMessage(null);
      setActiveRoomId(variables.roomId);
      cache.invalidateQueries({ queryKey: ['game', 'rooms'] });
      cache.invalidateQueries({ queryKey: ['game', 'current'] });
      cache.invalidateQueries({ queryKey: ['game', 'room', variables.roomId] });
    },
    onError: (err: unknown) => {
      const code = extractErrorCode(err, 'join_failed');
      setErrorMessage(mapErrorCode(code));
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (roomId: string) => gameApi.leaveRoom(roomId),
    onMutate: async (roomId) => {
      setActiveRoomId(null);
      cache.setQueryData(['game', 'current'], null);
      cache.removeQueries({ queryKey: ['game', 'room', roomId] });
      cache.removeQueries({ queryKey: ['game', 'snapshot', roomId] });
    },
    onSuccess: () => {
      setErrorMessage(null);
      setActiveRoomId(null);
      cache.setQueryData(['game', 'current'], null);
      cache.invalidateQueries({ queryKey: ['game', 'rooms'] });
      cache.invalidateQueries({ queryKey: ['game', 'current'] });
    },
    onError: (err: unknown) => {
      const code = extractErrorCode(err, 'leave_failed');
      setErrorMessage(mapErrorCode(code));
      cache.invalidateQueries({ queryKey: ['game', 'current'] });
    },
  });


  function mapErrorCode(code: string): string {
    switch (code) {
      case 'female_quota_full':
        return t('game_err_female_quota_full', 'ქალების ადგილები შევსებულია ამ მაგიდაზე.');
      case 'male_quota_full':
        return t('game_err_male_quota_full', 'კაცების ადგილები შევსებულია ამ მაგიდაზე.');
      case 'room_full':
        return t('game_err_table_full', 'მაგიდა სავსეა.');
      case 'room_unavailable':
      case 'room_not_found':
        return t('game_err_table_unavailable', 'მაგიდა მიუწვდომელია (უსაფრთხოების შეზღუდვა ან დახურული ოთახი).');
      case 'active_membership_exists':
        return t('game_err_already_in_table', 'თქვენ უკვე იმყოფებით სხვა აქტიურ მაგიდაზე ან ძიებაში.');
      case 'profile_incomplete':
        return t('game_err_complete_profile_required', 'თამაშში შესასვლელად საჭიროა შევსებული პროფილი.');
      case 'photo_required':
        return t('game_err_verified_photo_required', 'თამაშში შესასვლელად საჭიროა დადასტურებული ფოტო.');
      case 'ineligible_preferences':
        return t('game_err_mutual_preference_required', 'ამ ფორმატისთვის საჭიროა ორმხრივი პრეფერენცია (ქალი ↔ კაცი).');
      case 'insufficient_crystals':
        return t('game_insufficient_crystals_create', 'მაგიდის შესაქმნელად საჭიროა 25 კრისტალი.');
      case 'invalid_room_password':
        return t('game_room_password_incorrect', 'პაროლი არასწორია');
      default:
        return t('game_err_generic', 'მოქმედება ვერ შესრულდა. სცადეთ მოგვიანებით.');
    }
  }

  const activeRoom = activeRoomQuery.data || currentQuery.data;

  // Active Room / Matchmaking Queue View
  if (activeRoomId && activeRoom) {
    const room = activeRoom;
    const femaleMembers = room.members.filter(m => m.gender === 'woman');
    const isPlaying = room.state === 'Starting' || room.state === 'Playing' || room.state === 'Ended';

    if (isPlaying) {
      return (
        <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          <GameTable
            roomId={room.id}
            gameApi={gameApi}
            currentUserId={currentUserId}
            onLeave={() => leaveMutation.mutate(room.id)}
          />
        </View>
      );
    }

    const maleMembers = room.members.filter(m => m.gender === 'man');

    return (
      <View style={[styles.container, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 8 }]}>
        {/* Sticky Top Navigation Bar with Back Button */}
        <View style={styles.topNavBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => leaveMutation.mutate(room.id)}
            disabled={leaveMutation.isPending}
            testID="lobby-top-back-button"
            accessibilityLabel={t('game_leave_and_back', 'მაგიდის დატოვება და უკან დაბრუნება')}
          >
            <Text style={styles.backButtonIcon}>←</Text>
            <Text style={styles.backButtonText}>{t('game_back_leave', 'უკან / გასვლა')}</Text>
          </TouchableOpacity>

          <View style={styles.topNavStatusBadge}>
            <Text style={styles.topNavStatusText}>
              {room.memberCount}/{room.capacity} {t('game_players_count', 'მოთამაშე')}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
          nestedScrollEnabled={true}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          bounces={true}
          overScrollMode="always"
        >
          {/* Header Card */}
          <Card style={styles.roomHeaderCard}>
            <View style={styles.roomTitleRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.roomTitle}>{room.title}</Text>
                <Text style={styles.roomMetaText}>
                  {t('game_quota_summary', {
                    count: room.memberCount,
                    total: room.capacity,
                    capacity: room.capacity,
                    f: room.femaleQuota,
                    female: room.femaleQuota,
                    m: room.maleQuota,
                    male: room.maleQuota,
                    defaultValue: `მოთამაშეები: ${room.memberCount} / ${room.capacity} (ბალანსი: ${room.femaleQuota} ♀ / ${room.maleQuota} ♂)`,
                  })}
                </Text>
              </View>
              <Button
                variant="danger"
                title={t('game_leave_table', '🚪 გასვლა')}
                onPress={() => leaveMutation.mutate(room.id)}
                busy={leaveMutation.isPending}
                style={styles.quickLeaveBtn}
                testID="header-leave-button"
              />
            </View>

            {/* Quorum / Status Info */}
            <View style={styles.quorumBox}>
              {isPlaying ? (
                <Text style={styles.quorumSuccessText}>
                  {t('game_room_filled_playing', {
                    total: room.capacity,
                    capacity: room.capacity,
                    defaultValue: `🎉 მაგიდა შეივსო (${room.capacity} მოთამაშე)! თამაში დაწყებულია. ეს მაგიდა პირადია და სხვებისთვის უხილავია.`,
                  })}
                </Text>
              ) : (
                <Text style={styles.quorumWaitingText}>
                  {t('game_searching_players', {
                    f: room.femaleQuota,
                    female: room.femaleQuota,
                    m: room.maleQuota,
                    male: room.maleQuota,
                    defaultValue: `⏳ მიმდინარეობს მოთამაშეების შერჩევა... როგორც კი მოიძებნება ${room.femaleQuota} ქალი და ${room.maleQuota} კაცი, თამაში მომენტალურად დაიწყება!`,
                  })}
                </Text>
              )}
            </View>

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{errorMessage}</Text>
              </View>
            ) : null}
          </Card>

          {/* Female Slots */}
          <Card style={[styles.sectionCard, styles.sectionCardFemale]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>♀ {t('game_women_quota', 'ქალები')} ({femaleMembers.length} / {room.femaleQuota})</Text>
              <Text style={styles.sectionSubtitle}>{t('game_pink_quota', 'ქალების ადგილები')}</Text>
            </View>
            <View style={styles.slotGrid}>
              {Array.from({ length: Number(room.femaleQuota) }).map((_, idx) => {
                const member = femaleMembers[idx];
                return (
                  <SlotCard
                    key={`female-slot-${idx}`}
                    gender="woman"
                    member={member}
                    isMe={member?.userId === currentUserId}
                  />
                );
              })}
            </View>
          </Card>

          {/* Male Slots */}
          <Card style={[styles.sectionCard, styles.sectionCardMale]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>♂ {t('game_men_quota', 'კაცები')} ({maleMembers.length} / {room.maleQuota})</Text>
              <Text style={styles.sectionSubtitle}>{t('game_blue_quota', 'კაცების ადგილები')}</Text>
            </View>
            <View style={styles.slotGrid}>
              {Array.from({ length: Number(room.maleQuota) }).map((_, idx) => {
                const member = maleMembers[idx];
                return (
                  <SlotCard
                    key={`male-slot-${idx}`}
                    gender="man"
                    member={member}
                    isMe={member?.userId === currentUserId}
                  />
                );
              })}
            </View>
          </Card>

          {/* Cancel Search / Leave Button */}
          <Button
            variant="danger"
            title={isPlaying ? t('game_leave_room', '🚪 მაგიდის დატოვება') : t('game_leave_cancel_search', '🚪 მაგიდის დატოვება (ძიების გაუქმება)')}
            onPress={() => leaveMutation.mutate(room.id)}
            busy={leaveMutation.isPending}
            style={styles.leaveButton}
            testID="leave-room-button"
          />
        </ScrollView>
      </View>
    );
  }

  // Mode Selection & Lobby List View (User is not currently in any room)
  return (
    <Screen
      title={t('game_bottle_title', 'ბოთლის თამაში')}
      scroll={false}
      showBrandSubHeader={false}
    >
      <View style={{ flex: 1 }}>
        <FlatList
          data={roomsQuery.data || []}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl
              refreshing={roomsQuery.isRefetching}
              onRefresh={() => roomsQuery.refetch()}
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              {/* Minimal Hero Header (Arena badge removed, centered title) */}
              <View style={styles.cleanHeader}>
                <Text style={styles.cleanHeaderTitle}>{t('game_bottle_title', 'ბოთლის თამაში')}</Text>
                <Text style={styles.cleanHeaderSubtitle}>
                  {t('game_bottle_slogan', 'დაატრიალე ბოთლი, გაუგზავნე კოცნა და შექმენი მატჩი')}
                </Text>
              </View>

              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Minimal Table Selection Card */}
              <View style={styles.tableSection}>
                <View style={styles.tableSectionHeader}>
                  <Text style={styles.tableSectionTitle}>{t('game_select_table', 'მაგიდის არჩევა')}</Text>
                  <Text style={styles.tableSectionBadge}>{t('game_table_balance', 'ბალანსი: ♀ = ♂')}</Text>
                </View>

                <View style={styles.tableContainerCard}>
                  {TABLE_MODES.map((mode, index) => {
                    const isBusy = queueMutation.isPending && queueMutation.variables === mode.capacity;
                    return (
                      <TouchableOpacity
                        key={mode.capacity}
                        style={[styles.tableRow, index > 0 && styles.tableRowBorder]}
                        onPress={() => queueMutation.mutate(mode.capacity)}
                        disabled={queueMutation.isPending}
                        activeOpacity={0.7}
                      >
                        <View style={styles.tableRowLeft}>
                          <View style={[styles.tableIconBox, { backgroundColor: mode.iconBg }]}>
                            <Text style={styles.tableIconText}>{mode.icon}</Text>
                          </View>
                          <View style={styles.tableInfo}>
                            <View style={styles.tableTitleRow}>
                              <Text style={styles.tableTitleText}>{t(mode.titleKey, mode.titleFallback)}</Text>
                              <View style={styles.tableTag}>
                                <Text style={styles.tableTagText}>{t(mode.tagKey, mode.tagFallback)}</Text>
                              </View>
                            </View>
                            <Text style={styles.tableQuotaText}>{t(mode.quotaKey, mode.quotaFallback)}</Text>
                          </View>
                        </View>

                        <Button
                          variant="primary"
                          title={t('game_find_table', 'ძიება')}
                          onPress={() => queueMutation.mutate(mode.capacity)}
                          busy={isBusy}
                          disabled={queueMutation.isPending}
                          style={styles.tableQueueBtn}
                          textStyle={styles.tableQueueBtnText}
                          testID={mode.testId}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Safety Footnote */}
                <View style={styles.safetyFootnote}>
                  <Text style={styles.safetyFootnoteIcon}>⚡</Text>
                  <Text style={styles.safetyFootnoteText}>
                    {t('game_safety_note', 'ძიება პოულობს ღია მაგიდას ან მიმდინარე თამაშს, სადაც მოთამაშე გავიდა და ადგილი განთავისუფლდა.')}
                  </Text>
                </View>
              </View>

              {/* Custom Room Creation Helper */}
              <View style={styles.customRoomHeaderRow}>
                <View style={styles.roomsTitleGroup}>
                  <Text style={styles.availableRoomsTitle}>{t('game_open_rooms', '💎 კრისტალებით შექმნილი ოთახები')}</Text>
                  {roomsQuery.data && roomsQuery.data.length > 0 ? (
                    <View style={styles.roomCountPill}>
                      <Text style={styles.roomCountText}>{roomsQuery.data.length}</Text>
                    </View>
                  ) : null}
                </View>
                <Button
                  variant="secondary"
                  title={t('game_create_room', '➕ შექმნა (25 💎)')}
                  onPress={() => {
                    setErrorMessage(null);
                    setCreateModalVisible(true);
                  }}
                  style={styles.createRoomBtn}
                  textStyle={styles.createRoomBtnText}
                  testID="create-room-button"
                />
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <RoomListItem
              room={item}
              onJoin={() => {
                if (item.hasPassword) {
                  setSelectedRoomForPassword(item);
                  setEnteredPassword('');
                  setPasswordModalVisible(true);
                } else {
                  joinMutation.mutate({ roomId: item.id });
                }
              }}
              isJoining={joinMutation.isPending && joinMutation.variables?.roomId === item.id}
            />
          )}
          ListEmptyComponent={
            roomsQuery.isLoading ? (
              <GameLobbySkeleton count={3} />
            ) : (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>💎</Text>
                <Text style={styles.emptyTitle}>{t('game_no_lobbies', 'კრისტალებით შექმნილი ოთახი არ მოიძებნა')}</Text>
                <Text style={styles.emptySubtitle}>
                  {t('game_choose_table_hint', 'აირჩიე მაგიდა ზემოთ და დაიწყე ძიება, ან თავად შექმენი ახალი ოთახი 25 💎-ით!')}
                </Text>
              </Card>
            )
          }
        />

        {/* Create Room Modal */}
        <Modal
          visible={createModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCreateModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <Card style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('game_new_room_title', 'ახალი ოთახის შექმნა')}</Text>
              
              {/* Cost & Balance Row */}
              <View style={styles.costBadgeRow}>
                <View style={styles.costBadge}>
                  <Text style={styles.costBadgeText}>💎 25 {t('crystals', 'კრისტალი')}</Text>
                </View>
                <Text style={styles.balanceInfoText}>
                  {t('your_balance', 'ბალანსი')}: {crystalBalance} 💎
                </Text>
              </View>

              {/* Capacity Selector */}
              <Text style={styles.createFieldLabel}>{t('game_room_capacity_label', 'მოთამაშეების რაოდენობა:')}</Text>
              <View style={styles.capacitySelectorRow}>
                {[6, 8, 10].map(cap => {
                  const selected = createCapacity === cap;
                  return (
                    <TouchableOpacity
                      key={cap}
                      style={[styles.capChip, selected && styles.capChipSelected]}
                      onPress={() => setCreateCapacity(cap)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.capChipText, selected && styles.capChipTextSelected]}>
                        {cap} {t('game_players_count', 'მოთამაშე')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Title Input */}
              <Text style={styles.createFieldLabel}>{t('game_room_name_label', 'ოთახის სახელი:')}</Text>
              <TextInput
                placeholder={t('game_room_name_placeholder', 'ოთახის სახელი (სურვილისამებრ)')}
                value={customTitle}
                onChangeText={setCustomTitle}
                maxLength={60}
                testID="create-room-title-input"
              />

              {/* Password Input */}
              <Text style={styles.createFieldLabel}>{t('game_room_password_label', 'პაროლი (სურვილისამებრ):')}</Text>
              <TextInput
                placeholder={t('game_room_password_placeholder', 'შეიყვანეთ პაროლი / PIN')}
                value={createPassword}
                onChangeText={setCreatePassword}
                maxLength={30}
                testID="create-room-password-input"
              />

              {crystalBalance < 25 && (
                <View style={styles.insufficientBanner}>
                  <Text style={styles.insufficientText}>
                    {t('game_insufficient_crystals_create', 'მაგიდის შესაქმნელად საჭიროა 25 კრისტალი.')}
                  </Text>
                  <TouchableOpacity
                    style={styles.topUpBtn}
                    onPress={() => setWalletModalVisible(true)}
                  >
                    <Text style={styles.topUpBtnText}>+ შევსება</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.modalActionsRow}>
                <Button
                  variant="secondary"
                  title={t('cancel', 'გაუქმება')}
                  onPress={() => {
                    setCreateModalVisible(false);
                    setCustomTitle('');
                    setCreatePassword('');
                  }}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  variant="primary"
                  title={t('create', 'შექმნა (25 💎)')}
                  onPress={() => {
                    const payload: { title?: string; capacity: number; password?: string } = {
                      capacity: createCapacity,
                    };
                    if (customTitle.trim()) {
                      payload.title = customTitle.trim();
                    }
                    if (createPassword.trim()) {
                      payload.password = createPassword.trim();
                    }
                    createMutation.mutate(payload);
                  }}
                  busy={createMutation.isPending}
                  style={{ flex: 1, marginLeft: 8 }}
                  testID="confirm-create-room-button"
                />
              </View>
            </Card>
          </View>
        </Modal>

        {/* Password Prompt Modal for Joining Protected Rooms */}
        <Modal
          visible={passwordModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setPasswordModalVisible(false);
            setSelectedRoomForPassword(null);
            setEnteredPassword('');
          }}
        >
          <View style={styles.modalOverlay}>
            <Card style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('game_room_enter_password_title', 'მაგიდის პაროლი')}</Text>
              <Text style={styles.modalSubtitle}>
                {t('game_room_enter_password_desc', 'ეს მაგიდა დაცულია პაროლით. შეიყვანეთ პაროლი შესასვლელად:')}
              </Text>

              <TextInput
                placeholder={t('game_room_password_placeholder', 'შეიყვანეთ პაროლი / PIN')}
                value={enteredPassword}
                onChangeText={setEnteredPassword}
                maxLength={30}
                secureTextEntry
                autoFocus
                testID="enter-room-password-input"
              />

              <View style={styles.modalActionsRow}>
                <Button
                  variant="secondary"
                  title={t('cancel', 'გაუქმება')}
                  onPress={() => {
                    setPasswordModalVisible(false);
                    setSelectedRoomForPassword(null);
                    setEnteredPassword('');
                  }}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  variant="primary"
                  title={t('game_table_enter_btn', 'შესვლა')}
                  onPress={() => {
                    if (selectedRoomForPassword) {
                      joinMutation.mutate({
                        roomId: selectedRoomForPassword.id,
                        password: enteredPassword.trim() || undefined,
                      });
                    }
                  }}
                  busy={joinMutation.isPending}
                  style={{ flex: 1, marginLeft: 8 }}
                  testID="confirm-enter-password-button"
                />
              </View>
            </Card>
          </View>
        </Modal>

        <WalletModal
          visible={walletModalVisible}
          onClose={() => {
            setWalletModalVisible(false);
            void walletQuery.refetch();
          }}
        />
      </View>
    </Screen>
  );
}

function RoomListItem({
  room,
  onJoin,
  isJoining
}: {
  room: GameRoomSummary;
  onJoin: () => void;
  isJoining: boolean;
}) {
  const { t } = useTranslation();
  const isFull = room.memberCount >= room.capacity;

  return (
    <Card style={styles.roomCard} testID={`room-card-${room.id}`}>
      <View style={styles.roomCardHeader}>
        <View style={styles.roomTitleWithLock}>
          {room.hasPassword ? <Text style={styles.lockIcon}>🔒 </Text> : null}
          <Text style={styles.roomCardTitle}>{room.title}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.badge, { backgroundColor: 'rgba(234, 179, 8, 0.15)', borderWidth: 1, borderColor: 'rgba(234, 179, 8, 0.35)', marginRight: 6 }]}>
            <Text style={[styles.badgeText, { color: '#eab308' }]}>💎 ოთახი</Text>
          </View>
          <View style={[styles.badge, styles.badgeLobby]}>
            <Text style={styles.badgeText}>{t('game_lobby_badge', 'ლობი')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.quotaRow}>
        <View style={styles.quotaPill}>
          <Text style={styles.quotaPillText}>♀ {t('game_women_quota', 'ქალები')}: {room.femaleCount} / {room.femaleQuota}</Text>
        </View>
        <View style={styles.quotaPill}>
          <Text style={styles.quotaPillText}>♂ {t('game_men_quota', 'კაცები')}: {room.maleCount} / {room.maleQuota}</Text>
        </View>
        <View style={[styles.quotaPill, styles.totalPill]}>
          <Text style={styles.totalPillText}>{room.memberCount} / {room.capacity}</Text>
        </View>
      </View>

      <Button
        variant={isFull ? 'secondary' : 'primary'}
        disabled={isFull}
        busy={isJoining}
        title={
          isFull
            ? t('game_table_full_badge', 'სავსეა')
            : room.hasPassword
            ? `🔒 ${t('game_table_enter_btn', 'შესვლა')}`
            : t('game_table_enter_btn', 'შესვლა')
        }
        onPress={onJoin}
        style={styles.joinButton}
        testID={`join-room-${room.id}`}
      />
    </Card>
  );
}

function SlotCard({
  gender,
  member,
  isMe
}: {
  gender: 'woman' | 'man';
  member?: GameMember;
  isMe?: boolean;
}) {
  const { t } = useTranslation();
  if (!member) {
    return (
      <View style={[styles.slotBase, styles.emptySlot]}>
        <View style={styles.emptyAvatarCircle}>
          <Text style={styles.emptySlotIcon}>{gender === 'woman' ? '♀' : '♂'}</Text>
        </View>
        <Text style={styles.emptySlotLabel} numberOfLines={1}>{t('game_slot_free', 'თავისუფალი')}</Text>
      </View>
    );
  }

  const photoObj: Photo | null = member.photo
    ? {
        id: member.photo.id,
        state: member.photo.state,
        position: member.photo.position,
        width: member.photo.width,
        height: member.photo.height,
      }
    : null;

  return (
    <View style={[styles.slotBase, styles.occupiedSlot, isMe && styles.mySlot]}>
      <View style={styles.avatarWrapper}>
        {photoObj ? (
          <PrivatePhoto
            photo={photoObj}
            avatar
            style={styles.slotAvatar}
          />
        ) : (
          <View style={[styles.slotAvatar, styles.placeholderAvatar]}>
            <Text style={{ fontSize: 18 }}>👤</Text>
          </View>
        )}
        <View style={[styles.genderTag, gender === 'woman' ? styles.tagFemale : styles.tagMale]}>
          <Text style={styles.genderTagText}>{gender === 'woman' ? '♀' : '♂'}</Text>
        </View>
      </View>
      <Text style={styles.memberName} numberOfLines={1}>
        {member.displayName}
      </Text>
      <Text style={styles.memberAge} numberOfLines={1}>
        {isMe ? t('game_you_label', 'შენ · ') : ''}{member.age} {t('game_years_short', 'წლ.')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    padding: theme.space.md,
    gap: theme.space.md,
    flexGrow: 1,
  },
  topSeedBox: {
    marginTop: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1.5,
    borderRadius: theme.radius.control,
    padding: 12,
    alignItems: 'center',
  },
  topSeedBtn: {
    width: '100%',
    backgroundColor: '#059669',
  },
  topSeedHint: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  listContent: {
    padding: theme.space.md,
    gap: theme.space.md,
  },
  listHeader: {
    gap: theme.space.md,
    marginBottom: theme.space.sm,
  },
  // Clean Minimal Hero Header
  cleanHeader: {
    paddingVertical: theme.space.xs,
    paddingHorizontal: 2,
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cleanHeaderTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  cleanHeaderSubtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    lineHeight: 18,
    textAlign: 'center',
  },

  // Minimal Table Selection
  tableSection: {
    gap: 10,
  },
  tableSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  tableSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  tableSectionBadge: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '500',
    textAlign: 'center',
  },
  tableContainerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(54, 43, 78, 0.6)',
  },
  tableRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  tableIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableIconText: {
    fontSize: 20,
  },
  tableInfo: {
    flex: 1,
    gap: 2,
  },
  tableTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tableTitleText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  tableTag: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tableTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  tableQuotaText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  tableQueueBtn: {
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  tableQueueBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Safety Footnote
  safetyFootnote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  safetyFootnoteIcon: {
    fontSize: 14,
  },
  safetyFootnoteText: {
    fontSize: 11,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Rooms Header
  customRoomHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  roomsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  availableRoomsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  roomCountPill: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  roomCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  createRoomBtn: {
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  createRoomBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  roomCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.space.md,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.space.sm,
  },
  roomCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.space.sm,
  },
  roomCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeLobby: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: theme.colors.primary,
    borderWidth: 1,
  },
  badgeStarting: {
    backgroundColor: 'rgba(251, 113, 133, 0.2)',
    borderColor: theme.colors.match,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },
  quotaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.space.md,
  },
  quotaPill: {
    backgroundColor: theme.colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quotaPillText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  totalPill: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
  },
  totalPillText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  joinButton: {
    marginTop: 4,
  },
  emptyCard: {
    alignItems: 'center',
    padding: theme.space.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    marginTop: theme.space.md,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: theme.space.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: theme.colors.danger,
    borderWidth: 1,
    padding: theme.space.sm,
    borderRadius: theme.radius.control,
    marginTop: theme.space.xs,
  },
  errorBannerText: {
    color: theme.colors.danger,
    fontSize: theme.type.small,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.surface,
    padding: theme.space.lg,
    borderRadius: theme.radius.card,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginBottom: theme.space.md,
  },
  modalActionsRow: {
    flexDirection: 'row',
    marginTop: theme.space.md,
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    marginBottom: theme.space.xs,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  backButtonIcon: {
    fontSize: 16,
    color: theme.colors.danger,
    fontWeight: '700',
    marginRight: 6,
  },
  backButtonText: {
    fontSize: 13,
    color: theme.colors.danger,
    fontWeight: '700',
  },
  topNavStatusBadge: {
    backgroundColor: theme.colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  topNavStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  quickLeaveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roomHeaderCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.space.md,
    borderRadius: theme.radius.card,
  },
  roomTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  roomTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    flex: 1,
  },
  roomMetaText: {
    fontSize: 13,
    color: theme.colors.muted,
    marginBottom: 8,
    textAlign: 'center',
  },
  quorumBox: {
    backgroundColor: theme.colors.soft,
    padding: 10,
    borderRadius: theme.radius.control,
    marginTop: 4,
  },
  quorumSuccessText: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  quorumWaitingText: {
    color: theme.colors.primary,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionCardFemale: {
    borderColor: 'rgba(236, 72, 153, 0.35)',
  },
  sectionCardMale: {
    borderColor: 'rgba(59, 130, 246, 0.35)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  slotBase: {
    width: 52,
    height: 72,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  emptySlot: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  emptyAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.soft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 3,
  },
  emptySlotIcon: {
    fontSize: 16,
    color: theme.colors.muted,
  },
  emptySlotLabel: {
    fontSize: 9,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  occupiedSlot: {
    backgroundColor: theme.colors.soft,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mySlot: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 2,
  },
  slotAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  placeholderAvatar: {
    backgroundColor: theme.colors.soft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderTag: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagFemale: {
    backgroundColor: '#EC4899',
  },
  tagMale: {
    backgroundColor: '#3B82F6',
  },
  genderTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    maxWidth: 48,
  },
  memberAge: {
    fontSize: 9,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  devCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    padding: theme.space.md,
    borderRadius: theme.radius.card,
  },
  devTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 4,
  },
  devSubtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    marginBottom: theme.space.sm,
  },
  devButton: {
    marginTop: 4,
  },
  leaveButton: {
    marginTop: theme.space.sm,
    marginBottom: theme.space.lg,
  },
  costBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  costBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  costBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  balanceInfoText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  createFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  capacitySelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  capChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.soft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  capChipSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderColor: theme.colors.primary,
  },
  capChipText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  capChipTextSelected: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  insufficientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: theme.colors.danger,
    borderWidth: 1,
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  insufficientText: {
    fontSize: 12,
    color: theme.colors.danger,
    flex: 1,
    marginRight: 6,
  },
  topUpBtn: {
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  topUpBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  roomTitleWithLock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lockIcon: {
    fontSize: 14,
  },
});
