import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../components/theme';
import { Text, Button } from '../components/UI';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import type { TodayPlanSummary, TodayPlanApplicant } from './api';
import { formatCityName } from '../components/cities';

interface ApplicantsModalProps {
  visible: boolean;
  plan: TodayPlanSummary | null;
  applicants: TodayPlanApplicant[];
  isLoading: boolean;
  onClose: () => void;
  onAccept: (applicant: TodayPlanApplicant) => Promise<void>;
  onReject: (applicant: TodayPlanApplicant) => Promise<void>;
  onOpenProfile: (applicant: TodayPlanApplicant) => void;
  onOpenChat?: (plan: TodayPlanSummary) => void;
  acceptingId?: string | null;
  rejectingId?: string | null;
}

export function ApplicantsModal({
  visible,
  plan,
  applicants,
  isLoading,
  onClose,
  onAccept,
  onReject,
  onOpenProfile,
  onOpenChat,
  acceptingId = null,
  rejectingId = null,
}: ApplicantsModalProps) {
  const { t, i18n } = useTranslation();
  const [confirmingApplicant, setConfirmingApplicant] = React.useState<TodayPlanApplicant | null>(null);

  if (!plan) return null;

  const handleAcceptPress = (applicant: TodayPlanApplicant) => {
    setConfirmingApplicant(applicant);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>{t('today_plans_applicants_title')}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {plan.title}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('today_plans_close')}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          {isLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator color={theme.colors.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={applicants}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>👥</Text>
                  <Text style={styles.emptyText}>
                    {t('today_plans_applicants_empty')}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isAccepting = acceptingId === item.id;
                const isRejecting = rejectingId === item.id;
                const cityFormatted = formatCityName(item.city, i18n.language);

                return (
                  <View style={styles.applicantCard} testID={`applicant-card-${item.id}`}>
                    <TouchableOpacity
                      style={styles.applicantTopRow}
                      onPress={() => onOpenProfile(item)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.avatarContainer}>
                        {item.photo ? (
                          <PrivatePhoto photo={item.photo} avatar style={styles.avatarPhoto} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarFallbackText}>
                              {item.displayName?.charAt(0).toUpperCase() || '👤'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.applicantDetails}>
                        <View style={styles.nameRow}>
                          <Text style={styles.applicantName}>{item.displayName}</Text>
                          <Text style={styles.applicantAge}>{item.age}</Text>
                        </View>
                        <Text style={styles.applicantLocation}>📍 {cityFormatted}</Text>
                      </View>
                      <View style={styles.viewProfileChip}>
                        <Text style={styles.viewProfileChipText}>
                          {t('today_plans_view_profile')} →
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Message / Note */}
                    {item.message ? (
                      <View style={styles.messageBubble}>
                        <Text style={styles.messageText}>"{item.message}"</Text>
                      </View>
                    ) : null}

                    {/* Bio preview if available */}
                    {item.bio ? (
                      <Text style={styles.bioText} numberOfLines={2}>
                        {item.bio}
                      </Text>
                    ) : null}

                    {/* Actions based on state */}
                    <View style={styles.applicantActionRow}>
                      {item.state === 'Pending' ? (
                        <View style={styles.buttonGroup}>
                          <Button
                            variant="primary"
                            title={`✓ ${t('today_plans_applicant_accept')}`}
                            onPress={() => handleAcceptPress(item)}
                            busy={isAccepting}
                            disabled={isRejecting}
                            style={styles.acceptBtn}
                            testID={`accept-applicant-btn-${item.id}`}
                          />
                          <Button
                            variant="secondary"
                            title={t('today_plans_applicant_reject')}
                            onPress={() => onReject(item)}
                            busy={isRejecting}
                            disabled={isAccepting}
                            style={styles.rejectBtn}
                            testID={`reject-applicant-btn-${item.id}`}
                          />
                        </View>
                      ) : item.state === 'Accepted' ? (
                        <View style={styles.acceptedRow}>
                          <View style={styles.acceptedBadge}>
                            <Text style={styles.acceptedBadgeText}>
                              🎉 {t('today_plans_applicant_accepted')}
                            </Text>
                          </View>
                          <Button
                            variant="primary"
                            title={t('today_plans_open_chat')}
                            onPress={() => {
                              onClose();
                              onOpenChat?.(plan);
                            }}
                            style={styles.chatBtn}
                            testID={`applicant-chat-btn-${item.id}`}
                          />
                        </View>
                      ) : (
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillText}>
                            {item.state === 'Rejected'
                              ? t('today_plans_applicant_rejected')
                              : item.state === 'Withdrawn'
                              ? t('today_plans_applicant_withdrawn')
                              : t('today_plans_status_closed')}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              }}
            />
          )}

          </View>

          {/* Inline Cross-Platform Confirmation Dialog */}
          {confirmingApplicant ? (
            <View style={styles.confirmOverlay} testID="confirm-accept-dialog">
              <View style={styles.confirmCard}>
                <Text style={styles.confirmEmoji}>🤝</Text>
                <Text style={styles.confirmTitle}>
                  {t('today_plans_applicant_accept_confirm_title')}
                </Text>
                <Text style={styles.confirmBody}>
                  {t('today_plans_applicant_accept_confirm_body', {
                    name: confirmingApplicant.displayName,
                  })}
                </Text>

                <View style={styles.confirmBtnRow}>
                  <Button
                    variant="primary"
                    title={t('today_plans_applicant_accept_confirm_btn')}
                    onPress={async () => {
                      const target = confirmingApplicant;
                      setConfirmingApplicant(null);
                      await onAccept(target);
                    }}
                    busy={acceptingId === confirmingApplicant.id}
                    style={styles.confirmActionBtn}
                    testID="confirm-accept-applicant-btn"
                  />
                  <Button
                    variant="secondary"
                    title={t('cancel')}
                    onPress={() => setConfirmingApplicant(null)}
                    disabled={acceptingId === confirmingApplicant.id}
                    style={styles.confirmCancelBtn}
                    testID="cancel-accept-applicant-btn"
                  />
                </View>
              </View>
            </View>
          ) : null}
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
    maxHeight: '85%',
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
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 2,
    maxWidth: 240,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: theme.colors.muted,
  },
  centerContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: theme.space.lg,
    gap: theme.space.md,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  applicantCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  applicantTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: theme.colors.soft,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
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
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: '700',
  },
  applicantDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  applicantName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  applicantAge: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  applicantLocation: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 1,
  },
  viewProfileChip: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewProfileChipText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  messageBubble: {
    backgroundColor: theme.colors.soft,
    padding: 10,
    borderRadius: theme.radius.control,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  messageText: {
    fontSize: 13,
    color: theme.colors.text,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  bioText: {
    fontSize: 12,
    color: theme.colors.muted,
    lineHeight: 16,
  },
  applicantActionRow: {
    marginTop: 4,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    flex: 1,
  },
  rejectBtn: {
    flex: 1,
  },
  acceptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  acceptedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    flex: 1,
  },
  acceptedBadgeText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 13,
  },
  chatBtn: {
    paddingHorizontal: 16,
  },
  statusPill: {
    backgroundColor: theme.colors.soft,
    padding: 8,
    borderRadius: theme.radius.control,
    alignItems: 'center',
  },
  statusPillText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.space.lg,
    zIndex: 9999,
  },
  confirmCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.space.xl,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  confirmEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmBody: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  confirmBtnRow: {
    width: '100%',
    gap: 10,
  },
  confirmActionBtn: {
    width: '100%',
  },
  confirmCancelBtn: {
    width: '100%',
  },
});
