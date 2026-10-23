import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Image,
  LayoutAnimation,
  TextInput as NativeTextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { GameApi, type GameRoomMessageDto, type GameMember } from './GameApi';
import { Text, TextInput } from '../components/UI';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import type { Photo } from '../profile/api';
import { parseChatMessage, formatPhotoMessage, formatVoiceMessage } from '../chat/ChatMediaUtils';
import { UniversalVoiceRecorder } from '../chat/VoiceRecorder';
import { VoiceMessagePlayer } from '../chat/VoiceMessagePlayer';
import { ChatEmojiPicker } from '../chat/ChatEmojiPicker';
import { ChatMediaViewerModal } from '../chat/ChatMediaViewerModal';

interface RoomChatModalProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  gameApi: GameApi;
  currentUserId: string | undefined;
  members: GameMember[];
}

const QUICK_CHIPS = [
  { key: 'chip_hello', text: '👋 სალამი!' },
  { key: 'chip_spin', text: '🍾 დაატრიალე!' },
  { key: 'chip_haha', text: '😂 ჰაჰა' },
  { key: 'chip_cool', text: '🔥 მაგარია' },
  { key: 'chip_kiss', text: '❤️ კოცნა' },
  { key: 'chip_cheers', text: '🥂 გაუმარჯოს!' },
];

export function RoomChatModal({
  visible,
  onClose,
  roomId,
  gameApi,
  currentUserId,
  members,
}: RoomChatModalProps) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Auth token for media URLs
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (typeof gameApi?.getToken === 'function') {
      void gameApi.getToken().then(setAuthToken).catch(() => undefined);
    }
  }, [gameApi]);

  // Media, voice and emojis state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isInputExpanded = isInputFocused || inputText.trim().length > 0 || showEmojiPicker;
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | undefined>(undefined);
  const [viewerCaption, setViewerCaption] = useState<string | undefined>(undefined);
  const [showViewer, setShowViewer] = useState(false);

  const voiceRecorderRef = useRef<UniversalVoiceRecorder>(new UniversalVoiceRecorder());

  useEffect(() => {
    const unsub = voiceRecorderRef.current.onDuration((secs) => {
      setRecordingDuration(secs);
    });
    return () => {
      unsub();
      voiceRecorderRef.current.cancel();
    };
  }, []);

  const messagesQuery = useQuery({
    queryKey: ['game-room-messages', roomId],
    queryFn: () => gameApi.getRoomMessages(roomId),
    enabled: visible,
    refetchInterval: visible ? 1500 : false,
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => gameApi.sendRoomMessage(roomId, text),
    onSuccess: (newMsg) => {
      setInputText('');
      cache.setQueryData<GameRoomMessageDto[]>(['game-room-messages', roomId], (old) => {
        if (!old) return [newMsg];
        if (old.some((m) => m.id === newMsg.id)) return old;
        return [...old, newMsg];
      });
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
  });

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    if (visible && messages.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 150);
    }
  }, [visible, messages.length]);

  const handleSend = (textToSend?: string) => {
    const content = (textToSend ?? inputText).trim();
    if (!content || sendMutation.isPending) return;
    sendMutation.mutate(content);
  };

  // --- Photo Upload & Send ---
  const handlePickPhoto = async () => {
    if (sendMutation.isPending || uploadingMedia) return;
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
      const uploadRes = await gameApi.uploadMedia({ uri: asset.uri }, 'photo');
      const caption = inputText.trim() || undefined;
      const photoPayload = formatPhotoMessage(uploadRes.id, caption);
      setInputText('');
      sendMutation.mutate(photoPayload);
    } catch (err) {
      console.warn('Game room photo send failed:', err);
    } finally {
      setUploadingMedia(false);
    }
  };

  // --- Voice Note Recording & Sending ---
  const handleStartRecording = async () => {
    if (sendMutation.isPending || uploadingMedia || isRecordingVoice) return;
    try {
      setShowEmojiPicker(false);
      setIsRecordingVoice(true);
      await voiceRecorderRef.current.start();
    } catch (err) {
      console.warn('Game room voice recording start failed:', err);
      setIsRecordingVoice(false);
    }
  };

  const handleStopAndSendVoice = async () => {
    if (!isRecordingVoice) return;
    try {
      setIsRecordingVoice(false);
      const recResult = await voiceRecorderRef.current.stop();
      if (!recResult.uri) return;

      setUploadingMedia(true);
      const uploadRes = await gameApi.uploadMedia(
        { uri: recResult.uri, blob: recResult.blob },
        'voice',
        recResult.duration
      );
      const voicePayload = formatVoiceMessage(uploadRes.id, recResult.duration);
      sendMutation.mutate(voicePayload);
    } catch (err) {
      console.warn('Game room voice send failed:', err);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleCancelVoiceRecording = () => {
    voiceRecorderRef.current.cancel();
    setIsRecordingVoice(false);
    setRecordingDuration(0);
  };

  const memberMap = new Map<string, GameMember>();
  for (const m of members) {
    memberMap.set(m.userId, m);
  }

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const baseUrl = typeof gameApi?.getBaseUrl === 'function' ? gameApi.getBaseUrl() : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <View style={styles.modalCard} testID="room-chat-modal">
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>{t('room_chat_header_title', '💬 საერთო ჩატი')}</Text>
                <Text style={styles.headerSub}>{t('room_chat_header_sub', 'მაგიდის მონაწილეების მიმოწერა')}</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityLabel={t('room_chat_close', 'ჩატის დახურვა')}
                testID="close-room-chat-btn"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Messages List */}
            <ScrollView
              ref={scrollRef}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesScrollContent}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              {messagesQuery.isLoading && messages.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <ActivityIndicator color="#8b5cf6" size="large" />
                  <Text style={styles.emptySub}>{t('room_chat_loading', 'შეტყობინებები იტვირთება...')}</Text>
                </View>
              ) : messages.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>🍾 💬</Text>
                  <Text style={styles.emptyTitle}>{t('room_chat_empty_title', 'ჯერ მიმოწერა არ არის')}</Text>
                  <Text style={styles.emptySub}>
                    {t('room_chat_empty_sub', 'მიესალმეთ მაგიდის წევრებს ან გამოიყენეთ სწრაფი რეაქციები ქვემოთ!')}
                  </Text>
                </View>
              ) : (
                messages.map((msg) => {
                  const isSelf = msg.senderUserId === currentUserId;
                  const member = memberMap.get(msg.senderUserId);
                  const parsed = parseChatMessage(msg.text, baseUrl, authToken);

                  return (
                    <View
                      key={msg.id}
                      style={[styles.messageRow, isSelf ? styles.selfRow : styles.otherRow]}
                      testID={`chat-msg-${msg.id}`}
                    >
                      {!isSelf && (
                        <View style={styles.avatarWrapper}>
                          {member?.photo ? (
                            <PrivatePhoto
                              photo={member.photo as unknown as Photo}
                              avatar={true}
                              style={styles.avatarImg}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.avatarPlaceholder}>
                              <Text style={styles.avatarEmoji}>{member?.gender === 'woman' ? '👩' : '👨'}</Text>
                            </View>
                          )}
                        </View>
                      )}

                      <View
                        style={[
                          styles.bubble,
                          isSelf ? styles.selfBubble : styles.otherBubble,
                          parsed.type === 'emoji_only' && styles.bubbleEmojiOnly,
                        ]}
                      >
                        {!isSelf && (
                          <Text style={styles.senderName} numberOfLines={1}>
                            {msg.senderDisplayName}
                          </Text>
                        )}

                        {parsed.type === 'photo' ? (
                          <View style={styles.photoContainer}>
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => {
                                setViewerImageUrl(parsed.mediaUrl);
                                setViewerCaption(parsed.caption);
                                setShowViewer(true);
                              }}
                              testID={`room-chat-photo-${msg.id}`}
                            >
                              <Image
                                source={{ uri: parsed.mediaUrl }}
                                style={styles.bubblePhoto}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                            {!!parsed.caption && (
                              <Text
                                style={[
                                  styles.messageText,
                                  isSelf ? styles.selfMessageText : styles.otherMessageText,
                                  { marginTop: 4 },
                                ]}
                              >
                                {parsed.caption}
                              </Text>
                            )}
                          </View>
                        ) : parsed.type === 'voice' ? (
                          <VoiceMessagePlayer
                            mediaUrl={parsed.mediaUrl || ''}
                            durationSeconds={parsed.duration}
                            isOwn={isSelf}
                          />
                        ) : parsed.type === 'emoji_only' ? (
                          <Text style={styles.bubbleEmojiOnlyText}>{parsed.text}</Text>
                        ) : (
                          <Text
                            style={[
                              styles.messageText,
                              isSelf ? styles.selfMessageText : styles.otherMessageText,
                            ]}
                          >
                            {msg.text}
                          </Text>
                        )}

                        <Text style={[styles.timeText, isSelf ? styles.selfTimeText : styles.otherTimeText]}>
                          {formatTime(msg.sentAtUtc)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            {/* Quick Reactions Bar */}
            <View style={styles.quickBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickBarContent}
              >
                {QUICK_CHIPS.map((chip) => {
                  const label = t(chip.key, chip.text);
                  return (
                    <TouchableOpacity
                      key={chip.key}
                      style={styles.quickChip}
                      onPress={() => handleSend(label)}
                      disabled={sendMutation.isPending}
                      testID={`quick-chip-${chip.text}`}
                    >
                      <Text style={styles.quickChipText}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Emoji Picker Drawer */}
            {showEmojiPicker && (
              <ChatEmojiPicker
                onSelectEmoji={(emoji) => setInputText((prev) => prev + emoji)}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}

            {/* Input Bar or Voice Recording Bar */}
            {isRecordingVoice ? (
              <View style={styles.recordingBar} testID="room-voice-recording-bar">
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
                    testID="cancel-room-voice-btn"
                  >
                    <Text style={styles.cancelRecText}>✕</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.sendRecBtn}
                    onPress={() => { void handleStopAndSendVoice(); }}
                    accessibilityRole="button"
                    accessibilityLabel={t('send_voice', 'ხმოვანის გაგზავნა')}
                    testID="send-room-voice-btn"
                  >
                    <Text style={styles.sendRecText}>⬆</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.inputBar}>
                {/* Left side: Voice & Photo (FB Messenger style) */}
                <View style={styles.leftActions}>
                  <TouchableOpacity
                    style={styles.messengerVoiceBtn}
                    onPress={() => { void handleStartRecording(); }}
                    disabled={sendMutation.isPending || uploadingMedia}
                    accessibilityRole="button"
                    accessibilityLabel={t('chat_record_voice', 'ხმოვანის ჩაწერა')}
                    testID="room-start-voice-btn"
                  >
                    <Text style={styles.messengerVoiceIcon}>🎙️</Text>
                  </TouchableOpacity>

                  {!isInputExpanded && (
                    <TouchableOpacity
                      style={styles.messengerActionBtn}
                      onPress={() => { void handlePickPhoto(); }}
                      disabled={uploadingMedia || sendMutation.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={t('chat_photo_btn', 'ფოტოს გაგზავნა')}
                      testID="room-photo-btn"
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
                    style={styles.messengerPillInput}
                    value={inputText}
                    onChangeText={setInputText}
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
                    placeholder={t('room_chat_placeholder', 'დაწერე შეტყობინება...')}
                    placeholderTextColor="rgba(255, 255, 255, 0.45)"
                    maxLength={500}
                    multiline
                    testID="room-chat-input"
                  />

                  {/* Inside emoji smile button */}
                  <TouchableOpacity
                    style={styles.pillEmojiBtn}
                    onPress={() => setShowEmojiPicker((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={t('chat_emoji_btn', 'ემოჯები')}
                    testID="room-emoji-btn"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.pillEmojiText}>{showEmojiPicker ? '⌨️' : '😊'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Right side: small send logo */}
                <TouchableOpacity
                  style={[
                    styles.messengerSendBtn,
                    inputText.trim().length > 0 ? styles.messengerSendBtnActive : styles.messengerSendBtnDisabled,
                  ]}
                  onPress={() => handleSend()}
                  disabled={!inputText.trim() || sendMutation.isPending}
                  testID="room-chat-send-btn"
                  accessibilityLabel={t('room_chat_send', 'შეტყობინების გაგზავნა')}
                  activeOpacity={0.7}
                >
                  {sendMutation.isPending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={[styles.messengerSendIcon, inputText.trim().length > 0 && styles.messengerSendIconActive]}>
                      ➤
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Full-Screen Photo Viewer */}
      <ChatMediaViewerModal
        visible={showViewer}
        imageUrl={viewerImageUrl}
        caption={viewerCaption}
        onClose={() => setShowViewer(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  keyboardContainer: {
    width: '100%',
    maxHeight: '85%',
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  closeBtnText: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: 'bold',
  },
  messagesList: {
    height: 300,
    paddingHorizontal: 16,
  },
  messagesScrollContent: {
    paddingVertical: 12,
    gap: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  emptySub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  selfRow: {
    justifyContent: 'flex-end',
  },
  otherRow: {
    justifyContent: 'flex-start',
  },
  avatarWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 8,
    marginBottom: 2,
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selfBubble: {
    backgroundColor: '#8b5cf6',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderBottomLeftRadius: 4,
  },
  bubbleEmojiOnly: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  bubbleEmojiOnlyText: {
    fontSize: 36,
    lineHeight: 44,
  },
  photoContainer: {
    width: 200,
    borderRadius: 10,
    overflow: 'hidden',
  },
  bubblePhoto: {
    width: 200,
    height: 160,
    borderRadius: 10,
    backgroundColor: '#0f172a',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a78bfa',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  selfMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#f8fafc',
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  selfTimeText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimeText: {
    color: '#64748b',
  },
  quickBar: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 8,
  },
  quickBarContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickChip: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickChipText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0a0f1d',
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
  // Kept for backward compatibility
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconText: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 15,
    marginLeft: 2,
  },
  voiceRecordBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceRecordIcon: {
    fontSize: 17,
    color: '#ffffff',
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0f172a',
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRecText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  sendRecBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendRecText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
  },
});
