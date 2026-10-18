import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import type { Photo } from '../profile/api';

interface SuperLikeModalProps {
  visible: boolean;
  targetUser: {
    id: string;
    displayName: string;
    age: number | string;
    photo?: Photo | null;
  } | null;
  userBalance: number;
  isSending: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  onTopUpCrystals: () => void;
}

export function SuperLikeModal({
  visible,
  targetUser,
  userBalance,
  isSending,
  onClose,
  onConfirm,
  onTopUpCrystals,
}: SuperLikeModalProps) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');

  if (!targetUser) return null;

  const hasEnoughCrystals = userBalance >= 20;

  const handleSend = () => {
    if (!hasEnoughCrystals || isSending) return;
    onConfirm(note.trim());
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropDismiss} onPress={onClose} />
        <View style={styles.modalCard} accessibilityViewIsModal testID="super-like-modal">
          {/* Glowing Top Star Header */}
          <View style={styles.starGlowContainer}>
            <View style={styles.starCircle}>
              <Text style={styles.starEmoji}>⭐</Text>
            </View>
          </View>

          <Text style={styles.title}>
            {t('superlike_title', 'სუპერ ლაიქი')}
          </Text>

          <Text style={styles.subtitle}>
            {t('superlike_desc', 'გამოირჩიე სხვებისგან! შენი მოწონება და მესიჯი პირველ ადგილზე გამოჩნდება.')}
          </Text>

          {/* Target Profile Snippet */}
          <View style={styles.targetRow}>
            <View style={styles.avatarWrapper}>
              {targetUser.photo ? (
                <PrivatePhoto photo={targetUser.photo} avatar style={styles.avatar} />
              ) : (
                <Text style={{ fontSize: 24 }}>👤</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.targetName}>
                {targetUser.displayName}, {targetUser.age}
              </Text>
              <View style={styles.pricePill}>
                <Text style={styles.pricePillText}>
                  {t('superlike_cost', 'ღირებულება: 20 💎')}
                </Text>
              </View>
            </View>
          </View>

          {/* Balance Status */}
          <View style={[styles.balanceBar, !hasEnoughCrystals && styles.balanceBarWarning]}>
            <Text style={styles.balanceText}>
              {t('superlike_your_balance', 'შენი ბალანსი:')} <Text style={styles.balanceHighlight}>{userBalance} 💎</Text>
            </Text>
            {!hasEnoughCrystals && (
              <Pressable
                onPress={() => {
                  onClose();
                  onTopUpCrystals();
                }}
                style={styles.topUpLink}
              >
                <Text style={styles.topUpLinkText}>
                  {t('superlike_topup_link', '+ შევსება')}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Message / Note Box */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>
              {t('superlike_input_label', 'პირადი მესიჯი (არასავალდებულო):')}
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('superlike_input_placeholder', 'დაუწერე კომპლიმენტი ან მოკლე შეტყობინება…')}
              placeholderTextColor="#64748B"
              value={note}
              onChangeText={setNote}
              maxLength={300}
              multiline
              numberOfLines={3}
              editable={!isSending}
              testID="superlike-note-input"
            />
            <Text style={styles.charCounter}>{note.length} / 300</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isSending}
            >
              <Text style={styles.cancelText}>{t('cancel', 'გაუქმება')}</Text>
            </Pressable>

            {hasEnoughCrystals ? (
              <Pressable
                style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={isSending}
                testID="confirm-superlike-btn"
              >
                {isSending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.sendButtonIcon}>⭐</Text>
                    <Text style={styles.sendButtonText}>
                      {t('superlike_send_btn', 'გაგზავნა (20 💎)')}
                    </Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={styles.topUpButton}
                onPress={() => {
                  onClose();
                  onTopUpCrystals();
                }}
                testID="superlike-topup-btn"
              >
                <Text style={styles.topUpButtonText}>
                  {t('superlike_topup_btn', '💎 შეივსე ბალანსი')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 3, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#0284C7',
    padding: 22,
    alignItems: 'center',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  starGlowContainer: {
    marginTop: -42,
    marginBottom: 8,
  },
  starCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0369A1',
    borderWidth: 3,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 8,
  },
  starEmoji: {
    fontSize: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    padding: 10,
    gap: 12,
    marginBottom: 12,
  },
  avatarWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
  },
  targetName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  pricePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 3,
  },
  pricePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  balanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 14,
  },
  balanceBarWarning: {
    borderColor: '#F59E0B',
    borderWidth: 1,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  balanceText: {
    fontSize: 13,
    color: '#CBD5E1',
  },
  balanceHighlight: {
    fontWeight: '800',
    color: '#38BDF8',
  },
  topUpLink: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  topUpLinkText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#F8FAFC',
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  charCounter: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  sendButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonIcon: {
    fontSize: 16,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  topUpButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topUpButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
