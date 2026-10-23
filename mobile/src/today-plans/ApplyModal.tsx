import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../components/theme';
import { Text, Button, TextInput } from '../components/UI';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import type { TodayPlanSummary, CreateTodayPlanResponseRequest } from './api';
import { getActivityMeta, formatPlanTime } from './utils';

interface ApplyModalProps {
  visible: boolean;
  plan: TodayPlanSummary | null;
  onClose: () => void;
  onSubmit: (planId: string, request: CreateTodayPlanResponseRequest) => Promise<void>;
  onOpenPremium?: () => void;
  isSubmitting?: boolean;
}

export function ApplyModal({
  visible,
  plan,
  onClose,
  onSubmit,
  onOpenPremium,
  isSubmitting = false,
}: ApplyModalProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!plan) return null;

  const activityMeta = getActivityMeta(plan.activity);
  const timeFormatted = formatPlanTime(plan.startsAtUtc, t);

  const handleClose = () => {
    setMessage('');
    setErrorMessage(null);
    onClose();
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    try {
      await onSubmit(plan.id, {
        message: message.trim() ? message.trim() : null,
      });
      handleClose();
    } catch (err: unknown) {
      const msg = typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : '';
      if (msg.includes('daily_response_limit_reached') || msg.includes('400')) {
        setErrorMessage(t('today_plans_limit_reached_apply_body', { limit: 3 }));
      } else {
        setErrorMessage(t('today_plans_load_error'));
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>{t('today_plans_apply_title')}</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('today_plans_close')}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Plan Preview Pill */}
            <View style={styles.previewBox}>
              <View style={styles.authorAvatar}>
                {plan.authorPhoto ? (
                  <PrivatePhoto
                    photo={plan.authorPhoto}
                    avatar
                    style={styles.avatarPhoto}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>
                      {plan.authorDisplayName?.charAt(0).toUpperCase() || '👤'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.previewDetails}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {plan.title}
                </Text>
                <Text style={styles.previewMeta}>
                  {activityMeta.icon} {plan.authorDisplayName} • {timeFormatted}
                </Text>
              </View>
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                {errorMessage.includes(t('today_plans_limit_reached_apply_title')) ||
                errorMessage.includes('Premium') || errorMessage.includes('ARENA') ? (
                  <TouchableOpacity
                    style={styles.premiumBannerBtn}
                    onPress={() => {
                      handleClose();
                      onOpenPremium?.();
                    }}
                  >
                    <Text style={styles.premiumBannerBtnText}>
                      {t('today_plans_upgrade_premium')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {/* Subtitle */}
            <Text style={styles.subtitle}>{t('today_plans_apply_subtitle')}</Text>

            {/* Message Input */}
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={t('today_plans_apply_message_placeholder')}
              multiline
              numberOfLines={3}
              maxLength={300}
              style={styles.textArea}
              testID="apply-message-input"
            />

            {/* Submit Button */}
            <Button
              variant="primary"
              title={t('today_plans_apply_submit')}
              onPress={handleSubmit}
              busy={isSubmitting}
              style={styles.submitBtn}
              testID="submit-apply-btn"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.card,
    borderTopRightRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.space.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: theme.colors.muted,
  },
  content: {
    padding: theme.space.lg,
    gap: theme.space.md,
    paddingBottom: 40,
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.space.md,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.colors.soft,
    marginRight: theme.space.md,
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '700',
  },
  previewDetails: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
  },
  previewMeta: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  errorBox: {
    backgroundColor: 'rgba(251, 113, 133, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: theme.radius.control,
    padding: theme.space.md,
    gap: 8,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  premiumBannerBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.control,
    alignSelf: 'flex-start',
  },
  premiumBannerBtnText: {
    color: theme.colors.onPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  submitBtn: {
    marginTop: theme.space.sm,
  },
});
