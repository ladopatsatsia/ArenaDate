import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import * as Crypto from 'expo-crypto';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  GameApi,
  type GameRoomSnapshot,
  type GameMember
} from './GameApi';
import { theme } from '../components/theme';
import { Text, Card, Button } from '../components/UI';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import type { Photo } from '../profile/api';
import { WalletModal } from '../components/WalletModal';
import { RoomChatModal } from './RoomChatModal';
import { gameSound } from './GameSound';
import { getTelegramWebApp } from '../telegram/telegramSdk';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoMarkSource = require('../../assets/logo-mark.png');

interface GameTableProps {
  roomId: string;
  gameApi: GameApi;
  currentUserId: string | undefined;
  onLeave: () => void;
}

export function GameTable({ roomId, gameApi, currentUserId, onLeave }: GameTableProps) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [lastRoundId, setLastRoundId] = useState<string | null>(null);
  const [lastQuestionIndex, setLastQuestionIndex] = useState<number | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedPeerName, setMatchedPeerName] = useState<string>('');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [directMessageText, setDirectMessageText] = useState('');
  const [isSendingDirectRequest, setIsSendingDirectRequest] = useState(false);
  const [directRequestError, setDirectRequestError] = useState<string | null>(null);
  const [directRequestSuccess, setDirectRequestSuccess] = useState<string | null>(null);
  const [isRespondingRequest, setIsRespondingRequest] = useState(false);
  const [respondingAction, setRespondingAction] = useState<'Accept' | 'Decline' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastPendingKissPartnerRef = useRef<boolean>(false);
  const lastPendingDirectReqCountRef = useRef<number>(0);
  const lastTargetAnnouncedRef = useRef<string | null>(null);
  const lastSpinnerAnnouncedRef = useRef<string | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const isInitialChatLoadRef = useRef<boolean>(true);
  const lastViewedMessageIdRef = useRef<string | null>(null);
  const [latestNewMessagePreview, setLatestNewMessagePreview] = useState<{
    id: string;
    senderDisplayName: string;
    text: string;
  } | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [unlockingProfile, setUnlockingProfile] = useState(false);
  const [profileUnlockError, setProfileUnlockError] = useState<string | null>(null);
  const [confirmUnlockProfile, setConfirmUnlockProfile] = useState(false);
  const [sentPostGameKissUserIds, setSentPostGameKissUserIds] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [isBottleAnimating, setIsBottleAnimating] = useState(false);
  const autoSpunTurnRef = useRef<string | null>(null);

  const [sendingGiftId, setSendingGiftId] = useState<string | null>(null);
  const [giftSuccessMsg, setGiftSuccessMsg] = useState<string | null>(null);
  const [giftErrorMsg, setGiftErrorMsg] = useState<string | null>(null);

  const walletQuery = useQuery({
    queryKey: ['game-wallet'],
    queryFn: () => gameApi.getWallet(),
  });


  const roomMessagesQuery = useQuery({
    queryKey: ['game-room-messages', roomId],
    queryFn: () => gameApi.getRoomMessages(roomId),
    refetchInterval: 1500,
  });

  useEffect(() => {
    const msgs = roomMessagesQuery.data ?? [];
    if (isInitialChatLoadRef.current) {
      if (roomMessagesQuery.isSuccess) {
        isInitialChatLoadRef.current = false;
        const initialLast = msgs[msgs.length - 1];
        if (initialLast) {
          lastViewedMessageIdRef.current = initialLast.id;
        }
      }
      return;
    }

    if (msgs.length === 0) return;
    const lastMsg = msgs[msgs.length - 1];

    if (showChatModal) {
      setUnreadChatCount(0);
      if (lastMsg) lastViewedMessageIdRef.current = lastMsg.id;
      setLatestNewMessagePreview(null);
      return;
    }

    let newMsgs: typeof msgs;
    if (!lastViewedMessageIdRef.current) {
      newMsgs = msgs;
    } else {
      const lastIndex = msgs.findIndex((m: { id: string }) => m.id === lastViewedMessageIdRef.current);
      if (lastIndex >= 0) {
        newMsgs = msgs.slice(lastIndex + 1);
      } else {
        newMsgs = msgs;
      }
    }

    const incomingFromOthers = newMsgs.filter((m: { senderUserId: string }) => m.senderUserId !== currentUserId);
    setUnreadChatCount(incomingFromOthers.length);

    if (incomingFromOthers.length > 0) {
      const newestIncoming = incomingFromOthers[incomingFromOthers.length - 1];
      if (newestIncoming) {
        setLatestNewMessagePreview((prev) => {
          if (prev?.id === newestIncoming.id) return prev;
          return {
            id: newestIncoming.id,
            senderDisplayName: newestIncoming.senderDisplayName,
            text: newestIncoming.text,
          };
        });
      }
    }

    const newestAny = newMsgs[newMsgs.length - 1];
    if (newestAny && newestAny.senderUserId === currentUserId) {
      lastViewedMessageIdRef.current = newestAny.id;
    }
  }, [roomMessagesQuery.data, roomMessagesQuery.isSuccess, showChatModal, currentUserId]);

  useEffect(() => {
    if (!latestNewMessagePreview) return;
    const timer = setTimeout(() => {
      setLatestNewMessagePreview(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [latestNewMessagePreview?.id]);


  const memberProfileQuery = useQuery({
    queryKey: ['game-member-profile', selectedMemberId],
    queryFn: () => selectedMemberId ? gameApi.getGameProfile(selectedMemberId) : null,
    enabled: !!selectedMemberId,
  });

  const giftCatalogQuery = useQuery({
    queryKey: ['game-gift-catalog'],
    queryFn: () => gameApi.getGiftCatalog(),
  });

  // Spin rotation animation & magnetic emotional attraction pulses
  const spinAnim = useRef(new Animated.Value(0)).current;
  const kissPulseAnim = useRef(new Animated.Value(1)).current;
  const kissGlowAnim = useRef(new Animated.Value(0.4)).current;
  const bottleSpinGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      kissPulseAnim.setValue(1);
      kissGlowAnim.setValue(0.5);
      return;
    }
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(kissPulseAnim, {
          toValue: 1.05,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(kissPulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(kissGlowAnim, {
          toValue: 0.9,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(kissGlowAnim, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    glowLoop.start();
    return () => {
      pulseLoop.stop();
      glowLoop.stop();
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (isBottleAnimating) {
      const haloLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(bottleSpinGlow, {
            toValue: 1,
            duration: 350,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(bottleSpinGlow, {
            toValue: 0.2,
            duration: 350,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      );
      haloLoop.start();
      return () => haloLoop.stop();
    } else {
      bottleSpinGlow.setValue(0);
    }
  }, [isBottleAnimating]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const tg = getTelegramWebApp();
      if (tg?.BackButton) {
        tg.BackButton.show();
        const handler = () => onLeave();
        tg.BackButton.onClick(handler);
        return () => {
          tg.BackButton.offClick(handler);
          tg.BackButton.hide();
        };
      }
      return;
    }
    const onBackPress = () => {
      onLeave();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [onLeave]);

  // Periodic heartbeat while in room
  useEffect(() => {
    if (!roomId) return;

    if (typeof gameApi.heartbeat === 'function') {
      gameApi.heartbeat(roomId).catch(() => {});
    }

    const interval = setInterval(() => {
      if (typeof gameApi.heartbeat === 'function') {
        gameApi.heartbeat(roomId).catch(() => {});
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [roomId, gameApi]);

  // Leave room if user closes window/tab or navigates away on web
  useEffect(() => {
    if (!roomId || Platform.OS !== 'web') return;

    const handleUnload = () => {
      try {
        gameApi.leaveRoom(roomId).catch(() => {});
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
  }, [roomId, gameApi]);

  // Poll room snapshot every 1.5s for real-time game updates
  const snapshotQuery = useQuery({
    queryKey: ['game', 'snapshot', roomId],
    queryFn: () => gameApi.getSnapshot(roomId),
    refetchInterval: 1500,
  });

  const snapshot: GameRoomSnapshot | undefined = snapshotQuery.data;
  const currentRound = snapshot?.currentRound;

  // Calculate exact angle (in degrees, clockwise from 12 o'clock) for a member's seat on the table
  const getMemberAngle = (userId: string | null | undefined): number | null => {
    if (!userId || !snapshot?.members || snapshot.members.length === 0) return null;
    const index = snapshot.members.findIndex((m) => m.userId === userId);
    if (index < 0) return null;
    return (index / snapshot.members.length) * 360;
  };

  // Calculate coordinates (relative to table center) for a member's seat
  const getSeatCoordinates = (userId: string | null | undefined): { x: number; y: number } => {
    if (!userId || !snapshot?.members || snapshot.members.length === 0) return { x: 0, y: 0 };
    const index = snapshot.members.findIndex((m) => m.userId === userId);
    if (index < 0) return { x: 0, y: 0 };
    const total = snapshot.members.length;
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radius = 125;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  };

  interface FlyingGiftItem {
    id: string;
    senderUserId: string;
    recipientUserId: string;
    giftIcon: string;
    giftName: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    anim: Animated.Value;
  }

  const [activeFlyingGifts, setActiveFlyingGifts] = useState<FlyingGiftItem[]>([]);
  const [recipientCelebrations, setRecipientCelebrations] = useState<Record<string, { giftIcon: string; giftName: string }>>({});
  const seenGiftIdsRef = useRef<Set<string>>(new Set());

  // Round 1-18 Announcement Pop-up before each spin
  interface RoundAnnouncementData {
    roundNumber: number;
    totalRounds: number;
  }
  const [roundAnnouncement, setRoundAnnouncement] = useState<RoundAnnouncementData | null>(null);
  const roundAnnouncementScale = useRef(new Animated.Value(0.3)).current;
  const roundAnnouncementOpacity = useRef(new Animated.Value(0)).current;
  const lastAnnouncedRoundNumberRef = useRef<number>(0);

  const triggerRoundAnnouncement = (roundNum: number) => {
    if (lastAnnouncedRoundNumberRef.current === roundNum || roundNum <= 0) return;
    lastAnnouncedRoundNumberRef.current = roundNum;
    setRoundAnnouncement({
      roundNumber: roundNum,
      totalRounds: 18,
    });
    gameSound.playTurnSelected();

    if (reduceMotion) {
      roundAnnouncementScale.setValue(1);
      roundAnnouncementOpacity.setValue(1);
      setTimeout(() => {
        setRoundAnnouncement(null);
      }, 1800);
      return;
    }

    roundAnnouncementScale.setValue(0.3);
    roundAnnouncementOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(roundAnnouncementScale, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(roundAnnouncementOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(roundAnnouncementScale, {
            toValue: 1.15,
            duration: 350,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(roundAnnouncementOpacity, {
            toValue: 0,
            duration: 350,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setRoundAnnouncement(null);
        });
      }, 1600);
    });
  };

  // Seat-to-Seat Flying Kisses & Dynamic 3D Avatar Lift
  interface FlyingSeatKiss {
    id: string;
    fromUserId: string;
    toUserId: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    anim: Animated.Value;
  }

  const [activeFlyingKisses, setActiveFlyingKisses] = useState<FlyingSeatKiss[]>([]);
  const [kissRecipientBurstUserId, setKissRecipientBurstUserId] = useState<string | null>(null);
  const spinnerLiftAnim = useRef(new Animated.Value(0)).current;
  const targetLiftAnim = useRef(new Animated.Value(0)).current;
  const lastSeenKissRecipientUserIdRef = useRef<string | null>(null);

  // Smoothly elevate the chooser's avatar into 3D at their seat when bottle stops on them
  useEffect(() => {
    const isSpinning = currentRound?.state === 'Spinning' || isBottleAnimating;
    if (!isSpinning && currentRound?.spinnerUserId) {
      if (reduceMotion) {
        spinnerLiftAnim.setValue(1);
      } else {
        Animated.spring(spinnerLiftAnim, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }).start();
      }
    } else {
      spinnerLiftAnim.setValue(0);
    }
  }, [currentRound?.spinnerUserId, currentRound?.state, isBottleAnimating, reduceMotion]);

  // Smoothly elevate the chosen target's avatar into 3D at their seat
  useEffect(() => {
    const isSpinning = currentRound?.state === 'Spinning' || isBottleAnimating;
    if (!isSpinning && currentRound?.targetUserId) {
      if (reduceMotion) {
        targetLiftAnim.setValue(1);
      } else {
        Animated.spring(targetLiftAnim, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }).start();
      }
    } else {
      targetLiftAnim.setValue(0);
    }
  }, [currentRound?.targetUserId, currentRound?.state, isBottleAnimating, reduceMotion]);

  const onSeatKissArrived = (toUserId: string) => {
    gameSound.playKissReceived();
    setKissRecipientBurstUserId(toUserId);

    setTimeout(() => {
      setKissRecipientBurstUserId((curr) => (curr === toUserId ? null : curr));
    }, 2500);
  };

  const launchSeatKiss = (fromUserId?: string | null, toUserId?: string | null) => {
    if (!fromUserId || !toUserId) return;
    const start = getSeatCoordinates(fromUserId);
    const end = getSeatCoordinates(toUserId);
    const anim = new Animated.Value(0);
    const newKiss: FlyingSeatKiss = {
      id: `${Date.now()}_${Math.random()}`,
      fromUserId,
      toUserId,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      anim,
    };

    setActiveFlyingKisses((prev) => [...prev, newKiss]);
    gameSound.playKissSent();

    if (reduceMotion) {
      anim.setValue(1);
      onSeatKissArrived(toUserId);
      setActiveFlyingKisses((prev) => prev.filter((k) => k.id !== newKiss.id));
      return;
    }

    Animated.timing(anim, {
      toValue: 1,
      duration: 1100,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start(() => {
      onSeatKissArrived(toUserId);
      setActiveFlyingKisses((prev) => prev.filter((k) => k.id !== newKiss.id));
    });
  };

  const launchSpotlightKiss = (from: 'spinner' | 'target') => {
    const spinnerId = currentRound?.spinnerUserId;
    const targetId = currentRound?.targetUserId;
    if (from === 'spinner') {
      launchSeatKiss(spinnerId, targetId);
    } else {
      launchSeatKiss(targetId, spinnerId);
    }
  };

  const onFlightComplete = (gift: FlyingGiftItem) => {
    gameSound.playKissReceived();
    setActiveFlyingGifts((prev) => prev.filter((g) => g.id !== gift.id));
    setRecipientCelebrations((prev) => ({
      ...prev,
      [gift.recipientUserId]: { giftIcon: gift.giftIcon, giftName: gift.giftName },
    }));
    setTimeout(() => {
      setRecipientCelebrations((prev) => {
        const copy = { ...prev };
        delete copy[gift.recipientUserId];
        return copy;
      });
    }, 4000);
  };

  const triggerGiftFlight = (
    senderUserId: string,
    recipientUserId: string,
    giftIcon: string,
    giftName: string,
    id: string
  ) => {
    const start = getSeatCoordinates(senderUserId);
    const end = getSeatCoordinates(recipientUserId);
    const anim = new Animated.Value(0);

    const newGift: FlyingGiftItem = {
      id,
      senderUserId,
      recipientUserId,
      giftIcon,
      giftName,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      anim,
    };

    setActiveFlyingGifts((prev) => [...prev, newGift]);
    gameSound.playKissSent();

    if (reduceMotion) {
      anim.setValue(1);
      onFlightComplete(newGift);
      return;
    }

    Animated.timing(anim, {
      toValue: 1,
      duration: 1300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start(() => {
      onFlightComplete(newGift);
    });
  };

  useEffect(() => {
    const recent = snapshot?.recentGifts;
    if (!recent || recent.length === 0) return;
    for (const g of recent) {
      if (!seenGiftIdsRef.current.has(g.id)) {
        seenGiftIdsRef.current.add(g.id);
        triggerGiftFlight(
          g.senderUserId,
          g.recipientUserId,
          g.giftIcon,
          g.giftName,
          g.id
        );
      }
    }
  }, [snapshot?.recentGifts]);

  const handleSendGift = async (giftId: string) => {
    if (!selectedMemberId) return;
    const recipientId = selectedMemberId;
    setSendingGiftId(giftId);
    setGiftErrorMsg(null);
    setGiftSuccessMsg(null);
    try {
      const res = await gameApi.sendGift({
        recipientUserId: recipientId,
        giftId,
        roomId,
        idempotencyKey: Crypto.randomUUID(),
      });
      seenGiftIdsRef.current.add(res.giftRecordId);
      // Close member profile modal immediately so the user sees the table and the flying animation!
      setSelectedMemberId(null);
      // Trigger the flying gift from current user's seat to recipient's seat!
      triggerGiftFlight(
        currentUserId ?? '',
        recipientId,
        res.giftIcon,
        res.giftName,
        res.giftRecordId
      );
      await cache.invalidateQueries({ queryKey: ['game-wallet'] });
      await cache.invalidateQueries({ queryKey: ['game-member-profile', recipientId] });
      await cache.invalidateQueries({ queryKey: ['user-gifts'] });
      await cache.invalidateQueries({ queryKey: ['game', 'snapshot', roomId] });
    } catch (err: unknown) {
      const e = err as { message?: string; status?: number };
      if (e.status === 400 && e.message?.includes('insufficient')) {
        setGiftErrorMsg(t('wallet_insufficient_crystals', 'არასაკმარისი კრისტალები.'));
      } else {
        setGiftErrorMsg(t('gifts_send_failed', 'საჩუქრის გაგზავნა ვერ მოხერხდა.'));
      }
    } finally {
      setSendingGiftId(null);
    }
  };

  // Spin bottle mutation
  const spinMutation = useMutation({
    mutationFn: () => gameApi.spinBottle(roomId, false),
    onSuccess: (res) => {
      cache.invalidateQueries({ queryKey: ['game', 'snapshot', roomId] });
      const angle = getMemberAngle(res.spinnerUserId) ?? Number(res.angleDegrees);
      animateBottle(angle);
    },
  });

  // Answer question mutation
  const answerMutation = useMutation({
    mutationFn: (vars: { roundId: string; qIndex: number; option: number }) =>
      gameApi.answerQuestion(roomId, vars.roundId, vars.qIndex, {
        questionId: currentRound?.currentQuestion?.id ?? '00000000-0000-0000-0000-000000000000',
        selectedOption: vars.option,
        isSkipped: false,
        idempotencyKey: `ans_${vars.roundId}_${vars.qIndex}_${vars.option}`,
        stateVersion: Number(snapshot?.stateVersion ?? 1),
      }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['game', 'snapshot', roomId] });
    },
  });

  // Skip question mutation
  // Skip question mutation
  const skipMutation = useMutation({
    mutationFn: (vars: { roundId: string; qIndex: number }) =>
      gameApi.skipQuestion(
        roomId,
        vars.roundId,
        vars.qIndex,
        `skip_${vars.roundId}_${vars.qIndex}_${Date.now()}`
      ),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['game', 'snapshot', roomId] });
    },
  });

  // Send kiss mutation
  const kissMutation = useMutation({
    mutationFn: (recipientUserId: string) =>
      gameApi.sendKiss(roomId, currentRound!.roundId, {
        recipientUserId,
        idempotencyKey: `kiss_${currentRound!.roundId}_${recipientUserId}`,
      }),
    onMutate: () => {
      gameSound.playKissSent();
      if (currentUserId === currentRound?.spinnerUserId) {
        launchSpotlightKiss('spinner');
      } else {
        launchSpotlightKiss('target');
      }
    },
    onSuccess: (res) => {
      cache.invalidateQueries({ queryKey: ['game', 'snapshot', roomId] });
      if (res.status === 'Matched') {
        gameSound.playKissReceived();
        const peer = snapshot?.members.find(m => m.userId === res.recipientUserId);
        setMatchedPeerName(peer?.displayName ?? t('game_partner', 'მეწყვილე'));
        setShowMatchModal(true);
      }
    },
  });

  // Skip kiss mutation
  const skipKissMutation = useMutation({
    mutationFn: () =>
      gameApi.skipKiss(roomId, currentRound!.roundId, `skipkiss_${currentRound!.roundId}_${Date.now()}`),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['game', 'snapshot', roomId] });
    },
  });

  // Select target mutation (Spinner picks opposite-gender player for question)
  const selectTargetMutation = useMutation({
    mutationFn: (targetUserId: string) => {
      if (!currentRound) throw new Error('No active round');
      return gameApi.selectTarget(roomId, currentRound.roundId, targetUserId);
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['game', 'snapshot', roomId] });
    },
  });

  // Skip target mutation (Spinner skips question round, advances turn)
  const skipTargetMutation = useMutation({
    mutationFn: () => {
      if (!currentRound) throw new Error('No active round');
      return gameApi.skipTarget(roomId, currentRound.roundId, `skiptarget_${currentRound.roundId}_${Date.now()}`);
    },
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['game', 'snapshot', roomId] });
    },
  });

  // Post-game kiss mutation (18 rounds finished, send kiss to any participant)
  const postGameKissMutation = useMutation({
    mutationFn: (recipientUserId: string) =>
      gameApi.postGameKiss(roomId, {
        recipientUserId,
        idempotencyKey: `postkiss_${roomId}_${recipientUserId}_${Date.now()}`,
      }),
    onMutate: () => {
      gameSound.playKissSent();
    },
    onSuccess: (res, recipientUserId) => {
      setSentPostGameKissUserIds((prev) => [...prev, recipientUserId]);
      cache.invalidateQueries({ queryKey: ['game', 'snapshot', roomId] });
      if (res.status === 'Matched') {
        gameSound.playKissReceived();
        const peer = snapshot?.members.find((m) => m.userId === recipientUserId);
        setMatchedPeerName(peer?.displayName ?? t('game_partner', 'მეწყვილე'));
        setShowMatchModal(true);
      }
    },
  });

  const animateBottle = (targetAngle: number, roundNum?: number) => {
    if (roundNum && lastAnnouncedRoundNumberRef.current !== roundNum) {
      triggerRoundAnnouncement(roundNum);
    }
    setIsBottleAnimating(true);
    gameSound.playSpin();
    if (reduceMotion) {
      spinAnim.setValue(targetAngle);
      setIsBottleAnimating(false);
      gameSound.stopSpin();
      if (currentRound && currentRound.spinnerUserId === currentUserId) {
        if (lastSpinnerAnnouncedRef.current !== currentRound.roundId) {
          lastSpinnerAnnouncedRef.current = currentRound.roundId;
          gameSound.playTurnSelected();
        }
      }
      return;
    }
    spinAnim.setValue(0);
    Animated.timing(spinAnim, {
      toValue: targetAngle + 1800, // 5 full suspenseful revolutions + target angle
      duration: 4000,
      easing: Easing.bezier(0.12, 0.8, 0.22, 1),
      useNativeDriver: true,
    }).start(() => {
      setIsBottleAnimating(false);
      gameSound.stopSpin();
      if (currentRound && currentRound.spinnerUserId === currentUserId) {
        if (lastSpinnerAnnouncedRef.current !== currentRound.roundId) {
          lastSpinnerAnnouncedRef.current = currentRound.roundId;
          gameSound.playTurnSelected();
        }
      }
    });
  };

  useEffect(() => {
    return () => {
      gameSound.stopSpin();
    };
  }, []);

  // Announce when user is chosen as question target
  useEffect(() => {
    if (currentRound?.targetUserId && currentRound.targetUserId === currentUserId) {
      if (lastTargetAnnouncedRef.current !== currentRound.roundId) {
        lastTargetAnnouncedRef.current = currentRound.roundId;
        gameSound.playTurnSelected();
      }
    }
  }, [currentRound?.roundId, currentRound?.targetUserId, currentUserId]);

  // Sound effect when incoming kiss or direct match request is received
  useEffect(() => {
    const hasPending = Boolean(currentRound?.hasPendingKissFromPartner);
    if (hasPending && !lastPendingKissPartnerRef.current) {
      gameSound.playKissReceived();
      if (currentUserId === currentRound?.spinnerUserId) {
        launchSpotlightKiss('target');
      } else {
        launchSpotlightKiss('spinner');
      }
    }
    lastPendingKissPartnerRef.current = hasPending;
  }, [currentRound?.hasPendingKissFromPartner, currentUserId, currentRound?.spinnerUserId]);

  // Trigger spotlight kiss animation when a round kiss is completed
  useEffect(() => {
    const recipient = currentRound?.kissRecipientUserId;
    if (recipient && recipient !== lastSeenKissRecipientUserIdRef.current) {
      lastSeenKissRecipientUserIdRef.current = recipient;
      if (recipient === currentRound?.spinnerUserId) {
        launchSpotlightKiss('target');
      } else if (recipient === currentRound?.targetUserId) {
        launchSpotlightKiss('spinner');
      }
    }
  }, [currentRound?.kissRecipientUserId, currentRound?.spinnerUserId, currentRound?.targetUserId]);

  useEffect(() => {
    const count = snapshot?.pendingDirectRequests?.length ?? 0;
    if (count > lastPendingDirectReqCountRef.current) {
      gameSound.playKissReceived();
    }
    lastPendingDirectReqCountRef.current = count;
  }, [snapshot?.pendingDirectRequests?.length]);

  // Sync animation when a round spin is active
  useEffect(() => {
    if (currentRound && currentRound.roundId !== lastRoundId) {
      setLastRoundId(currentRound.roundId);
      const computedAngle = getMemberAngle(currentRound.spinnerUserId) ?? Number(currentRound.angleDegrees);
      if (currentRound.state === 'Spinning') {
        animateBottle(computedAngle, Number(currentRound.roundNumber));
      } else {
        spinAnim.setValue(computedAngle);
      }
    }
  }, [currentRound?.roundId, currentRound?.state, currentRound?.spinnerUserId, currentRound?.angleDegrees, currentRound?.roundNumber, snapshot?.members]);

  // Automatically trigger Round announcement before every spin / when round starts
  useEffect(() => {
    if (snapshot?.state !== 'Playing' && snapshot?.state !== 'Starting') return;

    let targetRoundNum: number | null = null;
    if (currentRound?.roundNumber != null) {
      const parsed = Number(currentRound.roundNumber);
      if (currentRound.state === 'Completed' && snapshot.deadlineType === 'TurnPending') {
        targetRoundNum = parsed + 1;
      } else {
        targetRoundNum = parsed;
      }
    } else if (snapshot.deadlineType === 'TurnPending' || currentRound?.state === 'Spinning') {
      targetRoundNum = 1;
    }

    if (targetRoundNum != null && targetRoundNum > 0 && targetRoundNum <= 18 && targetRoundNum !== lastAnnouncedRoundNumberRef.current) {
      triggerRoundAnnouncement(targetRoundNum);
    }
  }, [snapshot?.state, snapshot?.deadlineType, currentRound?.roundNumber, currentRound?.roundId, currentRound?.state]);

  // Keep bottle pointed at the active spinner/turn owner when not spinning
  useEffect(() => {
    if (currentRound && currentRound.state !== 'Spinning' && currentRound.spinnerUserId) {
      const angle = getMemberAngle(currentRound.spinnerUserId);
      if (angle != null) spinAnim.setValue(angle);
    } else if (!currentRound && snapshot?.currentTurnUserId) {
      const angle = getMemberAngle(snapshot.currentTurnUserId);
      if (angle != null) spinAnim.setValue(angle);
    }
  }, [currentRound?.state, currentRound?.spinnerUserId, snapshot?.currentTurnUserId, snapshot?.members]);

  // Reset selected option when question index advances
  useEffect(() => {
    if (currentRound && currentRound.currentQuestionIndex !== lastQuestionIndex) {
      setLastQuestionIndex(Number(currentRound.currentQuestionIndex));
      setSelectedOptionIndex(currentRound.callerPendingAnswer != null ? Number(currentRound.callerPendingAnswer) : null);
    }
  }, [currentRound?.currentQuestionIndex, currentRound?.callerPendingAnswer]);

  const isMyTurn = snapshot?.currentTurnUserId === currentUserId;
  const isParticipant =
    currentRound != null &&
    (currentRound.spinnerUserId === currentUserId || currentRound.targetUserId === currentUserId);

  // Real-time second-by-second countdown timer
  useEffect(() => {
    if (snapshot?.remainingDeadlineMs != null && Number(snapshot.remainingDeadlineMs) > 0) {
      const ms = Number(snapshot.remainingDeadlineMs);
      setTimeLeft(Number.isFinite(ms) ? Math.max(0, Math.ceil(ms / 1000)) : 15);
    } else if (snapshot?.deadlineUtc) {
      const dateStr = typeof snapshot.deadlineUtc === 'string'
        ? snapshot.deadlineUtc.replace(' ', 'T')
        : snapshot.deadlineUtc;
      const parsed = new Date(dateStr).getTime();
      const diffMs = parsed - Date.now();
      setTimeLeft(Number.isFinite(diffMs) ? Math.max(0, Math.ceil(diffMs / 1000)) : 15);
    } else {
      setTimeLeft(15);
    }
  }, [snapshot?.remainingDeadlineMs, snapshot?.deadlineUtc, snapshot?.stateVersion, snapshot?.deadlineType]);

  const safeTimeLeft = typeof timeLeft === 'number' && Number.isFinite(timeLeft) && timeLeft >= 0
    ? Math.floor(timeLeft)
    : 15;

  const [hasLocallyDecidedKiss, setHasLocallyDecidedKiss] = useState(false);

  useEffect(() => {
    setHasLocallyDecidedKiss(false);
  }, [currentRound?.roundId, currentRound?.state]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-spin bottle when it's player's turn (no manual button needed)
  useEffect(() => {
    if (isMyTurn && snapshot?.deadlineType === 'TurnPending' && snapshot?.roomId) {
      const turnKey = `${snapshot.roomId}_${snapshot.stateVersion}_${snapshot.currentTurnUserId}`;
      if (autoSpunTurnRef.current !== turnKey && !spinMutation.isPending) {
        autoSpunTurnRef.current = turnKey;
        spinMutation.mutate();
      }
    }
  }, [isMyTurn, snapshot?.deadlineType, snapshot?.roomId, snapshot?.stateVersion, snapshot?.currentTurnUserId, spinMutation.isPending]);

  const isPairParticipant =
    currentRound != null &&
    (currentRound.spinnerUserId === currentUserId || currentRound.targetUserId === currentUserId);

  const pairPartnerId =
    currentRound?.spinnerUserId === currentUserId
      ? currentRound?.targetUserId
      : currentRound?.spinnerUserId;

  const pairPartnerMember = snapshot?.members.find((m) => m.userId === pairPartnerId);
  const pairPartnerName = pairPartnerMember?.displayName ?? t('game_partner', 'მეწყვილე');
  const hasDecidedKiss = currentRound?.kissRecipientUserId != null || currentRound?.kissSkipped || hasLocallyDecidedKiss;

  const handleSendKiss = () => {
    if (pairPartnerId) {
      setHasLocallyDecidedKiss(true);
      kissMutation.mutate(pairPartnerId);
    }
  };

  const handleSkipKiss = () => {
    setHasLocallyDecidedKiss(true);
    skipKissMutation.mutate();
  };

  const currentSpinnerId = currentRound?.spinnerUserId ?? snapshot?.currentTurnUserId;
  const activeSpinnerMember = snapshot?.members.find((m) => m.userId === currentSpinnerId);
  const activeTargetMember = snapshot?.members.find((m) => m.userId === currentRound?.targetUserId);

  const spinnerMember = activeSpinnerMember;
  const targetMember = activeTargetMember;

  const isSelectingTarget = currentRound?.state === 'SelectingTarget';
  const isSpinner = currentRound?.spinnerUserId === currentUserId;
  const myGender = snapshot?.members.find(m => m.userId === currentUserId)?.gender;
  const isEligibleTarget = (m: GameMember) =>
    isSelectingTarget &&
    isSpinner &&
    !m.isSelf &&
    m.status === 'Active' &&
    m.gender !== myGender;

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 360, 3600],
    outputRange: ['0deg', '360deg', '3600deg'],
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.tableScrollContent}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled={true}
      keyboardShouldPersistTaps="handled"
    >
      {/* Top Bar: Back / Exit & Badges */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.leaveBtnCompact}
          onPress={onLeave}
          testID="table-leave-button"
          accessibilityLabel={t('game_leave_room', 'მაგიდის დატოვება')}
        >
          <Text style={styles.leaveBtnText}>← {t('game_leave', 'გასვლა')}</Text>
        </TouchableOpacity>

        <View style={styles.headerBadgesRow}>
          <TouchableOpacity
            style={[
              styles.chatBadge,
              unreadChatCount > 0 && styles.chatBadgeUnread
            ]}
            onPress={() => {
              setShowChatModal(true);
              setUnreadChatCount(0);
              setLatestNewMessagePreview(null);
            }}
            testID="game-chat-badge"
            accessibilityLabel={`${t('game_chat_title', 'საერთო ჩატი')}${unreadChatCount > 0 ? ` (${unreadChatCount} ${t('chat_unread', { count: unreadChatCount })})` : ''}`}
          >
            <Text style={[styles.chatBadgeText, unreadChatCount > 0 && styles.chatBadgeTextUnread]}>
              💬 {t('chat', 'ჩატი')}
            </Text>
            {unreadChatCount > 0 && (
              <View style={styles.chatUnreadRedBadge} testID="chat-unread-badge">
                <Text style={styles.chatUnreadRedBadgeText}>
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.walletBadge}
            onPress={() => setShowWalletModal(true)}
            testID="game-wallet-badge"
          >
            <Text style={styles.walletBadgeText}>
              💎 {walletQuery.data?.balance ?? 0}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.soundBadge}
            onPress={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              gameSound.setSoundEnabled(next);
            }}
            testID="toggle-sound-button"
          >
            <Text style={styles.soundBadgeText}>
              {soundEnabled ? '🔊' : '🔇'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating Incoming Chat Message Banner */}
      {latestNewMessagePreview && !showChatModal && (
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.floatingChatBanner}
          onPress={() => {
            setShowChatModal(true);
            setUnreadChatCount(0);
            setLatestNewMessagePreview(null);
          }}
          testID="floating-chat-banner"
          accessibilityRole="button"
          accessibilityLabel={`${latestNewMessagePreview.senderDisplayName}: ${latestNewMessagePreview.text}`}
        >
          <View style={styles.floatingChatDot} />
          <View style={styles.floatingChatTextContainer}>
            <Text style={styles.floatingChatSender} numberOfLines={1}>
              💬 {latestNewMessagePreview.senderDisplayName}
            </Text>
            <Text style={styles.floatingChatMessage} numberOfLines={1}>
              {latestNewMessagePreview.text}
            </Text>
          </View>
          <View style={styles.floatingChatOpenPill}>
            <Text style={styles.floatingChatOpenText}>
              {t('chat_open', 'ჩატის გახსნა')} →
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Room Title & Status Banner */}
      <View style={styles.roomInfoBar}>
        <Text style={styles.roomTitle} numberOfLines={1}>
          {snapshot?.title ?? 'Arena Table'}
        </Text>
        <Text style={styles.roomSub} numberOfLines={1}>
          {snapshot?.state === 'Playing'
            ? `მოთამაშეები: ${snapshot?.memberCount ?? 0}/${snapshot?.capacity ?? 6} · რაუნდი ${currentRound?.roundNumber ?? 1}/18`
            : t('game_table_meta_sub', {
                count: snapshot?.memberCount ?? 0,
                total: snapshot?.capacity ?? 6,
                defaultValue: `მოთამაშეები: ${snapshot?.memberCount ?? 0}/${snapshot?.capacity ?? 6} · 18 დატრიალების რეჟიმი`,
              })}
        </Text>
      </View>

      {/* Center Table & Bottle Stage */}
      <View style={styles.tableArena}>
        <View style={styles.tableCircle}>
          {/* Table Surface Felt & Arena Branding (Logo above, ARENA typography below) */}
          <View style={styles.tableFelt} pointerEvents="none">
            <View style={styles.tableOuterFeltRing} />
            <View style={styles.tableCenterFeltRing} />

            {/* Upper Logo Crest (above center bottle - never covered) */}
            <View style={styles.tableTopBrandCrest}>
              <Image
                source={logoMarkSource}
                style={styles.tableArenaLogo}
                resizeMode="contain"
              />
            </View>

            {/* Lower Typography Crest (below center bottle - never covered) */}
            <View style={styles.tableBottomBrandCrest}>
              <Text style={styles.tableArenaTitle}>ARENA</Text>
              <Text style={styles.tableArenaSubtitle}>BOTTLE CLUB</Text>
            </View>
          </View>

          {/* Circular table members with dynamic 3D lift on bottle stop */}
          {snapshot?.members.map((m: GameMember, index: number) => {
            const total = snapshot.members.length || 1;
            const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
            const radius = 125;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            const isSpinning = currentRound?.state === 'Spinning' || isBottleAnimating;
            const isCurrentSpinner = !isSpinning && m.userId === currentRound?.spinnerUserId;
            const isTarget = !isSpinning && m.userId === currentRound?.targetUserId;
            const isTurnOwner = !isSpinning && m.userId === snapshot.currentTurnUserId;
            const isSelectable = !isSpinning && isEligibleTarget(m);
            const celebration = recipientCelebrations[m.userId];
            const isElevatedSpinner = isCurrentSpinner;
            const isElevatedTarget = isTarget;
            const isElevated = isElevatedSpinner || isElevatedTarget;
            const liftAnim = isElevatedSpinner ? spinnerLiftAnim : isElevatedTarget ? targetLiftAnim : null;

            const seatTransform = liftAnim
              ? [
                  { translateX: x },
                  {
                    translateY: liftAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [y, y - 10],
                    }),
                  },
                  {
                    scale: liftAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.28],
                    }),
                  },
                ]
              : [{ translateX: x }, { translateY: y }];

            return (
              <Animated.View
                key={m.userId}
                style={[
                  styles.memberSeatWrapper,
                  {
                    transform: seatTransform,
                    zIndex: isElevated ? 60 : 10,
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={() => {
                    if (isSelectable) {
                      selectTargetMutation.mutate(m.userId);
                    } else if (!m.isSelf) {
                      setSelectedMemberId(m.userId);
                      setConfirmUnlockProfile(false);
                      setProfileUnlockError(null);
                      setDirectMessageText('');
                      setDirectRequestError(null);
                      setDirectRequestSuccess(null);
                      setSendingGiftId(null);
                      setGiftSuccessMsg(null);
                      setGiftErrorMsg(null);
                    }
                  }}
                  activeOpacity={isSelectable ? 0.6 : (m.isSelf ? 1 : 0.7)}
                  style={[
                    styles.memberSeat,
                    isTurnOwner && styles.turnOwnerSeat,
                    isElevatedSpinner && styles.elevatedSpinnerSeat,
                    isElevatedTarget && styles.elevatedTargetSeat,
                    isSelectable && styles.selectableSeat,
                    celebration && styles.celebratingSeat,
                  ]}
                  testID={`seat-${m.userId}`}
                >
                  {/* Floating Pill Badge when Elevated (Chooser / Target) */}
                  {isElevatedSpinner && (
                    <View style={styles.elevatedBadgeContainer} pointerEvents="none">
                      <View style={styles.seatFloatingBadgeAmber}>
                        <Text style={styles.seatFloatingBadgeText}>
                          🎯 {t('game_chooser_badge', 'შემრჩევი')}
                        </Text>
                      </View>
                    </View>
                  )}

                  {isElevatedTarget && (
                    <View style={styles.elevatedBadgeContainer} pointerEvents="none">
                      <View style={styles.seatFloatingBadgeRose}>
                        <Text style={styles.seatFloatingBadgeText}>
                          💘 {t('game_target_badge', 'არჩეული')}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Kiss Burst Effect when arriving at this seat */}
                  {kissRecipientBurstUserId === m.userId && (
                    <View style={styles.seatKissBurst} pointerEvents="none">
                      <Text style={styles.burstKissEmoji}>💋✨</Text>
                    </View>
                  )}

                  {celebration && (
                    <View style={styles.seatGiftSquareBadge} testID={`seat-celebration-${m.userId}`}>
                      <View style={styles.giftSquareBox}>
                        <Text style={styles.giftSquareEmoji}>{celebration.giftIcon}</Text>
                      </View>
                    </View>
                  )}

                  {m.photo ? (
                    <PrivatePhoto
                      photo={m.photo as unknown as Photo}
                      avatar={true}
                      style={[
                        styles.avatarImg,
                        isElevated && styles.avatarImgElevated,
                      ]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.avatarPlaceholder, isElevated && styles.avatarPlaceholderElevated]}>
                      <Text style={styles.avatarEmoji}>{m.gender === 'woman' ? '👩' : '👨'}</Text>
                    </View>
                  )}

                  <Text style={[styles.seatName, isElevated && styles.seatNameElevated]} numberOfLines={1} ellipsizeMode="tail">
                    {m.isSelf ? t('you', 'შენ') : m.displayName}
                  </Text>

                  {isSelectable && (
                    <View style={styles.selectableBadge}>
                      <Text style={styles.selectableBadgeText}>🎯 {t('game_select', 'არჩევა')}</Text>
                    </View>
                  )}

                  {m.status === 'Disconnected' && (
                    <Text style={styles.disconnectedBadge}>{t('game_disconnected', 'გათიშულია')}</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          })}

          {/* Active Flying Kisses from Seat to Seat across Table */}
          {activeFlyingKisses.map((fk) => {
            const midY = (fk.startY + fk.endY) / 2 - 35;
            return (
              <Animated.View
                key={fk.id}
                style={[
                  styles.flyingSeatKissWrapper,
                  {
                    transform: [
                      {
                        translateX: fk.anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [fk.startX, fk.endX],
                        }),
                      },
                      {
                        translateY: fk.anim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [fk.startY, midY, fk.endY],
                        }),
                      },
                      {
                        scale: fk.anim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0.9, 1.4, 1.1],
                        }),
                      },
                      {
                        rotate: fk.anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['-10deg', '20deg'],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents="none"
                testID={`flying-seat-kiss-${fk.id}`}
              >
                <View style={styles.flyingKissBubble}>
                  <Text style={styles.flyingKissEmoji}>💋</Text>
                  <Text style={styles.flyingKissHeartTrailing}>💖</Text>
                </View>
              </Animated.View>
            );
          })}

          {/* Active Flying Gifts from Seat to Seat (Square Box) */}
          {activeFlyingGifts.map((fg) => {
            const midY = (fg.startY + fg.endY) / 2 - 35;
            return (
              <Animated.View
                key={fg.id}
                style={[
                  styles.flyingGiftWrapper,
                  {
                    transform: [
                      {
                        translateX: fg.anim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [fg.startX, fg.endX],
                        }),
                      },
                      {
                        translateY: fg.anim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [fg.startY, midY, fg.endY],
                        }),
                      },
                      {
                        scale: fg.anim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [1.0, 1.15, 1.0],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents="none"
                testID={`flying-gift-${fg.id}`}
              >
                <View style={styles.giftSquareBox}>
                  <Text style={styles.giftSquareEmoji}>{fg.giftIcon}</Text>
                </View>
              </Animated.View>
            );
          })}

          {/* Center Bottle with 3D Glass Physics & Directional Pointer */}
          <Animated.View
            style={[
              styles.bottleContainer,
              {
                transform: [{ rotate: spinInterpolation }],
              },
            ]}
          >
            {/* Spinning Glow Halo */}
            {isBottleAnimating && (
              <Animated.View
                style={[
                  styles.bottleSpinGlowHalo,
                  {
                    opacity: bottleSpinGlow,
                  },
                ]}
              />
            )}

            {/* Bottle Shadow on Felt */}
            <View style={styles.bottleShadow} />

            {/* Realistic Bottle Structure */}
            <View style={styles.bottleVisual}>
              {/* Directional Gold Pointer Gem at Tip */}
              <View style={styles.bottlePointerGem}>
                <View style={styles.pointerArrowTip} />
              </View>

              {/* Gold Foiled Cork / Capsule */}
              <View style={styles.bottleFoilCap}>
                <View style={styles.bottleFoilRing} />
              </View>

              {/* Bottle Neck (Tapered Emerald Glass) */}
              <View style={styles.bottleNeck} />

              {/* Bottle Shoulders */}
              <View style={styles.bottleShoulders} />

              {/* Bottle Body with Glass Highlight Sheen & Luxury Arena Label */}
              <View style={styles.bottleBody}>
                {/* 3D Glass Specular Reflection Highlight */}
                <View style={styles.glassSpecularSheen} />
                <View style={styles.glassSecondarySheen} />

                {/* Luxury Label */}
                <View style={styles.bottleLabel}>
                  <Text style={styles.bottleLabelBrand}>ARENA</Text>
                  <View style={styles.bottleLabelDivider} />
                  <Text style={styles.bottleLabelVip}>VIP</Text>
                </View>

                {/* Base Rim */}
                <View style={styles.bottleBaseRim} />
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Round 1-18 Announcement Pop-up Overlay before each spin */}
        {roundAnnouncement && (
          <Animated.View
            style={[
              styles.roundAnnouncementBackdrop,
              {
                opacity: roundAnnouncementOpacity,
              },
            ]}
            pointerEvents="none"
            testID="round-announcement-overlay"
          >
            <Animated.View
              style={[
                styles.roundAnnouncementCard,
                {
                  transform: [{ scale: roundAnnouncementScale }],
                },
              ]}
            >
              <View style={styles.roundAnnouncementCrown}>
                <Text style={styles.roundAnnouncementCrownEmoji}>🍾 ✨ 🍾</Text>
              </View>
              <Text style={styles.roundAnnouncementBadge}>18 დატრიალების რეჟიმი</Text>
              <Text style={styles.roundAnnouncementMainText} testID="round-announcement-text">
                ROUND {roundAnnouncement.roundNumber} / {roundAnnouncement.totalRounds}
              </Text>
              <Text style={styles.roundAnnouncementSubText}>
                რაუნდი {roundAnnouncement.roundNumber} / {roundAnnouncement.totalRounds}
              </Text>
              <View style={styles.roundAnnouncementProgressBarTrack}>
                <View
                  style={[
                    styles.roundAnnouncementProgressBarFill,
                    {
                      width: `${Math.min(
                        100,
                        (roundAnnouncement.roundNumber / roundAnnouncement.totalRounds) * 100
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.roundAnnouncementHint}>🌀 ბოთლი ტრიალდება...</Text>
            </Animated.View>
          </Animated.View>
        )}
      </View>

      {/* Turn Action / Status Banner */}
      <Card style={styles.turnCard}>
        {snapshot?.state === 'Ended' ? (
          <View style={styles.gameEndedBanner} testID="game-ended-banner">
            <Text style={styles.gameEndedTitle}>{t('game_ended_title', '🎉 თამაში დასრულდა!')}</Text>
            <Text style={styles.gameEndedSub}>
              {t('game_ended_sub', '18 დატრიალება შესრულდა (3-3 თითოეულზე). მაგიდა დაიხურა.')}
            </Text>
          </View>
        ) : snapshot?.deadlineType === 'TurnPending' ? (
          <View style={styles.spinningBanner} testID="turn-pending-banner">
            <Text style={styles.spinningTitle}>{t('game_bottle_spinning_title', '🌀 ბოთლი ტრიალდება...')}</Text>
            <Text style={styles.spinningSub}>
              {t('game_bottle_auto_spinning', 'ბოთლი ავტომატურად ტრიალებს და შეარჩევს მოთამაშეს...')}
            </Text>
            <Text style={styles.spinningTimer}>
              ⏳ {safeTimeLeft} {t('game_seconds_short', 'წმ')}
            </Text>
          </View>
        ) : currentRound?.state === 'Spinning' ? (
          <View style={styles.spinningBanner} testID="bottle-spinning-banner">
            <Text style={styles.spinningTitle}>{t('game_bottle_spinning_title', '🌀 ბოთლი ტრიალებს...')}</Text>
            <Text style={styles.spinningSub}>
              {t('game_bottle_stopping', 'ბოთლი ჩერდება მოთამაშეზე...')}
            </Text>
          </View>
        ) : currentRound?.state === 'SelectingTarget' ? (
          isSpinner ? (
            <View style={styles.selectingTargetBanner} testID="selecting-target-spinner-banner">
              <Text style={styles.selectingTargetTitle}>{t('game_bottle_pointing_you', '🎯 ბოთლი შენზე გაჩერდა! აირჩიე მეწყვილე')}</Text>
              <Text style={styles.selectingTargetTimer}>
                {t('game_time_left', { sec: safeTimeLeft, seconds: safeTimeLeft, defaultValue: `⏳ დარჩენილია: ${safeTimeLeft} წმ` })}
              </Text>
              <Text style={styles.selectingTargetSub}>
                {t('game_choose_target_prompt', 'აირჩიე მოთამაშე შეკითხვის დასასმელად ან გამოტოვე სვლა:')}
              </Text>
              <View style={styles.targetOptionsList}>
                {snapshot?.members
                  .filter(m => !m.isSelf && m.status === 'Active' && m.gender !== myGender)
                  .map(cand => (
                    <TouchableOpacity
                      key={cand.userId}
                      style={styles.targetOptionButton}
                      disabled={selectTargetMutation.isPending || skipTargetMutation.isPending}
                      onPress={() => selectTargetMutation.mutate(cand.userId)}
                      testID={`select-target-${cand.userId}`}
                    >
                      <Text style={styles.targetOptionText}>
                        💬 {cand.displayName} ({cand.age} {t('game_years_short', 'წლ.')})
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
              <TouchableOpacity
                style={styles.skipTargetButton}
                disabled={selectTargetMutation.isPending || skipTargetMutation.isPending}
                onPress={() => skipTargetMutation.mutate()}
                testID="skip-target-button"
              >
                <Text style={styles.skipTargetButtonText}>⏭️ {t('game_skip', 'გამოტოვება (დასკიპვა)')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.selectingTargetWaiting} testID="selecting-target-spectator-banner">
              <Text style={styles.selectingTargetTitle}>
                {t('game_bottle_stopped_on', {
                  name: spinnerMember?.displayName ?? t('game_player', 'მოთამაშე'),
                  defaultValue: `⏳ ბოთლი გაჩერდა: ${spinnerMember?.displayName ?? 'მოთამაშე'}`
                })}
              </Text>
              <Text style={styles.selectingTargetTimer}>
                {t('game_time_left', { sec: safeTimeLeft, seconds: safeTimeLeft, defaultValue: `⏳ დარჩენილია: ${safeTimeLeft} წმ` })}
              </Text>
              <Text style={styles.selectingTargetSub}>
                {t('game_partner_choosing_prompt', 'მოთამაშე ირჩევს პარტნიორს შეკითხვისთვის ან გამოტოვებს სვლას.')}
              </Text>
            </View>
          )
        ) : currentRound?.state === 'QuestionAnswering' || currentRound?.state === 'QuestionRevealing' ? (
          <View style={styles.pairActiveBanner}>
            <Text style={styles.pairTitle} numberOfLines={1} ellipsizeMode="tail">
              {t('game_pair_label', {
                p1: spinnerMember?.displayName ?? t('game_player', 'მოთამაშე'),
                p2: targetMember?.displayName ?? t('game_partner', 'მეწყვილე'),
                defaultValue: `✨ ${spinnerMember?.displayName ?? 'მოთამაშე'} & ${targetMember?.displayName ?? 'მეწყვილე'}`
              })}
            </Text>
            <Text style={styles.pairProgress}>
              {t('game_question_header', { current: Number(currentRound.currentQuestionIndex ?? 0) + 1, total: 1 })}
            </Text>
          </View>
        ) : currentRound?.state === 'KissChoice' ? (
          <View style={styles.kissBanner} testID="kiss-choice-banner">
            {isPairParticipant ? (
              hasDecidedKiss ? (
                <View style={styles.kissDecidedContainer}>
                  <Text style={styles.kissTitle}>✓ {t('game_choice_recorded', '✓ შენი არჩევანი დაფიქსირებულია')}</Text>
                  <Text style={styles.kissSub}>
                    {currentRound?.kissRecipientUserId || (hasLocallyDecidedKiss && kissMutation.isSuccess)
                      ? t('game_kiss_sent_to', { name: pairPartnerName, defaultValue: `💋 კოცნა გაგზავნილია ${pairPartnerName}-სთვის!` })
                      : t('game_skipped', '⏭️ გამოტოვებულია')}
                  </Text>
                  <Text style={styles.kissTimerText}>
                    ⏳ {t('game_waiting_partner_decision', { seconds: safeTimeLeft, defaultValue: `ველოდებით მეწყვილის გადაწყვეტილებას... (${safeTimeLeft} წმ)` })}
                  </Text>
                </View>
              ) : (
                <View style={styles.kissDecidedContainer}>
                  <Text style={styles.kissTitle}>💋 {t('game_kiss_modal_title', '💋 კოცნის გაგზავნა')}</Text>
                  <Text style={styles.kissSub}>
                    {t('game_kiss_modal_sub', 'ორმხრივი კოცნა ქმნის MATCH-ს და ხსნის პირად ჩატს!')}
                  </Text>
                  <Text style={styles.kissTimerText}>
                    ⏳ {safeTimeLeft} {t('game_seconds_short', 'წმ')}
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.kissSpectatorContainer}>
                <Text style={styles.kissTitle}>{t('game_time_to_choose', '💋 არჩევანის დროა...')}</Text>
                <Text style={styles.kissTimerText}>{t('game_time_left', { sec: safeTimeLeft, seconds: safeTimeLeft, defaultValue: `⏳ დარჩენილია: ${safeTimeLeft} წმ` })}</Text>
                <Text style={styles.kissSub}>
                  {t('game_pair_deciding', {
                    p1: spinnerMember?.displayName ?? t('game_player', 'მოთამაშე'),
                    p2: targetMember?.displayName ?? t('game_partner', 'მეწყვილე'),
                    defaultValue: `${spinnerMember?.displayName ?? 'მოთამაშე'} და ${targetMember?.displayName ?? 'მეწყვილე'} აკეთებენ არჩევანს.`
                  })}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.idleBanner}>
            <Text style={styles.idleText}>{t('game_idle_status', 'თამაში აქტიურია · მოემზადეთ შემდეგი სვლისთვის')}</Text>
          </View>
        )}
      </Card>

      {/* Question Card (If in question phase) */}
      {/* Soft Question Modal Overlay covering the table */}
      <Modal
        visible={
          (currentRound?.state === 'QuestionAnswering' || currentRound?.state === 'QuestionRevealing') &&
          !showWalletModal &&
          !showMatchModal &&
          !selectedMemberId &&
          !showChatModal
        }
        transparent={true}
        animationType="fade"
      >
        <View style={styles.questionModalOverlay}>
          <Card style={styles.questionModalCard}>
            {/* Header with Countdown and Question Count */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.questionTimerPill}>
                <Text style={styles.questionTimerPillText}>
                  ⏳ {timeLeft} {t('game_seconds_short', 'წმ')}
                </Text>
              </View>
              <View style={styles.questionIndexPill}>
                <Text style={styles.questionIndexPillText}>
                  {t('game_question_header', { current: Number(currentRound?.currentQuestionIndex ?? 0) + 1, total: 1 })}
                </Text>
              </View>
            </View>

            <Text style={styles.modalPairTitle}>
              {t('game_pair_label', {
                p1: spinnerMember?.displayName ?? t('game_player', 'მოთამაშე'),
                p2: targetMember?.displayName ?? t('game_partner', 'მეწყვილე'),
                defaultValue: `✨ წყვილი: ${spinnerMember?.displayName ?? 'მოთამაშე'} & ${targetMember?.displayName ?? 'მეწყვილე'}`
              })}
            </Text>

            <ScrollView
              style={styles.modalQuestionScroll}
              contentContainerStyle={styles.modalQuestionScrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {isParticipant ? (
                // Active Pair Member View
                currentRound?.state === 'QuestionRevealing' ? (
                  // Reveal View
                  <View style={styles.revealBox}>
                    <Text style={styles.revealTitle}>
                      {currentRound.revealedSelections?.slice(-1)[0]?.isSuppressed
                        ? t('game_question_skipped', '⏳ კითხვა გამოტოვებულია')
                        : currentRound.revealedSelections?.slice(-1)[0]?.isMatch
                        ? t('game_question_matched', '🎉 თანხვედრა! ორივემ ერთი და იგივე აირჩიეთ!')
                        : t('game_question_differed', '✨ განსხვავებული ხედვები!')}
                    </Text>
                    <Text style={styles.commentaryText}>
                      {currentRound.revealedSelections?.slice(-1)[0]?.fallbackCommentary ?? ''}
                    </Text>
                  </View>
                ) : (
                  // Answering View
                  <View style={styles.questionBox}>
                    <Text style={styles.questionText}>
                      {currentRound?.currentQuestion?.questionText ?? t('question', 'კითხვა')}
                    </Text>

                    {/* Option Buttons */}
                    <View style={styles.optionsList}>
                      {currentRound?.currentQuestion?.options.map((opt: string, optIdx: number) => {
                        const isSelected =
                          selectedOptionIndex === optIdx ||
                          currentRound?.callerPendingAnswer === optIdx;

                        return (
                          <TouchableOpacity
                            key={`opt-${optIdx}`}
                            style={[
                              styles.optionButton,
                              isSelected && styles.optionButtonSelected,
                            ]}
                            disabled={answerMutation.isPending || currentRound?.callerPendingAnswer !== null}
                            onPress={() => {
                              setSelectedOptionIndex(optIdx);
                              if (currentRound) {
                                answerMutation.mutate({
                                  roundId: currentRound.roundId,
                                  qIndex: Number(currentRound.currentQuestionIndex),
                                  option: optIdx,
                                });
                              }
                            }}
                            testID={`question-option-${optIdx}`}
                          >
                            <View style={styles.optionRow}>
                              <View
                                style={[
                                  styles.optionIndexBadge,
                                  isSelected && styles.optionIndexBadgeSelected,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.optionIndexText,
                                    isSelected && styles.optionIndexTextSelected,
                                  ]}
                                >
                                  {['A', 'B', 'C', 'D'][optIdx] ?? (optIdx + 1)}
                                </Text>
                              </View>
                              <Text
                                style={[
                                  styles.optionButtonText,
                                  isSelected && styles.optionButtonTextSelected,
                                ]}
                              >
                                {isSelected ? '✓ ' : ''}{opt}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Skip / Locked Status */}
                    {currentRound?.callerPendingAnswer !== null ? (
                      <View style={styles.lockedNotice}>
                        <Text style={styles.lockedNoticeText}>
                          {t('game_waiting_partner_choice', '🔒 არჩევანი დაფიქსირებულია. ველოდებით მეწყვილის პასუხს...')}
                        </Text>
                      </View>
                    ) : (
                      <Button
                        variant="secondary"
                        title={t('game_skip', 'გამოტოვება')}
                        onPress={() => {
                          if (currentRound) {
                            skipMutation.mutate({
                              roundId: currentRound.roundId,
                              qIndex: Number(currentRound.currentQuestionIndex),
                            });
                          }
                        }}
                        busy={skipMutation.isPending}
                        style={styles.skipBtn}
                        testID="skip-question-button"
                      />
                    )}
                  </View>
                )
              ) : (
                // Spectator View (Other room members)
                <View style={styles.spectatorBox}>
                  <Text style={styles.spectatorTitle}>
                    👀 {t('game_question_header', { current: Number(currentRound?.currentQuestionIndex ?? 0) + 1, total: 1 })}
                  </Text>
                  <Text style={styles.spectatorSub}>
                    {spinnerMember?.displayName ?? t('game_player', 'მოთამაშე')} და {targetMember?.displayName ?? t('game_partner', 'მეწყვილე')} {t('game_answering_question', 'პასუხობენ კითხვას.')}
                  </Text>
                  {currentRound?.state === 'QuestionRevealing' && (
                    <View style={styles.spectatorReveal}>
                      <Text style={styles.spectatorRevealStatus}>
                        {currentRound.revealedSelections?.slice(-1)[0]?.isSuppressed
                          ? t('game_question_skipped', 'კითხვა გამოტოვებულია')
                          : currentRound.revealedSelections?.slice(-1)[0]?.isMatch
                          ? t('game_question_pair_matched', '🎉 წყვილს ჰქონდა თანხვედრა!')
                          : t('game_question_pair_differed', '✨ წყვილს ჰქონდა განსხვავებული არჩევანი')}
                      </Text>
                      {Boolean(currentRound.revealedSelections?.slice(-1)[0]?.fallbackCommentary) && (
                        <Text style={styles.spectatorCommentary}>
                          {currentRound.revealedSelections?.slice(-1)[0]?.fallbackCommentary}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </Card>
        </View>
      </Modal>

      {/* Round Summary Commentary (for active pair) */}
      {isParticipant && Boolean(currentRound?.summaryCommentary) && (
        <Card style={styles.summaryCard} testID="round-summary-card">
          <Text style={styles.summaryCardTitle}>{t('game_question_round_summary', '🤖 რაუნდის შეჯამება')}</Text>
          <Text style={styles.summaryCardText}>{currentRound.summaryCommentary}</Text>
        </Card>
      )}

      {/* Kiss Choice Modal Overlay (When Question Phase ends and Kiss Choice starts) */}
      <Modal
        visible={
          currentRound?.state === 'KissChoice' &&
          isPairParticipant &&
          !hasDecidedKiss &&
          !hasLocallyDecidedKiss &&
          !showWalletModal &&
          !showMatchModal &&
          !showChatModal &&
          !selectedMemberId
        }
        transparent={true}
        animationType="fade"
        onRequestClose={handleSkipKiss}
      >
        <View style={styles.kissModalOverlay}>
          <Card style={styles.kissModalCard} testID="kiss-choice-modal">
            {/* Header: Countdown timer */}
            <View style={styles.kissModalHeaderRow}>
              <View style={styles.kissModalTimerBadge}>
                <Text style={styles.kissModalTimerText}>
                  ⏳ {safeTimeLeft} {t('game_seconds_short', 'წმ')}
                </Text>
              </View>
            </View>

            {/* Avatar & Partner Info */}
            <View style={styles.kissModalAvatarContainer}>
              <View style={styles.kissModalAvatarRing}>
                {pairPartnerMember?.photo ? (
                  <PrivatePhoto
                    photo={pairPartnerMember.photo as unknown as Photo}
                    style={styles.kissModalAvatarImage}
                  />
                ) : (
                  <Text style={styles.kissModalAvatarEmoji}>
                    {pairPartnerMember?.gender === 'Female' ? '👩' : '👨'}
                  </Text>
                )}
              </View>
              <Text style={styles.kissModalPartnerName} numberOfLines={1}>
                {pairPartnerName}
              </Text>
            </View>

            <Text style={styles.kissModalTitle}>
              {t('game_kiss_modal_title', '💋 კოცნის გაგზავნა')}
            </Text>
            <Text style={styles.kissModalSub}>
              {t('game_kiss_modal_sub', 'ორმხრივი კოცნა ქმნის MATCH-ს და ხსნის პირად ჩატს!')}
            </Text>

            {/* Actions: Send Kiss or Skip */}
            <View style={styles.kissModalActionsRow}>
              <Button
                variant="primary"
                title={`💋 ${t('game_send_kiss', 'კოცნის გაგზავნა')}`}
                onPress={handleSendKiss}
                busy={kissMutation.isPending}
                disabled={kissMutation.isPending || skipKissMutation.isPending}
                style={styles.kissModalSendBtn}
                testID="send-kiss-partner-button"
              />
              <Button
                variant="secondary"
                title={`⏭️ ${t('game_skip_turn', 'გამოტოვება')}`}
                onPress={handleSkipKiss}
                disabled={kissMutation.isPending || skipKissMutation.isPending}
                style={styles.kissModalSkipBtn}
                testID="skip-kiss-button"
              />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Match Celebration Modal */}
      <Modal
        visible={showMatchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMatchModal(false)}
      >
        <View style={styles.matchModalOverlay}>
          <Card style={styles.matchModalContent}>
            <Text style={styles.matchModalEmoji}>🎉 💋 🎉</Text>
            <Text style={styles.matchModalTitle}>{t('game_its_a_match', 'ეს არის Match!')}</Text>
            <Text style={styles.matchModalSubtitle}>
              {t('game_match_success_desc', { name: matchedPeerName, defaultValue: `შენ და ${matchedPeerName}-მა ერთმანეთს კოცნა გაუგზავნეთ!` })}
            </Text>
            <Text style={styles.matchModalInfo}>
              {t('game_match_saved_note', 'თქვენი კავშირი შეინახა Matches განყოფილებაში.')}
            </Text>
            <Button
              variant="primary"
              title={t('game_awesome', 'შესანიშნავია ✨')}
              onPress={() => setShowMatchModal(false)}
              style={styles.matchModalBtn}
              testID="close-match-modal-button"
            />
          </Card>
        </View>
      </Modal>

      {/* Game Ended Modal */}
      <Modal
        visible={snapshot?.state === 'Ended'}
        transparent={true}
        animationType="slide"
        onRequestClose={onLeave}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.endedModalContent} testID="game-ended-modal">
            <Text style={styles.endedModalEmoji}>🎉 🍾 💋</Text>
            <Text style={styles.endedModalTitle}>{t('game_ended_title', 'თამაში დასრულდა!')}</Text>
            <Text style={styles.endedModalSubtitle}>
              {t('game_ended_desc', '18 დატრიალება წარმატებით დასრულდა. მაგიდა დაიხურა.')}
            </Text>
            <Text style={styles.endedModalInstructions}>
              {t('game_ended_kiss_prompt', 'შეგიძლია კოცნა გაუგზავნო მაგიდის ნებისმიერ მონაწილეს. ფანჯრის დახურვის შემდეგ მაგიდას დატოვებ.')}
            </Text>

            <ScrollView style={styles.endedMembersList} nestedScrollEnabled>
              {snapshot?.members
                .filter(m => !m.isSelf)
                .map(member => {
                  const alreadyKissed = sentPostGameKissUserIds.includes(member.userId);
                  const isSubmitting = postGameKissMutation.isPending && (postGameKissMutation.variables as string) === member.userId;

                  return (
                    <View key={member.userId} style={styles.endedMemberRow} testID={`ended-member-row-${member.userId}`}>
                      <View style={styles.endedMemberInfo}>
                        <View style={styles.endedMemberAvatar}>
                          {member.photo ? (
                            <PrivatePhoto
                              photo={member.photo as unknown as Photo}
                              avatar={true}
                              style={styles.avatarImg}
                              resizeMode="cover"
                            />
                          ) : (
                            <Text style={{ fontSize: 20 }}>{member.gender === 'woman' ? '👩' : '👨'}</Text>
                          )}
                        </View>
                        <View>
                          <Text style={styles.endedMemberName}>{member.displayName}, {member.age}</Text>
                          <Text style={styles.endedMemberSub}>{member.gender === 'woman' ? t('woman', 'ქალი') : t('man', 'მამაკაცი')}</Text>
                        </View>
                      </View>

                      <Button
                        variant={alreadyKissed ? 'secondary' : 'primary'}
                        title={alreadyKissed ? t('game_kiss_already_sent', '✓ გაგზავნილია') : t('game_kiss_btn', '💋 აკოცე')}
                        disabled={alreadyKissed || isSubmitting}
                        busy={isSubmitting}
                        onPress={() => postGameKissMutation.mutate(member.userId)}
                        style={styles.endedKissBtn}
                        testID={`post-game-kiss-${member.userId}`}
                      />
                    </View>
                  );
                })}
            </ScrollView>

            <Button
              variant="danger"
              title={t('game_close_and_leave', '✕ დახურვა და მაგიდის დატოვება')}
              onPress={onLeave}
              style={{ marginTop: 16 }}
              testID="close-ended-game-modal-button"
            />
          </Card>
        </View>
      </Modal>

      {/* Wallet Modal */}
      <WalletModal
        visible={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        gameApi={gameApi}
      />


      {/* Member Profile Modal */}
      <Modal
        visible={!!selectedMemberId}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMemberId(null)}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.memberProfileModalContent}>
            {memberProfileQuery.isLoading ? (
              <Text style={styles.loadingProfileText}>{t('game_loading_profile', 'იტვირთება პროფილი...')}</Text>
            ) : memberProfileQuery.data ? (
              <ScrollView style={{ maxHeight: 460 }}>
                <View style={styles.memberProfileHeader}>
                  <Text style={styles.memberProfileTitle}>
                    {memberProfileQuery.data.displayName}, {memberProfileQuery.data.age}
                  </Text>
                  <Text style={styles.memberProfileCity}>📍 {memberProfileQuery.data.city}</Text>
                </View>

                {memberProfileQuery.data.photos && memberProfileQuery.data.photos.length > 0 && (
                  <View style={styles.profilePhotoContainer}>
                    <PrivatePhoto
                      photo={memberProfileQuery.data.photos[0] as unknown as Photo}
                      style={styles.profileModalPhoto}
                      resizeMode="cover"
                    />
                  </View>
                )}

                <Text style={styles.profileBioTitle}>{t('game_bio_title', 'ბიოგრაფია')}</Text>
                <Text style={styles.profileBioText}>{memberProfileQuery.data.bio || t('game_no_info', 'ინფორმაცია არ არის')}</Text>

                {memberProfileQuery.data.isFullAccess ? (
                  <View style={styles.fullProfileSection}>
                    <Text style={styles.unlockedBadge}>{t('game_full_profile_unlocked', '✓ სრული პროფილი გახსნილია')}</Text>

                    {/* Arena Statistics - Exclusively visible here on the game table when full profile is unlocked */}
                    <View style={styles.arenaStatsBox} testID="arena-unlocked-stats">
                      <Text style={styles.arenaStatsTitle}>{t('game_arena_stats', '📊 არენის სტატისტიკა')}</Text>
                      <View style={styles.arenaStatsRow}>
                        <View style={styles.arenaStatItem}>
                          <Text style={styles.arenaStatIcon}>💋</Text>
                          <Text style={styles.arenaStatValue}>
                            {memberProfileQuery.data.kissesReceivedCount ?? 0}
                          </Text>
                          <Text style={styles.arenaStatLabel}>{t('game_kisses_received', 'მიღებული კოცნა')}</Text>
                        </View>
                        <View style={styles.arenaStatItem}>
                          <Text style={styles.arenaStatIcon}>🎁</Text>
                          <Text style={styles.arenaStatValue}>
                            {memberProfileQuery.data.giftsReceivedCount ?? 0}
                          </Text>
                          <Text style={styles.arenaStatLabel}>{t('game_gifts_received', 'მიღებული საჩუქარი')}</Text>
                        </View>
                      </View>
                    </View>

                    {!!memberProfileQuery.data.relationshipGoal && (
                      <Text style={styles.profileGoalText}>
                        🎯 {t('game_relationship_goal', 'მიზანი')}: {memberProfileQuery.data.relationshipGoal}
                      </Text>
                    )}
                    {memberProfileQuery.data.interests && memberProfileQuery.data.interests.length > 0 && (
                      <View style={styles.interestsContainer}>
                        <Text style={styles.interestsTitle}>{t('game_interests_label', 'ინტერესები:')}</Text>
                        <View style={styles.interestsRow}>
                          {memberProfileQuery.data.interests.map((tag: string) => (
                            <View key={tag} style={styles.interestChip}>
                              <Text style={styles.interestText}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.lockedProfileSection}>
                    <Text style={styles.lockedProfileNotice}>
                      {t('game_profile_locked_desc', '🔒 სრული პროფილი (ინტერესები, მიზნები, ფოტოები) დახურულია')}
                    </Text>

                    {!confirmUnlockProfile ? (
                      <Button
                        variant="primary"
                        title={t('game_unlock_profile_btn', '💎 25 - სრული პროფილის გახსნა')}
                        onPress={() => setConfirmUnlockProfile(true)}
                        style={{ marginTop: 8 }}
                        testID="unlock-profile-button"
                      />
                    ) : (
                      <View style={styles.confirmUnlockBox}>
                        <Text style={styles.confirmUnlockText}>
                          {t('game_unlock_profile_prompt', {
                            name: memberProfileQuery.data.displayName,
                            defaultValue: `25 კრისტალად გაიხსნება ${memberProfileQuery.data.displayName}-ის სრული პროფილი. მომხმარებელი მიიღებს შეტყობინებას, რომ მის პროფილს ნახულობთ.`
                          })}
                        </Text>
                        {profileUnlockError ? (
                          <Text style={styles.unlockErrorMsg}>{profileUnlockError}</Text>
                        ) : null}
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                          <Button
                            variant="secondary"
                            title={t('cancel', 'გაუქმება')}
                            disabled={unlockingProfile}
                            onPress={() => setConfirmUnlockProfile(false)}
                            style={{ flex: 1 }}
                          />
                          <Button
                            variant="primary"
                            title={t('confirm', 'დადასტურება')}
                            busy={unlockingProfile}
                            onPress={async () => {
                              if (!selectedMemberId) return;
                              setUnlockingProfile(true);
                              setProfileUnlockError(null);
                              try {
                                await gameApi.unlockProfile(selectedMemberId, Crypto.randomUUID());
                                await cache.invalidateQueries({ queryKey: ['game-wallet'] });
                                await cache.invalidateQueries({ queryKey: ['game-member-profile', selectedMemberId] });
                                setConfirmUnlockProfile(false);
                              } catch (err: unknown) {
                                const e = err as { message?: string; status?: number };
                                if (e.status === 400 && e.message?.includes('insufficient')) {
                                  setProfileUnlockError(t('game_direct_request_err_funds', 'არასაკმარისი კრისტალები (საჭიროა 25 💎).'));
                                } else {
                                  setProfileUnlockError(t('game_profile_unlock_failed', 'პროფილის გახსნა ვერ მოხერხდა.'));
                                }
                              } finally {
                                setUnlockingProfile(false);
                              }
                            }}
                            style={{ flex: 1 }}
                            testID="confirm-unlock-profile-button"
                          />
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Gift Sending Section (1 to 500 Crystals) */}
                <View style={styles.giftSection} testID="member-gift-section">
                  <View style={styles.giftSectionHeader}>
                    <Text style={styles.giftSectionTitle}>{t('game_send_gift_title', '🎁 საჩუქრის გაგზავნა')}</Text>
                    <Text style={styles.giftSectionBalance}>
                      💎 {walletQuery.data?.balance ?? 0}
                    </Text>
                  </View>
                  <Text style={styles.giftSectionSub}>
                    {t('game_gift_prompt', {
                      name: memberProfileQuery.data.displayName,
                      defaultValue: `აჩუქე ${memberProfileQuery.data.displayName}-ს საჩუქარი (1 - 500 💎):`
                    })}
                  </Text>
                  {giftSuccessMsg ? (
                    <View style={styles.giftSuccessBadge}>
                      <Text style={styles.giftSuccessText}>{giftSuccessMsg}</Text>
                    </View>
                  ) : null}
                  {giftErrorMsg ? (
                    <Text style={styles.giftErrorText}>{giftErrorMsg}</Text>
                  ) : null}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.giftCatalogScroll}
                  >
                    {giftCatalogQuery.data?.map((g) => {
                      const price = Number(g.price);
                      const canAfford = Number(walletQuery.data?.balance ?? 0) >= price;
                      const isSending = sendingGiftId === g.id;
                      return (
                        <TouchableOpacity
                          key={g.id}
                          style={[
                            styles.giftCard,
                            !canAfford && styles.giftCardDisabled,
                            isSending && styles.giftCardSending,
                          ]}
                          disabled={!canAfford || !!sendingGiftId}
                          onPress={() => handleSendGift(g.id)}
                          activeOpacity={0.7}
                          testID={`send-gift-${g.id}`}
                        >
                          <Text style={styles.giftCardIcon}>{g.icon}</Text>
                          <Text style={styles.giftCardName} numberOfLines={1}>{g.name}</Text>
                          <View style={styles.giftCardCostBadge}>
                            <Text style={styles.giftCardCostText}>💎 {price}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Direct Match Request Section (125 Crystals) */}
                <View style={styles.directRequestSection}>
                  <View style={styles.directRequestHeader}>
                    <Text style={styles.directRequestSectionTitle}>{t('game_direct_request_title', '💌 მეჩის რექუესტი (125 💎)')}</Text>
                  </View>
                  <Text style={styles.directRequestDesc}>
                    {t('game_direct_request_desc', 'გაუგზავნე მეჩის რექუესტი პირადი წერილით (1 მესიჯი). მეორე მხარეს გამოუჩნდება თანხმობის და უარყოფის ღილაკები.')}
                  </Text>

                  {selectedMemberId && snapshot?.sentDirectRequestUserIds?.includes(selectedMemberId) ? (
                    <View style={styles.directRequestSentBadge}>
                      <Text style={styles.directRequestSentText}>{t('game_direct_request_sent', '✓ რექუესტი უკვე გაგზავნილია (პასუხის მოლოდინში)')}</Text>
                    </View>
                  ) : (
                    <>
                      <TextInput
                        style={styles.directRequestInput}
                        placeholder={t('game_write_first_message', 'დაწერე პირველი შეტყობინება...')}
                        placeholderTextColor="#94a3b8"
                        value={directMessageText}
                        onChangeText={text => {
                          setDirectMessageText(text);
                          setDirectRequestError(null);
                        }}
                        maxLength={300}
                        multiline
                        testID="direct-request-message-input"
                      />
                      {directRequestError ? (
                        <Text style={styles.directRequestErrorText}>{directRequestError}</Text>
                      ) : null}
                      {directRequestSuccess ? (
                        <Text style={styles.directRequestSuccessText}>{directRequestSuccess}</Text>
                      ) : null}
                      <Button
                        variant="primary"
                        title={
                          walletQuery.data?.balance != null && Number(walletQuery.data.balance) < 125
                            ? t('game_direct_request_insufficient', { balance: walletQuery.data.balance, defaultValue: `💎 125 - არასაკმარისი ბალანსი (${walletQuery.data.balance} 💎)` })
                            : t('game_direct_request_send_btn', '💌 რექუესტის გაგზავნა (125 💎)')
                        }
                        disabled={
                          !directMessageText.trim() ||
                          (walletQuery.data?.balance != null && Number(walletQuery.data.balance) < 125) ||
                          isSendingDirectRequest
                        }
                        busy={isSendingDirectRequest}
                        onPress={async () => {
                          if (!selectedMemberId || !directMessageText.trim()) return;
                          setIsSendingDirectRequest(true);
                          setDirectRequestError(null);
                          try {
                            await gameApi.sendDirectMatchRequest({
                              targetUserId: selectedMemberId,
                              message: directMessageText.trim(),
                              idempotencyKey: Crypto.randomUUID(),
                              roomId,
                            });
                            await cache.invalidateQueries({ queryKey: ['game-wallet'] });
                            await cache.invalidateQueries({ queryKey: ['game-room-snapshot', roomId] });
                            setDirectRequestSuccess(t('game_direct_request_success', '💌 რექუესტი წარმატებით გაიგზავნა!'));
                            setDirectMessageText('');
                          } catch (err: unknown) {
                            const e = err as { message?: string; status?: number };
                            if (e.status === 400 && e.message?.includes('insufficient')) {
                              setDirectRequestError(t('game_direct_request_err_funds', 'არასაკმარისი კრისტალები (საჭიროა 125 💎).'));
                            } else if (e.status === 409) {
                              setDirectRequestError(t('game_direct_request_err_already', 'რექუესტი უკვე გაგზავნილია.'));
                            } else {
                              setDirectRequestError(t('game_direct_request_err_failed', 'რექუესტის გაგზავნა ვერ მოხერხდა.'));
                            }
                          } finally {
                            setIsSendingDirectRequest(false);
                          }
                        }}
                        style={{ marginTop: 8 }}
                        testID="send-direct-request-button"
                      />
                    </>
                  )}
                </View>
              </ScrollView>
            ) : (
              <Text style={styles.loadingProfileText}>{t('game_profile_unavailable', 'პროფილი მიუწვდომელია')}</Text>
            )}

            <Button
              variant="secondary"
              title={t('close', 'დახურვა')}
              onPress={() => {
                setSelectedMemberId(null);
                setConfirmUnlockProfile(false);
                setSendingGiftId(null);
                setGiftSuccessMsg(null);
                setGiftErrorMsg(null);
              }}
              style={{ marginTop: 12 }}
              testID="close-member-modal-button"
            />
          </Card>
        </View>
      </Modal>

      {/* Incoming Direct Match Request Modal (for Recipient) */}
      {(() => {
        const activeIncoming = snapshot?.pendingDirectRequests && snapshot.pendingDirectRequests.length > 0
          ? snapshot.pendingDirectRequests[0]
          : null;
        if (!activeIncoming) return null;

        return (
          <Modal
            visible={true}
            transparent
            animationType="slide"
            onRequestClose={() => {}}
          >
            <View style={styles.modalOverlay}>
              <Card style={styles.incomingRequestModalContent}>
                <Text style={styles.matchModalEmoji}>💌</Text>
                <Text style={styles.matchModalTitle}>{t('game_incoming_request_title', 'ახალი მეჩის რექუესტი!')}</Text>
                <Text style={styles.incomingSenderText}>
                  {t('game_incoming_request_subtitle', { name: activeIncoming.senderDisplayName, age: activeIncoming.senderAge, defaultValue: `${activeIncoming.senderDisplayName}, ${activeIncoming.senderAge} წლის` })}
                </Text>

                <View style={styles.incomingMessageBox}>
                  <Text style={styles.incomingMessageLabel}>{t('game_incoming_message_label', 'შეტყობინება:')}</Text>
                  <Text style={styles.incomingMessageText}>
                    "{activeIncoming.message}"
                  </Text>
                </View>

                <Text style={styles.incomingHintText}>
                  {t('game_incoming_accept_note', 'თანხმობის შემთხვევაში შეიქმნება მეჩი და ჩატი გაიხსნება!')}
                </Text>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' }}>
                  <Button
                    variant="secondary"
                    title={t('game_decline', '✕ უარყოფა')}
                    disabled={isRespondingRequest}
                    busy={isRespondingRequest && respondingAction === 'Decline'}
                    onPress={async () => {
                      setIsRespondingRequest(true);
                      setRespondingAction('Decline');
                      try {
                        await gameApi.respondDirectMatchRequest(activeIncoming.requestId, { action: 'Decline' });
                        await cache.invalidateQueries({ queryKey: ['game-room-snapshot', roomId] });
                      } catch {
                        await cache.invalidateQueries({ queryKey: ['game-room-snapshot', roomId] });
                      } finally {
                        setIsRespondingRequest(false);
                        setRespondingAction(null);
                      }
                    }}
                    style={{ flex: 1 }}
                    testID="decline-direct-request-button"
                  />
                  <Button
                    variant="primary"
                    title={t('game_accept', '✓ თანხმობა')}
                    disabled={isRespondingRequest}
                    busy={isRespondingRequest && respondingAction === 'Accept'}
                    onPress={async () => {
                      setIsRespondingRequest(true);
                      setRespondingAction('Accept');
                      try {
                        await gameApi.respondDirectMatchRequest(activeIncoming.requestId, { action: 'Accept' });
                        await cache.invalidateQueries({ queryKey: ['game-room-snapshot', roomId] });
                        setMatchedPeerName(activeIncoming.senderDisplayName);
                        setShowMatchModal(true);
                      } catch {
                        await cache.invalidateQueries({ queryKey: ['game-room-snapshot', roomId] });
                      } finally {
                        setIsRespondingRequest(false);
                        setRespondingAction(null);
                      }
                    }}
                    style={{ flex: 1 }}
                    testID="accept-direct-request-button"
                  />
                </View>
              </Card>
            </View>
          </Modal>
        );
      })()}

      {/* Room Chat Modal */}
      <RoomChatModal
        visible={showChatModal}
        onClose={() => {
          setShowChatModal(false);
          const msgs = roomMessagesQuery.data ?? [];
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg) {
            lastViewedMessageIdRef.current = lastMsg.id;
          }
          setUnreadChatCount(0);
          setLatestNewMessagePreview(null);
        }}
        roomId={roomId}
        gameApi={gameApi}
        currentUserId={currentUserId}
        members={snapshot?.members ?? []}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  tableScrollContent: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  leaveBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  leaveBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
  },
  headerBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roomInfoBar: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    width: '100%',
  },
  roomTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f8fafc',
  },
  roomSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  leaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tableArena: {
    height: 320,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    position: 'relative',
    width: '100%',
  },
  memberSeatWrapper: {
    position: 'absolute',
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  elevatedSpinnerSeat: {
    borderColor: '#F59E0B',
    borderWidth: 3.5,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.95,
    shadowRadius: 18,
    elevation: 20,
    backgroundColor: '#1E1B2E',
  },
  elevatedTargetSeat: {
    borderColor: '#F43F5E',
    borderWidth: 3.5,
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.95,
    shadowRadius: 18,
    elevation: 20,
    backgroundColor: '#2E1026',
  },
  avatarImgElevated: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholderElevated: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  seatNameElevated: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 10.5,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  elevatedBadgeContainer: {
    position: 'absolute',
    top: -24,
    left: -24,
    right: -24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 90,
  },
  seatFloatingBadgeAmber: {
    backgroundColor: 'rgba(245, 158, 11, 0.95)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  seatFloatingBadgeRose: {
    backgroundColor: 'rgba(244, 63, 94, 0.95)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FECDD3',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  seatFloatingBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  seatKissBurst: {
    position: 'absolute',
    top: -12,
    right: -12,
    backgroundColor: '#E11D48',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#FF2E93',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 95,
  },
  burstKissEmoji: {
    fontSize: 12,
  },
  flyingSeatKissWrapper: {
    position: 'absolute',
    width: 60,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  flyingKissBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(225, 29, 72, 0.95)',
    borderRadius: 18,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: '#FFE4E6',
    shadowColor: '#FF2E93',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.65,
    shadowRadius: 10,
    elevation: 10,
  },
  flyingKissEmoji: {
    fontSize: 24,
  },
  flyingKissHeartTrailing: {
    fontSize: 14,
    marginLeft: 3,
  },
  roundAnnouncementBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 7, 15, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    padding: 16,
    borderRadius: 20,
  },
  roundAnnouncementCard: {
    backgroundColor: '#0F172A',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#F59E0B',
    paddingVertical: 20,
    paddingHorizontal: 26,
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.65,
    shadowRadius: 18,
    elevation: 20,
    minWidth: 260,
    maxWidth: 320,
  },
  roundAnnouncementCrown: {
    marginBottom: 6,
  },
  roundAnnouncementCrownEmoji: {
    fontSize: 24,
  },
  roundAnnouncementBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  roundAnnouncementMainText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    textAlign: 'center',
  },
  roundAnnouncementSubText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FDE68A',
    marginTop: 4,
    marginBottom: 12,
  },
  roundAnnouncementProgressBarTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  roundAnnouncementProgressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  roundAnnouncementHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
  },
  spinningTimer: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
    marginTop: 4,
  },
  tableCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#070b14',
    borderWidth: 3,
    borderColor: 'rgba(217, 119, 6, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  tableFelt: {
    position: 'absolute',
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableOuterFeltRing: {
    position: 'absolute',
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.2)',
  },
  tableCenterFeltRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.18)',
    borderStyle: 'dashed',
  },
  tableTopBrandCrest: {
    position: 'absolute',
    top: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableBottomBrandCrest: {
    position: 'absolute',
    bottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableArenaLogo: {
    width: 32,
    height: 32,
  },
  tableArenaTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#F59E0B',
    textShadowColor: 'rgba(245, 158, 11, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tableArenaSubtitle: {
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 2.5,
    color: 'rgba(254, 240, 138, 0.6)',
    marginTop: 1,
  },
  memberSeat: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.soft,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  turnOwnerSeat: {
    borderColor: theme.colors.primary,
    borderWidth: 3,
  },
  spinnerSeat: {
    borderColor: '#F59E0B',
    borderWidth: 3,
  },
  targetSeat: {
    borderColor: theme.colors.match,
    borderWidth: 3,
  },
  avatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.soft,
  },
  avatarEmoji: {
    fontSize: 22,
  },
  seatName: {
    position: 'absolute',
    bottom: -18,
    fontSize: 10,
    fontWeight: '600',
    color: '#f1f5f9',
    width: 76,
    textAlign: 'center',
  },
  disconnectedBadge: {
    position: 'absolute',
    top: -12,
    fontSize: 8,
    color: theme.colors.danger,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 3,
    borderRadius: 4,
  },
  bottleContainer: {
    width: 86,
    height: 86,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bottleSpinGlowHalo: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  bottleShadow: {
    position: 'absolute',
    width: 32,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    bottom: -2,
    zIndex: -1,
  },
  bottleVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bottlePointerGem: {
    alignItems: 'center',
    marginBottom: 1,
  },
  pointerArrowTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#F59E0B',
  },
  bottleFoilCap: {
    width: 9,
    height: 10,
    backgroundColor: '#D97706',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderWidth: 1,
    borderColor: '#F59E0B',
    alignItems: 'center',
  },
  bottleFoilRing: {
    width: 9,
    height: 2,
    backgroundColor: '#FEF08A',
    marginTop: 3,
  },
  bottleNeck: {
    width: 8,
    height: 12,
    backgroundColor: '#064e3b',
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  bottleShoulders: {
    width: 24,
    height: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#04382a',
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  bottleBody: {
    width: 28,
    height: 38,
    backgroundColor: '#022c22',
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    position: 'relative',
  },
  glassSpecularSheen: {
    position: 'absolute',
    left: 2.5,
    top: 0,
    bottom: 0,
    width: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 1.25,
  },
  glassSecondarySheen: {
    position: 'absolute',
    right: 2.5,
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 1,
  },
  bottleLabel: {
    width: 20,
    paddingVertical: 1.5,
    backgroundColor: '#18181b',
    borderRadius: 2.5,
    borderWidth: 0.8,
    borderColor: '#D97706',
    alignItems: 'center',
  },
  bottleLabelBrand: {
    fontSize: 5,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  bottleLabelDivider: {
    width: 12,
    height: 0.5,
    backgroundColor: '#D97706',
    marginVertical: 0.5,
  },
  bottleLabelVip: {
    fontSize: 4.5,
    fontWeight: '700',
    color: '#FEF08A',
    letterSpacing: 0.5,
  },
  bottleBaseRim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#011c16',
  },
  bottleEmoji: {
    fontSize: 20,
  },
  turnCard: {
    padding: 16,
    marginBottom: 12,
  },
  turnPrompt: {
    alignItems: 'center',
  },
  turnPromptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  turnPromptSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginBottom: 12,
    textAlign: 'center',
  },
  spinButton: {
    width: '100%',
  },
  turnWaiting: {
    alignItems: 'center',
  },
  turnWaitingText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  turnWaitingSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 4,
  },
  spinningBanner: {
    alignItems: 'center',
  },
  spinningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  spinningSub: {
    fontSize: 13,
    color: theme.colors.text,
    marginTop: 4,
  },
  pairActiveBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  pairTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.match,
    flex: 1,
  },
  pairProgress: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.colors.primary,
    flexShrink: 0,
  },
  idleBanner: {
    alignItems: 'center',
  },
  idleText: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  questionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  questionModalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionTimerPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  questionTimerPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
  questionIndexPill: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: theme.colors.primary,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  questionIndexPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  modalPairTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalQuestionScroll: {
    maxHeight: 380,
  },
  modalQuestionScrollContent: {
    paddingBottom: 6,
  },
  questionBox: {},
  questionText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 14,
    textAlign: 'center',
    lineHeight: 24,
  },
  optionsList: {
    gap: 8,
    marginBottom: 12,
  },
  optionButton: {
    backgroundColor: theme.colors.soft,
    borderRadius: theme.radius.control,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  optionButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionIndexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIndexBadgeSelected: {
    backgroundColor: '#0B0813',
  },
  optionIndexText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.muted,
  },
  optionIndexTextSelected: {
    color: theme.colors.primary,
  },
  optionButtonText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
    flex: 1,
  },
  optionButtonTextSelected: {
    color: '#0B0813',
    fontWeight: 'bold',
  },
  lockedNotice: {
    backgroundColor: theme.colors.soft,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  lockedNoticeText: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  skipBtn: {
    marginTop: 6,
  },
  revealBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  revealTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  commentaryText: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  spectatorBox: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  spectatorTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  spectatorSub: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  spectatorReveal: {
    marginTop: 10,
    alignItems: 'center',
  },
  spectatorRevealStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.match,
  },
  spectatorCommentary: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 4,
    textAlign: 'center',
  },
  turnPromptTimer: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
    marginTop: 4,
  },
  kissBanner: {
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#190a1e',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  kissDuoStage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  kissDuoAvatarBox: {
    alignItems: 'center',
    width: 72,
  },
  kissDuoImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: '#F43F5E',
  },
  kissDuoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2e1038',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#F43F5E',
  },
  kissDuoEmoji: {
    fontSize: 26,
  },
  kissDuoName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FDE047',
    marginTop: 4,
    textAlign: 'center',
  },
  kissDuoHeartTrack: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 40,
  },
  kissDuoBeam: {
    position: 'absolute',
    height: 2,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(244, 63, 94, 0.4)',
    zIndex: 1,
  },
  kissDuoHeartPulse: {
    zIndex: 2,
    backgroundColor: '#27082e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.5)',
  },
  kissDuoHeartEmoji: {
    fontSize: 20,
  },
  kissPendingCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(225, 29, 72, 0.15)',
    borderWidth: 1.5,
    borderColor: '#F43F5E',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    width: '100%',
    gap: 10,
  },
  kissPendingFireEmoji: {
    fontSize: 24,
  },
  kissPendingCalloutTextWrap: {
    flex: 1,
  },
  kissPendingCalloutTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFE4E6',
  },
  kissPendingCalloutSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F43F5E',
    marginTop: 2,
  },
  kissHeaderMeta: {
    alignItems: 'center',
    marginBottom: 6,
  },
  kissMagneticTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    textShadowColor: 'rgba(244, 63, 94, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  kissCountdownBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  kissCountdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
  kissMagneticSub: {
    fontSize: 12,
    color: '#FDA4AF',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '500',
  },
  kissMagneticBtnWrapper: {
    width: '100%',
    position: 'relative',
    alignItems: 'center',
    shadowColor: '#FF2E93',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 8,
  },
  kissGlowHalo: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 46, 147, 0.3)',
  },
  kissMagneticPrimaryBtn: {
    width: '100%',
    backgroundColor: '#E11D48',
    borderColor: '#FF2E93',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: '#FF1493',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  kissMagneticBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  kissMagneticBtnSubHint: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FDE047',
    marginTop: 6,
    textAlign: 'center',
  },
  skipBigBtnText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    fontWeight: '600',
  },
  kissTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7e22ce',
    marginBottom: 4,
    textAlign: 'center',
  },
  kissSub: {
    fontSize: 13,
    color: '#6b21a8',
    textAlign: 'center',
    marginBottom: 4,
  },
  kissTimerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 6,
    textAlign: 'center',
  },
  kissActionButtonsRow: {
    width: '100%',
    marginTop: 6,
    gap: 10,
  },
  kissBigBtn: {
    backgroundColor: '#ec4899',
    width: '100%',
  },
  skipBigBtn: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 14,
  },
  kissDecidedContainer: {
    alignItems: 'center',
    width: '100%',
  },
  kissPromptContainer: {
    alignItems: 'center',
    width: '100%',
  },
  kissSpectatorContainer: {
    alignItems: 'center',
    width: '100%',
  },
  kissCard: {
    marginTop: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3e8ff',
  },
  kissCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6b21a8',
    textAlign: 'center',
    marginBottom: 6,
  },
  kissCardDesc: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: 16,
  },
  kissPrimaryBtn: {
    backgroundColor: '#ec4899',
    marginBottom: 12,
  },
  alternativesBox: {
    marginTop: 8,
    marginBottom: 12,
  },
  alternativesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  altButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  altBtn: {
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbcfe8',
  },
  altBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#db2777',
  },
  skipKissBtn: {
    marginTop: 4,
  },
  matchModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  matchModalContent: {
    width: '100%',
    maxWidth: 340,
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  matchModalEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  matchModalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ec4899',
    marginBottom: 8,
  },
  matchModalSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  matchModalInfo: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  matchModalBtn: {
    width: '100%',
    backgroundColor: '#ec4899',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#38bdf8',
    marginBottom: 16,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatBadge: {
    position: 'relative',
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  chatBadgeUnread: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderColor: '#ef4444',
    borderWidth: 1.5,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  chatBadgeText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  chatBadgeTextUnread: {
    color: '#fecaca',
    fontWeight: '800',
  },
  chatUnreadRedBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#0f172a',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 6,
  },
  chatUnreadRedBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 12,
  },
  floatingChatBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingChatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  floatingChatTextContainer: {
    flex: 1,
  },
  floatingChatSender: {
    fontSize: 11,
    fontWeight: '800',
    color: '#f87171',
    marginBottom: 1,
  },
  floatingChatMessage: {
    fontSize: 13,
    color: '#f1f5f9',
    fontWeight: '500',
  },
  floatingChatOpenPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  floatingChatOpenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fca5a5',
  },
  aiBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  aiBadgeText: {
    color: '#d8b4fe',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: 'rgba(30, 27, 75, 0.85)',
    borderColor: 'rgba(168, 85, 247, 0.5)',
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  summaryCardTitle: {
    color: '#e9d5ff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryCardText: {
    color: '#f3e8ff',
    fontSize: 13,
    lineHeight: 18,
  },
  aiDisclosureText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    textAlign: 'center',
  },
  aiStatusText: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  walletBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  walletBadgeText: {
    color: '#7dd3fc',
    fontSize: 13,
    fontWeight: '700',
  },
  soundBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  soundBadgeText: {
    fontSize: 13,
  },
  walletModalContent: {
    width: '90%',
    maxWidth: 420,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#1e1b4b',
  },
  walletBalanceBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  walletBalanceLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
  },
  walletBalanceValue: {
    color: '#38bdf8',
    fontSize: 28,
    fontWeight: '800',
  },
  debtNotice: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '600',
  },
  walletStoreHeading: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  storeOfferCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  storeOfferTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
  },
  storeOfferDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  storeBuyBtn: {
    minWidth: 80,
    paddingHorizontal: 12,
  },
  purchaseStatusText: {
    color: '#38bdf8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 8,
  },
  walletTxHeading: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  walletTxList: {
    maxHeight: 180,
    marginBottom: 8,
  },
  walletTxItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  walletTxDesc: {
    color: '#f1f5f9',
    fontSize: 13,
  },
  walletTxDate: {
    color: '#64748b',
    fontSize: 11,
  },
  walletTxAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txPositive: {
    color: '#4ade80',
  },
  txNegative: {
    color: '#f87171',
  },
  walletEmptyTx: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 12,
  },
  memberProfileModalContent: {
    width: '92%',
    maxWidth: 420,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#1e1b4b',
  },
  loadingProfileText: {
    color: '#cbd5e1',
    textAlign: 'center',
    marginVertical: 20,
  },
  memberProfileHeader: {
    marginBottom: 12,
  },
  memberProfileTitle: {
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: '800',
  },
  memberProfileCity: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  profilePhotoContainer: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#0f172a',
  },
  profileModalPhoto: {
    width: '100%',
    height: '100%',
  },
  profileBioTitle: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileBioText: {
    color: '#f1f5f9',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  fullProfileSection: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    marginBottom: 8,
  },
  unlockedBadge: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  profileGoalText: {
    color: '#e2e8f0',
    fontSize: 13,
    marginBottom: 8,
  },
  interestsContainer: {
    marginTop: 4,
  },
  interestsTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  interestChip: {
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  interestText: {
    color: '#e9d5ff',
    fontSize: 12,
  },
  lockedProfileSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    marginBottom: 8,
  },
  lockedProfileNotice: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 6,
  },
  confirmUnlockBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  confirmUnlockText: {
    color: '#f8fafc',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  unlockErrorMsg: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  selectableSeat: {
    borderColor: '#ec4899',
    borderWidth: 3,
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
  },
  selectableBadge: {
    position: 'absolute',
    top: -14,
    backgroundColor: '#ec4899',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  selectableBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  selectingTargetBanner: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  selectingTargetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ec4899',
    marginBottom: 4,
    textAlign: 'center',
  },
  selectingTargetTimer: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 6,
  },
  selectingTargetSub: {
    fontSize: 12,
    color: theme.colors.muted,
    marginBottom: 10,
    textAlign: 'center',
  },
  targetOptionsList: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  targetOptionButton: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderWidth: 1.5,
    borderColor: '#ec4899',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  targetOptionText: {
    color: '#ec4899',
    fontSize: 13,
    fontWeight: '700',
  },
  skipTargetButton: {
    marginTop: 12,
    backgroundColor: 'rgba(100, 116, 139, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  skipTargetButtonText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  selectingTargetWaiting: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  gameEndedBanner: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  gameEndedTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f43f5e',
    marginBottom: 2,
  },
  gameEndedSub: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  endedModalContent: {
    width: '92%',
    maxWidth: 440,
    maxHeight: '85%',
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#1e1b4b',
    borderWidth: 1.5,
    borderColor: 'rgba(236, 72, 153, 0.5)',
    alignItems: 'center',
  },
  endedModalEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  endedModalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f43f5e',
    marginBottom: 4,
    textAlign: 'center',
  },
  endedModalSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 6,
  },
  endedModalInstructions: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 16,
  },
  endedMembersList: {
    width: '100%',
    maxHeight: 280,
  },
  endedMemberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  endedMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  endedMemberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  endedMemberName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  endedMemberSub: {
    fontSize: 11,
    color: '#94a3b8',
  },
  endedKissBtn: {
    minWidth: 100,
    paddingHorizontal: 12,
  },
  directRequestSection: {
    marginTop: 14,
    padding: 12,
    backgroundColor: 'rgba(236, 72, 153, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.25)',
  },
  directRequestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  directRequestSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f43f5e',
  },
  directRequestDesc: {
    fontSize: 12,
    color: '#cbd5e1',
    marginBottom: 8,
    lineHeight: 16,
  },
  directRequestSentBadge: {
    padding: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 8,
    alignItems: 'center',
  },
  directRequestSentText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '600',
  },
  directRequestInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    color: '#f8fafc',
    padding: 10,
    fontSize: 13,
    minHeight: 50,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  directRequestErrorText: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 6,
  },
  directRequestSuccessText: {
    color: '#34d399',
    fontSize: 12,
    marginBottom: 6,
  },
  incomingRequestModalContent: {
    width: '90%',
    maxWidth: 400,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    alignItems: 'center',
  },
  incomingSenderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    marginTop: 4,
    marginBottom: 12,
  },
  incomingMessageBox: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.2)',
    marginBottom: 12,
  },
  incomingMessageLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
    fontWeight: '600',
  },
  incomingMessageText: {
    fontSize: 14,
    color: '#f8fafc',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  incomingHintText: {
    fontSize: 12,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 16,
  },
  arenaStatsBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.25)',
  },
  arenaStatsTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  arenaStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  arenaStatItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  arenaStatIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  arenaStatValue: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
  },
  arenaStatLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  giftSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  giftSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  giftSectionTitle: {
    color: '#f43f5e',
    fontSize: 14,
    fontWeight: '700',
  },
  giftSectionBalance: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  giftSectionSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 10,
  },
  giftSuccessBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  giftSuccessText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  giftErrorText: {
    color: '#f87171',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  giftCatalogScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  giftCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    width: 76,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  giftCardDisabled: {
    opacity: 0.4,
  },
  giftCardSending: {
    opacity: 0.7,
    borderColor: '#38bdf8',
  },
  giftCardIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  giftCardName: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  giftCardCostBadge: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  giftCardCostText: {
    color: '#fda4af',
    fontSize: 10,
    fontWeight: '700',
  },
  giftSquareBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 2.5,
    borderColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.75,
    shadowRadius: 10,
    elevation: 10,
  },
  giftSquareEmoji: {
    fontSize: 30,
    textAlign: 'center',
  },
  seatGiftSquareBadge: {
    position: 'absolute',
    width: 52,
    height: 52,
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flyingGiftWrapper: {
    position: 'absolute',
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  celebratingSeat: {
    borderColor: '#F59E0B',
    borderWidth: 3,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 6,
  },
  kissModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  kissModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(244, 63, 94, 0.45)',
    alignItems: 'center',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 12,
  },
  kissModalHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  kissModalTimerBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  kissModalTimerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
  kissModalAvatarContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  kissModalAvatarRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2.5,
    borderColor: '#F43F5E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    marginBottom: 8,
    overflow: 'hidden',
  },
  kissModalAvatarImage: {
    width: '100%',
    height: '100%',
  },
  kissModalAvatarEmoji: {
    fontSize: 36,
  },
  kissModalPartnerName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  kissModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  kissModalSub: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  kissModalActionsRow: {
    width: '100%',
    gap: 10,
  },
  kissModalSendBtn: {
    width: '100%',
    backgroundColor: '#E11D48',
    borderColor: '#BE123C',
  },
  kissModalSkipBtn: {
    width: '100%',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
});
