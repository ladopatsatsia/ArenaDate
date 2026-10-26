import { Button, Text, TextInput } from '../components/UI';
import { SafetyActions } from "../safety/SafetyActions";
import { safetySubscribe } from "../safety/api";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput as NativeTextInput,
  type ViewToken,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../auth/api';
import { ChatApi, type Message } from './api';
import { MessageSender, mergeMessages } from './model';
import { pendingStore } from './storage';
import { LiveChat, signalRConnection } from './live';
import { Screen } from '../components/Screen';
import { Link, StateMessage } from '../components/UI';
import { theme } from '../components/theme';
import { useReducedMotion } from '../components/useReducedMotion';
import { parseChatMessage, formatPhotoMessage, formatVoiceMessage, formatReplyMessage } from './ChatMediaUtils';
import { SwipeableMessageRow } from './SwipeableMessageRow';
import { UniversalVoiceRecorder } from './VoiceRecorder';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { ChatEmojiPicker } from './ChatEmojiPicker';
import { ChatMediaViewerModal } from './ChatMediaViewerModal';

export default function ChatRoute() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { state } = useAuth();
  const { t } = useTranslation();
  if (typeof id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || !state.account) {
    return (
      <Screen title={t('chat_title')}>
        <StateMessage title={t('chat_unavailable')} />
        <Link href="/(tabs)/matches">{t('matches')}</Link>
      </Screen>
    );
  }
  return <ChatScreen key={state.account.id + id} id={id} peerName={name} account={state.account.id} />;
}

export function ChatScreen({ id, peerName, account }: { id: string; peerName?: string; account: string }) {
  const router = useRouter();
  const { api: auth, manager } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const cache = useQueryClient();
  const reduced = useReducedMotion();
  const olderLock = useRef(false);

  const api = useMemo(() => new ChatApi(auth, manager), [auth, manager]);
  const sender = useMemo(
    () => new MessageSender((input) => api.send(id, input), pendingStore(account, id, auth.baseUrl), Crypto.randomUUID),
    [api, id, account, auth.baseUrl]
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const rows = useRef<Message[]>([]);
  const [peerRead, setPeerRead] = useState('0');
  const [before, setBefore] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(sender.pending);
  const [visible, setVisible] = useState<Message | null>(null);
  const revoked = useRef(false);
  const [closed, setClosed] = useState(false);
  const stopLive = useRef<() => void>(() => undefined);

  // Media, Voice and Emojis
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isInputExpanded = isInputFocused || text.trim().length > 0 || showEmojiPicker;
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | undefined>(undefined);
  const [viewerCaption, setViewerCaption] = useState<string | undefined>(undefined);
  const [showViewer, setShowViewer] = useState(false);

  // Reply & Message Action States
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [selectedMessageMenu, setSelectedMessageMenu] = useState<Message | null>(null);
  const [safetyTarget, setSafetyTarget] = useState<{ messageId?: string; action: 'report' | 'block' } | null>(null);

  const getSnippet = useCallback((m: Message) => {
    const parsed = parseChatMessage(m.text, auth.baseUrl, authToken);
    if (parsed.type === 'photo') {
      return '📷 ' + (parsed.caption || t('chat_photo', 'ფოტო'));
    }
    if (parsed.type === 'voice') {
      return '🎤 ' + t('chat_voice', 'ხმოვანი');
    }
    return parsed.text || m.text;
  }, [auth.baseUrl, authToken, t]);

  const copyToClipboard = useCallback(async (content: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
        return true;
      }
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
    return false;
  }, []);

  const voiceRecorderRef = useRef<UniversalVoiceRecorder>(new UniversalVoiceRecorder());

  useEffect(() => {
    void api.token().then(setAuthToken).catch(() => undefined);
  }, [api]);

  useEffect(() => {
    const unsub = voiceRecorderRef.current.onDuration((secs) => {
      setRecordingDuration(secs);
    });
    return () => {
      unsub();
      voiceRecorderRef.current.cancel();
    };
  }, []);

  const clear = useCallback(() => {
    revoked.current = true;
    setClosed(true);
    rows.current = [];
    historyThrough.current = undefined;
    setMessages([]);
    setText('');
    setReplyingTo(null);
    setSelectedMessageMenu(null);
    setSafetyTarget(null);
    setPending(null);
    setPeerRead('0');
    setBefore(null);
    setVisible(null);
    setReady(false);
    setLoading(false);
    setOnline(false);
    setNotice('chat_unavailable');
    stopLive.current();
    void sender.revoke().catch(() => setNotice('chat_storage_failed'));
    void cache.cancelQueries({ queryKey: ['account', account] }).then(() =>
      cache.resetQueries({ queryKey: ['account', account] })
    );
  }, [sender, cache, account]);

  useEffect(() => safetySubscribe(account, (conversation) => {
    if (conversation === id) clear();
  }), [account, id, clear]);

  const historyThrough = useRef<string | undefined>(undefined);
  const active = useRef(true);
  const catching = useRef(false);
  const again = useRef(false);
  const sendingLock = useRef(false);
  const focused = useRef(false);
  const list = useRef<FlatList<Message>>(null);

  const current = useCallback(() => !revoked.current && active.current && manager.snapshot().account?.id === account, [account, manager]);
  const merge = useCallback((incoming: Message[], older = false) => {
    if (!current()) return;
    rows.current = mergeMessages(rows.current, incoming, older);
    setMessages(rows.current);
  }, [current]);

  const catchup = useCallback(async () => {
    if (!current()) return;
    if (catching.current) {
      again.current = true;
      return;
    }
    catching.current = true;
    try {
      do {
        again.current = false;
        let after = historyThrough.current;
        let pages = 0;
        do {
          const page = await api.history(id, undefined, after);
          if (!current()) return;
          merge(page.items);
          historyThrough.current = page.items.at(-1)?.sequence ?? historyThrough.current;
          setPeerRead(page.peerReadSequence);
          if (!after) setBefore(page.nextBefore ?? null);
          after = page.nextAfter ?? undefined;
          pages++;
        } while (after && current() && pages < 10);
        if (after && current()) {
          const latest = await api.history(id);
          if (!current()) return;
          rows.current = [];
          merge(latest.items);
          historyThrough.current = latest.items.at(-1)?.sequence;
          setBefore(latest.nextBefore ?? null);
          setPeerRead(latest.peerReadSequence);
        }
      } while (again.current && current());
      setNotice('');
      const latestNonPending = rows.current
        .filter((m) => !m.id.startsWith('pending-'))
        .sort((a, b) => (BigInt(a.sequence) > BigInt(b.sequence) ? -1 : 1))[0];
      if (latestNonPending && current()) {
        void api.read(id, latestNonPending.id).catch(() => undefined);
      }
      void cache.invalidateQueries({ queryKey: ['account', account, 'matches'] });
      void cache.invalidateQueries({ queryKey: ['account', account, 'matches-badge'] });
    } catch (error) {
      if (current()) {
        setNotice(error instanceof ApiError && [403, 404].includes(error.status) ? 'chat_unavailable' : 'connection_error');
        if (error instanceof ApiError && [403, 404].includes(error.status)) {
          clear();
        }
      }
      throw error;
    } finally {
      catching.current = false;
      if (current()) setLoading(false);
    }
  }, [api, id, current, merge, cache, account, clear]);

  const live = useMemo(
    () => new LiveChat(() => signalRConnection(auth.baseUrl, id, api.token), catchup, (value) => {
      if (current()) setOnline(value);
    }, clear),
    [auth.baseUrl, id, api, catchup, current, clear]
  );
  stopLive.current = () => {
    void live.stop();
  };

  useEffect(() => {
    cache.setQueryData(['account', account, 'matches'], (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          items: page.items.map((m: any) => m.conversationId === id ? { ...m, unreadCount: 0 } : m),
        })),
      };
    });
    cache.setQueryData(['account', account, 'matches-badge'], (old: any) => {
      if (!old?.items) return old;
      return {
        ...old,
        items: old.items.map((m: any) => m.conversationId === id ? { ...m, unreadCount: 0 } : m),
      };
    });
  }, [cache, account, id]);

  useEffect(() => {
    active.current = true;
    void sender.restore().then(
      () => {
        if (current()) {
          setPending(sender.pending);
          setReady(true);
        }
      },
      (err) => {
        console.warn('[ChatScreen] sender.restore failed:', err);
        if (current()) {
          setPending(null);
          setReady(true);
        }
      }
    );
    return () => {
      active.current = false;
    };
  }, [sender, current]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      const update = () => {
        if (!revoked.current && AppState.currentState === 'active') {
          live.start();
          void catchup().catch(() => undefined);
        } else {
          void live.stop();
        }
      };
      update();
      const subscription = AppState.addEventListener('change', update);
      const fallback = setInterval(() => {
        if (AppState.currentState === 'active') void catchup().catch(() => undefined);
      }, 30000);
      return () => {
        focused.current = false;
        subscription.remove();
        clearInterval(fallback);
        void live.stop();
        void cache.invalidateQueries({ queryKey: ['account', account, 'matches'] });
        void cache.invalidateQueries({ queryKey: ['account', account, 'matches-badge'] });
      };
    }, [live, catchup, cache, account])
  );

  useEffect(() => {
    if (!visible || !focused.current || AppState.currentState !== 'active') return;
    const timer = setTimeout(() => {
      void api.read(id, visible.id).then(
        () => {
          void cache.invalidateQueries({ queryKey: ['account', account, 'matches'] });
          void cache.invalidateQueries({ queryKey: ['account', account, 'matches-badge'] });
        },
        (error) => {
          if (current()) {
            if (error instanceof ApiError && [403, 404].includes(error.status)) clear();
            else setNotice('connection_error');
          }
        }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [visible, api, id, cache, account, current, clear]);

  const onVisible = useRef(({ viewableItems }: { viewableItems: ViewToken<Message>[] }) => {
    const latest = viewableItems
      .map((v) => v.item)
      .filter((m) => !m.id.startsWith('pending-'))
      .sort((a, b) => (BigInt(a.sequence) > BigInt(b.sequence) ? -1 : 1))[0];
    if (latest) setVisible(latest);
  }).current;

  async function send(retry = false, customText?: string) {
    if (!current() || !ready || sendingLock.current) return;
    sendingLock.current = true;
    setSending(true);
    setNotice('');
    let contentToSend = customText !== undefined ? customText : (retry ? undefined : text);
    if (!retry && replyingTo && contentToSend) {
      const isOwnMsg = replyingTo.senderId === account;
      const sName = isOwnMsg ? t('you', 'შენ') : (peerName || t('user', 'მომხმარებელი'));
      const snip = getSnippet(replyingTo);
      contentToSend = formatReplyMessage(replyingTo.id, sName, snip, contentToSend);
      setReplyingTo(null);
    }
    try {
      const operation = sender.submit(contentToSend, (value) => {
        if (current()) setPending(value);
      });
      const result = await operation;
      if (!current()) return;
      merge([result]);
      setPending(null);
      if (customText === undefined && !retry) {
        setText('');
      }
      list.current?.scrollToOffset({ offset: 0, animated: !reduced });
      void catchup().catch(() => undefined);
    } catch (error) {
      if (current()) {
        if (error instanceof ApiError && [403, 404].includes(error.status)) clear();
        else {
          setPending(sender.pending);
          setNotice('chat_send_failed');
        }
      }
    } finally {
      sendingLock.current = false;
      if (current()) setSending(false);
    }
  }

  async function older() {
    if (!before || loading || olderLock.current) return;
    olderLock.current = true;
    setLoading(true);
    try {
      const page = await api.history(id, before);
      if (current()) {
        merge(page.items, true);
        setBefore(page.nextBefore ?? null);
      }
    } catch (error) {
      if (current()) {
        if (error instanceof ApiError && [403, 404].includes(error.status)) clear();
        else setNotice('connection_error');
      }
    } finally {
      olderLock.current = false;
      if (current()) setLoading(false);
    }
  }

  // --- Photo Picking & Upload ---
  async function handlePickPhoto() {
    if (!ready || sending || uploadingMedia || closed) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset?.uri) return;

      setUploadingMedia(true);
      const uploadRes = await api.uploadMedia({ uri: asset.uri }, 'photo');
      const caption = text.trim() || undefined;
      const photoPayload = formatPhotoMessage(uploadRes.id, caption);
      setText('');
      await send(false, photoPayload);
    } catch (err) {
      console.warn('Photo send failed:', err);
      setNotice('chat_send_failed');
    } finally {
      setUploadingMedia(false);
    }
  }

  // --- Voice Note Recording & Sending ---
  async function handleStartRecording() {
    if (!ready || sending || uploadingMedia || closed || isRecordingVoice) return;
    try {
      setShowEmojiPicker(false);
      setIsRecordingVoice(true);
      await voiceRecorderRef.current.start();
    } catch (err) {
      console.warn('Start voice recording failed:', err);
      setIsRecordingVoice(false);
      setNotice('chat_recording_failed');
    }
  }

  async function handleStopAndSendVoice() {
    if (!isRecordingVoice) return;
    try {
      setIsRecordingVoice(false);
      const recResult = await voiceRecorderRef.current.stop();
      if (!recResult.uri) return;

      setUploadingMedia(true);
      const uploadRes = await api.uploadMedia(
        { uri: recResult.uri, blob: recResult.blob },
        'voice',
        recResult.duration
      );
      const voicePayload = formatVoiceMessage(uploadRes.id, recResult.duration);
      await send(false, voicePayload);
    } catch (err) {
      console.warn('Voice send failed:', err);
      setNotice('chat_send_failed');
    } finally {
      setUploadingMedia(false);
    }
  }

  function handleCancelVoiceRecording() {
    voiceRecorderRef.current.cancel();
    setIsRecordingVoice(false);
    setRecordingDuration(0);
  }

  // --- Emoji Selection ---
  function handleSelectEmoji(emoji: string) {
    setText((prev) => prev + emoji);
  }

  const displayed = [...messages].reverse();
  const pendingVisible = pending && !messages.some((m) => m.senderId === account && m.clientMessageId === pending.clientMessageId);

  return (
    <KeyboardAvoidingView
      style={{
        flex: 1,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        backgroundColor: theme.colors.background,
      }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <View style={styles.chatHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(tabs)/matches')}
          accessibilityRole="button"
          accessibilityLabel={t('back_to_matches', '← კავშირები')}
          testID="chat-back-btn"
          hitSlop={8}
        >
          <Text style={styles.backButtonIcon}>←</Text>
          <Text style={styles.backButtonText}>{t('matches', 'კავშირები')}</Text>
        </TouchableOpacity>
        <View style={styles.chatHeaderTitleWrap}>
          <Text accessibilityRole="header" style={styles.chatHeaderTitle}>
            {peerName || t('chat_title')}
          </Text>
          {!online && !closed && <Text style={styles.reconnectingText}>{t('chat_reconnecting')}</Text>}
        </View>
        <SafetyActions conversationId={id} closed={closed} variant="dots" />
      </View>

      {!!notice && (
        <Text accessibilityRole="alert" style={styles.noticeText}>
          {t(notice)}
        </Text>
      )}

      <View style={styles.newestBtnWrap}>
        <Button
          title={t('chat_newest')}
          disabled={closed || loading}
          onPress={() => {
            rows.current = [];
            historyThrough.current = undefined;
            setMessages([]);
            setLoading(true);
            void catchup().catch(() => undefined);
            list.current?.scrollToOffset({ offset: 0, animated: !reduced });
          }}
        />
      </View>

      <FlatList
        ref={list}
        inverted
        data={displayed}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        keyExtractor={(m) => m.id}
        onViewableItemsChanged={onVisible}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        keyboardShouldPersistTaps="handled"
        maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 40 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {t(closed ? 'chat_unavailable' : loading ? 'working' : notice ? 'connection_error' : 'chat_empty')}
          </Text>
        }
        ListHeaderComponent={
          pending ? (
            <View style={{ padding: 12 }}>
              {pendingVisible && <Text>{pending.text}</Text>}
              <Text>{t(sending ? 'chat_pending' : 'chat_failed')}</Text>
              <Button disabled={sending} title={t('retry')} onPress={() => { void send(true); }} />
            </View>
          ) : null
        }
        ListFooterComponent={before ? <Button disabled={loading} title={t('chat_older')} onPress={() => { void older(); }} /> : null}
        renderItem={({ item }) => {
          const isOwn = item.senderId === account;
          const parsed = parseChatMessage(item.text, auth.baseUrl, authToken);

          return (
            <SwipeableMessageRow
              isOwn={isOwn}
              disabled={closed || !ready}
              onReply={() => setReplyingTo(item)}
            >
              <View style={[styles.bubbleWrapper, isOwn ? styles.bubbleWrapperOwn : styles.bubbleWrapperPeer]}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onLongPress={() => setSelectedMessageMenu(item)}
                  delayLongPress={280}
                  style={[
                    styles.bubble,
                    isOwn ? styles.bubbleOwn : styles.bubblePeer,
                    parsed.type === 'emoji_only' && styles.bubbleEmojiOnly,
                  ]}
                >
                  {/* Quoted Reply Card */}
                  {parsed.reply && (
                    <View style={[styles.quotedReplyCard, isOwn ? styles.quotedReplyOwn : styles.quotedReplyPeer]}>
                      <View style={[styles.quotedReplyBar, isOwn ? styles.quotedReplyBarOwn : styles.quotedReplyBarPeer]} />
                      <View style={styles.quotedReplyContent}>
                        <Text
                          style={[styles.quotedReplySender, isOwn ? styles.quotedReplySenderOwn : styles.quotedReplySenderPeer]}
                          numberOfLines={1}
                        >
                          {parsed.reply.sender}
                        </Text>
                        <Text
                          style={[styles.quotedReplySnippet, isOwn ? styles.quotedReplySnippetOwn : styles.quotedReplySnippetPeer]}
                          numberOfLines={2}
                        >
                          {parsed.reply.snippet}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.bubbleContentRow}>
                    {parsed.type === 'photo' ? (
                      <View style={styles.photoContainer}>
                        <TouchableOpacity
                          activeOpacity={0.9}
                          onPress={() => {
                            setViewerImageUrl(parsed.mediaUrl);
                            setViewerCaption(parsed.caption);
                            setShowViewer(true);
                          }}
                          testID={`chat-photo-${item.id}`}
                        >
                          <Image
                            source={{ uri: parsed.mediaUrl }}
                            style={styles.bubblePhoto}
                            resizeMode="cover"
                          />
                        </TouchableOpacity>
                        {!!parsed.caption && (
                          <Text selectable style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextPeer, { marginTop: 6 }]}>
                            {parsed.caption}
                          </Text>
                        )}
                      </View>
                    ) : parsed.type === 'voice' ? (
                      <VoiceMessagePlayer
                        mediaUrl={parsed.mediaUrl || ''}
                        durationSeconds={parsed.duration}
                        isOwn={isOwn}
                      />
                    ) : parsed.type === 'emoji_only' ? (
                      <Text style={styles.bubbleEmojiOnlyText}>{parsed.text}</Text>
                    ) : (
                      <Text selectable style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextPeer]}>
                        {parsed.reply ? parsed.text : item.text}
                      </Text>
                    )}

                    <TouchableOpacity
                      style={styles.messageDotsBtn}
                      onPress={() => setSelectedMessageMenu(item)}
                      accessibilityRole="button"
                      accessibilityLabel={t('message_actions', 'შეტყობინების მენიუ')}
                      testID={`message-dots-${item.id}`}
                      hitSlop={8}
                    >
                      <Text style={[styles.messageDotsIcon, isOwn ? styles.messageDotsOwn : styles.messageDotsPeer]}>
                        ⋮
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.timestampText, isOwn ? styles.timestampOwn : styles.timestampPeer]}>
                    {new Date(item.sentAt).toLocaleTimeString()}
                    {isOwn ? ' · ' + t(BigInt(item.sequence) <= BigInt(peerRead) ? 'chat_read' : 'chat_sent') : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            </SwipeableMessageRow>
          );
        }}
      />

      {/* Emoji Picker Drawer */}
      {showEmojiPicker && (
        <ChatEmojiPicker
          onSelectEmoji={handleSelectEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Reply Preview Bar */}
      {replyingTo && (
        <View style={styles.replyPreviewBar} testID="reply-preview-bar">
          <View style={styles.replyPreviewLeft}>
            <Text style={styles.replyPreviewIcon}>↩️</Text>
            <View style={styles.replyPreviewContent}>
              <Text style={styles.replyPreviewSender} numberOfLines={1}>
                {t('replying_to', 'პასუხი')}: {replyingTo.senderId === account ? t('you', 'შენ') : (peerName || t('user', 'მომხმარებელი'))}
              </Text>
              <Text style={styles.replyPreviewText} numberOfLines={1}>
                {getSnippet(replyingTo)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.replyCancelBtn}
            onPress={() => setReplyingTo(null)}
            accessibilityRole="button"
            accessibilityLabel={t('cancel', 'გაუქმება')}
            testID="cancel-reply-btn"
            hitSlop={8}
          >
            <Text style={styles.replyCancelText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Composer */}
      {isRecordingVoice ? (
        <View style={styles.recordingBar} testID="voice-recording-bar">
          <View style={styles.recordingIndicator}>
            <View style={styles.redDot} />
            <Text style={styles.recordingTimerText}>
              {Math.floor(recordingDuration / 60)}:
              {Math.floor(recordingDuration % 60) < 10 ? '0' : ''}
              {Math.floor(recordingDuration % 60)}
            </Text>
          </View>

          <View style={styles.recordingActions}>
            <TouchableOpacity
              style={styles.cancelRecBtn}
              onPress={handleCancelVoiceRecording}
              accessibilityRole="button"
              accessibilityLabel={t('cancel', 'გაუქმება')}
              testID="cancel-voice-btn"
            >
              <Text style={styles.cancelRecText}>✕</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sendRecBtn}
              onPress={() => { void handleStopAndSendVoice(); }}
              accessibilityRole="button"
              accessibilityLabel={t('send_voice', 'ხმოვანის გაგზავნა')}
              testID="send-voice-btn"
            >
              <Text style={styles.sendRecText}>⬆</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.composerWrap}>
          {/* Left Actions: Voice Recording on left (FB Messenger style) & Photo */}
          <View style={styles.leftActions}>
            <TouchableOpacity
              style={styles.messengerVoiceBtn}
              onPress={() => { void handleStartRecording(); }}
              disabled={!ready || !!pending || sending || notice === 'chat_unavailable'}
              accessibilityRole="button"
              accessibilityLabel={t('chat_record_voice', 'ხმოვანის ჩაწერა')}
              testID="start-voice-btn"
            >
              <Text style={styles.messengerVoiceIcon}>🎙️</Text>
            </TouchableOpacity>

            {!isInputExpanded && (
              <TouchableOpacity
                style={styles.messengerActionBtn}
                onPress={() => { void handlePickPhoto(); }}
                disabled={uploadingMedia || sending}
                accessibilityRole="button"
                accessibilityLabel={t('chat_photo_btn', 'ფოტოს გაგზავნა')}
                testID="pick-photo-btn"
              >
                {uploadingMedia ? (
                  <ActivityIndicator size="small" color="#8b5cf6" />
                ) : (
                  <Text style={styles.messengerActionIcon}>📷</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Facebook Messenger Style Input Pill with inside Emoji Smile */}
          <View style={[styles.messengerPill, isInputExpanded && styles.messengerPillExpanded]}>
            <NativeTextInput
              testID="chat-message"
              accessibilityLabel={t('chat_message')}
              placeholder={t('chat_message')}
              placeholderTextColor="rgba(255, 255, 255, 0.45)"
              multiline
              maxLength={2000}
              value={text}
              onChangeText={setText}
              onFocus={() => {
                if (Platform.OS !== 'web') {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                }
                setIsInputFocused(true);
              }}
              onBlur={() => {
                if (Platform.OS !== 'web') {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                }
                setIsInputFocused(false);
              }}
              editable={!pending && !sending && ready}
              style={styles.messengerPillInput}
            />

            {/* Emoji smile button INSIDE the text input capsule on the right side */}
            <TouchableOpacity
              style={styles.pillEmojiBtn}
              onPress={() => setShowEmojiPicker((prev) => !prev)}
              accessibilityRole="button"
              accessibilityLabel={t('chat_emoji_btn', 'ემოჯები')}
              testID="toggle-emoji-btn"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.pillEmojiText}>{showEmojiPicker ? '⌨️' : '😊'}</Text>
            </TouchableOpacity>
          </View>

          {/* Right side: small send logo button */}
          <TouchableOpacity
            testID="chat-send"
            style={[
              styles.messengerSendBtn,
              text.trim().length > 0 ? styles.messengerSendBtnActive : styles.messengerSendBtnDisabled,
            ]}
            disabled={!ready || !!pending || sending || !text.trim() || notice === 'chat_unavailable'}
            onPress={() => { void send(); }}
            accessibilityRole="button"
            accessibilityLabel={t(sending ? 'working' : 'chat_send')}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={[styles.messengerSendIcon, text.trim().length > 0 && styles.messengerSendIconActive]}>
                ➤
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Full-Screen Photo Viewer */}
      <ChatMediaViewerModal
        visible={showViewer}
        imageUrl={viewerImageUrl}
        caption={viewerCaption}
        onClose={() => setShowViewer(false)}
      />

      {/* Message Action Sheet Modal */}
      <Modal
        visible={!!selectedMessageMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessageMenu(null)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setSelectedMessageMenu(null)}>
          <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            {selectedMessageMenu && (
              <>
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetHeaderLabel}>{t('message_actions', 'შეტყობინების მენიუ')}</Text>
                  <Text style={styles.sheetHeaderSnippet} numberOfLines={1}>
                    "{getSnippet(selectedMessageMenu)}"
                  </Text>
                </View>

                {/* Action 1: Reply */}
                <TouchableOpacity
                  style={styles.sheetActionItem}
                  onPress={() => {
                    const msg = selectedMessageMenu;
                    setSelectedMessageMenu(null);
                    setReplyingTo(msg);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('reply', 'პასუხი')}
                  testID="action-reply-btn"
                >
                  <Text style={styles.sheetActionIcon}>↩️</Text>
                  <Text style={styles.sheetActionText}>{t('reply', 'პასუხი')}</Text>
                </TouchableOpacity>

                {/* Action 2: Copy */}
                <TouchableOpacity
                  style={styles.sheetActionItem}
                  onPress={() => {
                    const msg = selectedMessageMenu;
                    setSelectedMessageMenu(null);
                    void copyToClipboard(getSnippet(msg));
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('copy_text', 'ტექსტის კოპირება')}
                  testID="action-copy-btn"
                >
                  <Text style={styles.sheetActionIcon}>📋</Text>
                  <Text style={styles.sheetActionText}>{t('copy_text', 'ტექსტის კოპირება')}</Text>
                </TouchableOpacity>

                {/* Action 3 & 4: Report and Block (Peer only) */}
                {selectedMessageMenu.senderId !== account && (
                  <>
                    <TouchableOpacity
                      style={styles.sheetActionItem}
                      onPress={() => {
                        const msgId = selectedMessageMenu.id;
                        setSelectedMessageMenu(null);
                        setSafetyTarget({ messageId: msgId, action: 'report' });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('safety_report', 'საჩივარი')}
                      testID="action-report-btn"
                    >
                      <Text style={styles.sheetActionIcon}>🚩</Text>
                      <Text style={[styles.sheetActionText, styles.sheetActionDanger]}>
                        {t('safety_report', 'საჩივარი')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.sheetActionItem}
                      onPress={() => {
                        const msgId = selectedMessageMenu.id;
                        setSelectedMessageMenu(null);
                        setSafetyTarget({ messageId: msgId, action: 'block' });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('safety_block', 'დაბლოკვა')}
                      testID="action-block-btn"
                    >
                      <Text style={styles.sheetActionIcon}>🚫</Text>
                      <Text style={[styles.sheetActionText, styles.sheetActionDanger]}>
                        {t('safety_block', 'დაბლოკვა')}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Action 5: Cancel */}
                <TouchableOpacity
                  style={[styles.sheetActionItem, styles.sheetCancelItem]}
                  onPress={() => setSelectedMessageMenu(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t('cancel', 'გაუქმება')}
                  testID="action-cancel-btn"
                >
                  <Text style={styles.sheetCancelText}>{t('cancel', 'გაუქმება')}</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Controlled Safety Actions for Message Report/Block */}
      <SafetyActions
        conversationId={id}
        messageId={safetyTarget?.messageId}
        initialAction={safetyTarget?.action}
        isOpen={!!safetyTarget}
        onClose={() => setSafetyTarget(null)}
        variant="hidden"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  backLink: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  backButtonIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  chatHeaderTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  chatHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  reconnectingText: {
    fontSize: 11,
    color: theme.colors.muted,
    marginTop: 2,
  },
  noticeText: {
    padding: 10,
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    textAlign: 'center',
    fontSize: 13,
  },
  newestBtnWrap: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.muted,
    padding: 32,
    fontSize: 15,
  },
  bubbleWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  bubbleWrapperOwn: {
    alignItems: 'flex-end',
  },
  bubbleWrapperPeer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  bubblePeer: {
    backgroundColor: theme.colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bubbleEmojiOnly: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  bubbleEmojiOnlyText: {
    fontSize: 38,
    lineHeight: 46,
  },
  bubbleContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  bubbleTextOwn: {
    color: '#ffffff',
  },
  bubbleTextPeer: {
    color: theme.colors.text,
  },
  photoContainer: {
    width: 220,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bubblePhoto: {
    width: 220,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#1e1b2e',
  },
  bubbleDotsWrap: {
    marginLeft: 6,
  },
  timestampText: {
    fontSize: 10,
    marginTop: 4,
  },
  timestampOwn: {
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'right',
  },
  timestampPeer: {
    color: theme.colors.muted,
  },
  composerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#130d21',
    gap: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  messengerVoiceBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  messengerVoiceIcon: {
    fontSize: 18,
  },
  messengerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messengerActionIcon: {
    fontSize: 18,
  },
  messengerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 40,
    maxHeight: 120,
    ...(Platform.OS === 'web' ? ({ transition: 'all 0.22s ease-in-out' } as any) : {}),
  },
  messengerPillExpanded: {
    borderColor: '#8b5cf6',
    backgroundColor: 'rgba(255, 255, 255, 0.11)',
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 0 10px rgba(139, 92, 246, 0.25)' } as any) : {}),
  },
  messengerPillInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    paddingRight: 6,
    maxHeight: 100,
    backgroundColor: 'transparent',
    borderWidth: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  pillEmojiBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pillEmojiText: {
    fontSize: 20,
  },
  messengerSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  messengerSendBtnActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#8b5cf6',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 5,
    elevation: 4,
  },
  messengerSendBtnDisabled: {
    opacity: 0.35,
  },
  messengerSendIcon: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.4)',
    marginLeft: 2,
    fontWeight: '700',
  },
  messengerSendIconActive: {
    color: '#ffffff',
  },
  // Kept for backward compatibility if referenced elsewhere
  composerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  composerIconText: {
    fontSize: 18,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontSize: 15,
  },
  voiceRecordBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceRecordIcon: {
    fontSize: 18,
    color: '#ffffff',
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  recordingTimerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelRecBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRecText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
  },
  sendRecBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendRecText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  messageDotsBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 6,
    alignSelf: 'center',
    borderRadius: 6,
  },
  messageDotsIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  messageDotsOwn: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  messageDotsPeer: {
    color: theme.colors.muted,
  },
  quotedReplyCard: {
    flexDirection: 'row',
    borderRadius: 8,
    marginBottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  quotedReplyOwn: {
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderLeftWidth: 3,
    borderLeftColor: '#ffffff',
  },
  quotedReplyPeer: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
  },
  quotedReplyBar: {
    width: 0,
  },
  quotedReplyBarOwn: {},
  quotedReplyBarPeer: {},
  quotedReplyContent: {
    flex: 1,
  },
  quotedReplySender: {
    fontSize: 11,
    fontWeight: '700',
  },
  quotedReplySenderOwn: {
    color: '#f3e8ff',
  },
  quotedReplySenderPeer: {
    color: '#a78bfa',
  },
  quotedReplySnippet: {
    fontSize: 12,
    marginTop: 1,
  },
  quotedReplySnippetOwn: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  quotedReplySnippetPeer: {
    color: theme.colors.text,
  },
  replyPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#1e1b2e',
    borderTopWidth: 1,
    borderTopColor: '#332947',
    borderLeftWidth: 3,
    borderLeftColor: '#8b5cf6',
  },
  replyPreviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  replyPreviewIcon: {
    fontSize: 18,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewSender: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a78bfa',
  },
  replyPreviewText: {
    fontSize: 13,
    color: '#e2e8f0',
    marginTop: 1,
  },
  replyCancelBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyCancelText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '700',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 8,
  },
  sheetHeaderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetHeaderSnippet: {
    fontSize: 14,
    color: theme.colors.text,
    fontStyle: 'italic',
    marginTop: 4,
  },
  sheetActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  sheetActionIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  sheetActionText: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  sheetActionDanger: {
    color: '#ef4444',
  },
  sheetCancelItem: {
    marginTop: 8,
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 12,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.muted,
    textAlign: 'center',
  },
});
