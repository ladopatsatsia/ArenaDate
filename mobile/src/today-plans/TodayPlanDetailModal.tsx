import React from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { theme } from '../components/theme';
import { Text, Button } from '../components/UI';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import { formatCityName } from '../components/cities';
import { getActivityMeta, formatPlanTime, formatPublicationTime } from './utils';
import type {
  TodayPlanSummary,
  TodayPlanDetail,
  TodayPlansApi,
} from './api';

export interface TodayPlanDetailModalProps {
  visible: boolean;
  plan: TodayPlanSummary | null;
  onClose: () => void;
  onApply?: (plan: TodayPlanSummary) => void;
  onViewApplicants?: (plan: TodayPlanSummary) => void;
  onCancelPlan?: (plan: TodayPlanSummary) => void;
  onWithdrawResponse?: (plan: TodayPlanSummary) => void;
  onOpenChat?: (plan: TodayPlanSummary) => void;
  onPressProfile?: (userId: string) => void;
  isCancelling?: boolean;
  isWithdrawing?: boolean;
  api?: TodayPlansApi;
}

export function TodayPlanDetailModal({
  visible,
  plan,
  onClose,
  onApply,
  onViewApplicants,
  onCancelPlan,
  onWithdrawResponse,
  onOpenChat,
  onPressProfile,
  isCancelling = false,
  isWithdrawing = false,
  api,
}: TodayPlanDetailModalProps) {
  const { t, i18n } = useTranslation();

  // Optionally fetch fresh detail with author bio and photos
  const detailQuery = useQuery({
    queryKey: ['today-plans', plan?.id, 'detail'],
    queryFn: () => (plan && api ? api.getPlanById(plan.id) : null),
    enabled: !!plan && visible && !!api,
    staleTime: 10000,
  });

  if (!plan) return null;

  const activePlan: TodayPlanDetail = (detailQuery.data as TodayPlanDetail) ?? {
    ...plan,
    authorBio: '',
    authorPhotos: plan.authorPhoto ? [plan.authorPhoto] : [],
  };

  const activityMeta = getActivityMeta(activePlan.activity);
  const cityFormatted = formatCityName(activePlan.city, i18n.language);
  const authorCityFormatted = formatCityName(activePlan.authorCity || activePlan.city, i18n.language);
  const startsQuick = formatPlanTime(activePlan.startsAtUtc, t, undefined, i18n.language);

  const photos = activePlan.authorPhotos?.length
    ? activePlan.authorPhotos
    : activePlan.authorPhoto
    ? [activePlan.authorPhoto]
    : [];

  const handleCancel = () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(t('today_plans_cancel_confirm_body'))
        : true;
      if (confirmed) {
        onCancelPlan?.(activePlan);
        onClose();
      }
      return;
    }
    Alert.alert(
      t('today_plans_cancel_confirm_title'),
      t('today_plans_cancel_confirm_body'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('today_plans_cancel_confirm_btn'),
          style: 'destructive',
          onPress: () => {
            onCancelPlan?.(activePlan);
            onClose();
          },
        },
      ]
    );
  };

  const handleWithdraw = () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(t('today_plans_withdraw_confirm_body'))
        : true;
      if (confirmed) {
        onWithdrawResponse?.(activePlan);
        onClose();
      }
      return;
    }
    Alert.alert(
      t('today_plans_withdraw_confirm_title'),
      t('today_plans_withdraw_confirm_body'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('today_plans_withdraw_confirm_btn'),
          style: 'destructive',
          onPress: () => {
            onWithdrawResponse?.(activePlan);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer} testID={`today-plan-detail-modal-${activePlan.id}`}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.activityBadge}>
                <Text style={styles.activityBadgeIcon}>{activityMeta.icon}</Text>
                <Text style={styles.activityBadgeText}>{t(activityMeta.labelKey)}</Text>
              </View>
              {activePlan.state !== 'Open' ? (
                <View
                  style={[
                    styles.stateBadge,
                    activePlan.state === 'Matched' ? styles.matchedBadge : styles.terminalBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.stateBadgeText,
                      activePlan.state === 'Matched' ? styles.matchedBadgeText : styles.terminalBadgeText,
                    ]}
                  >
                    {activePlan.state === 'Matched'
                      ? `✓ ${t('today_plans_matched')}`
                      : activePlan.state === 'Cancelled'
                      ? t('today_plans_cancelled')
                      : t('today_plans_expired')}
                  </Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('today_plans_close')}
              testID="close-plan-detail-modal"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Author Profile Header Box */}
            <TouchableOpacity
              style={styles.authorCard}
              onPress={() => {
                if (onPressProfile) {
                  onClose();
                  onPressProfile(activePlan.authorUserId);
                }
              }}
              activeOpacity={onPressProfile ? 0.7 : 1}
            >
              <View style={styles.authorAvatarContainer}>
                {activePlan.authorPhoto ? (
                  <PrivatePhoto
                    photo={activePlan.authorPhoto}
                    avatar
                    style={styles.authorAvatarPhoto}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>
                      {activePlan.authorDisplayName?.charAt(0).toUpperCase() || '👤'}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.authorInfoCol}>
                <View style={styles.authorNameRow}>
                  <Text style={styles.authorName}>{activePlan.authorDisplayName}</Text>
                  {activePlan.authorAge > 0 ? (
                    <Text style={styles.authorAge}>{activePlan.authorAge}</Text>
                  ) : null}
                </View>
                <Text style={styles.authorLocation}>
                  📍 {authorCityFormatted}
                  {activePlan.district ? ` • ${activePlan.district}` : ''}
                </Text>
              </View>

              <View style={styles.authorRoleBadge}>
                <Text style={styles.authorRoleBadgeText}>
                  {activePlan.isAuthor ? `⭐ ${t('today_plans_tab_my_short')}` : t('today_plans_detail_author')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Author Photos Gallery (if available) */}
            {photos.length > 1 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.photosScroll}
              >
                {photos.map(p => (
                  <View key={p.id} style={styles.photoWrapper}>
                    <PrivatePhoto photo={p} style={styles.profilePhoto} />
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {/* Author Bio (if available) */}
            {activePlan.authorBio ? (
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionLabel}>
                  {t('today_plans_detail_about_author')}
                </Text>
                <Text style={styles.authorBioText}>{activePlan.authorBio}</Text>
              </View>
            ) : null}

            {/* Main Plan Title */}
            <View style={styles.titleSection}>
              <Text style={styles.planTitleText}>{activePlan.title}</Text>
            </View>

            {/* Plan Description */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionLabel}>
                {t('today_plans_detail_description')}
              </Text>
              <View style={styles.descCard}>
                <Text style={styles.descText}>
                  {activePlan.description?.trim() || t('today_plans_detail_no_description')}
                </Text>
              </View>
            </View>

            {/* Key Information Grid */}
            <View style={styles.infoGrid}>
              {/* Meeting Location */}
              <View style={styles.infoItem}>
                <Text style={styles.infoItemIcon}>📍</Text>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemLabel}>
                    {t('today_plans_detail_location')}
                  </Text>
                  <Text style={styles.infoItemValue}>
                    {cityFormatted}
                    {activePlan.district ? ` • ${activePlan.district}` : ''}
                  </Text>
                </View>
              </View>

              {/* Start Time */}
              <View style={styles.infoItem}>
                <Text style={styles.infoItemIcon}>🕒</Text>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemLabel}>
                    {t('today_plans_detail_starts_at')}
                  </Text>
                  <Text style={styles.infoItemValue}>
                    {startsQuick}
                  </Text>
                </View>
              </View>

              {/* Valid Until */}
              <View style={styles.infoItem}>
                <Text style={styles.infoItemIcon}>⏳</Text>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemLabel}>
                    {t('today_plans_detail_expires_at')}
                  </Text>
                  <Text style={styles.infoItemValue}>
                    {formatPlanTime(activePlan.expiresAtUtc, t, undefined, i18n.language)}
                  </Text>
                </View>
              </View>

              {/* Published At */}
              {activePlan.createdAtUtc ? (
                <View style={styles.infoItem}>
                  <Text style={styles.infoItemIcon}>📢</Text>
                  <View style={styles.infoItemContent}>
                    <Text style={styles.infoItemLabel}>
                      {t('today_plans_detail_created_at')}
                    </Text>
                    <Text style={styles.infoItemValue}>
                      {formatPublicationTime(activePlan.createdAtUtc, i18n.language)}
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Budget */}
              <View style={styles.infoItem}>
                <Text style={styles.infoItemIcon}>💰</Text>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemLabel}>
                    {t('today_plans_detail_budget')}
                  </Text>
                  <Text
                    style={[
                      styles.infoItemValue,
                      activePlan.budgetAmount != null && activePlan.budgetAmount > 0
                        ? styles.budgetAmountHighlight
                        : null,
                    ]}
                  >
                    {activePlan.budgetAmount != null && activePlan.budgetAmount > 0
                      ? `${activePlan.budgetAmount} ${activePlan.currency || '₾'}`
                      : t('today_plans_detail_budget_free')}
                  </Text>
                </View>
              </View>

              {/* Responses Count */}
              <View style={styles.infoItem}>
                <Text style={styles.infoItemIcon}>👥</Text>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemLabel}>
                    {t('today_plans_detail_responses')}
                  </Text>
                  <Text style={styles.infoItemValue}>
                    {activePlan.responsesCount > 0
                      ? t('today_plans_applicants_count', { count: activePlan.responsesCount })
                      : t('today_plans_detail_responses_none')}
                  </Text>
                </View>
              </View>

              {/* Target Participants */}
              <View style={styles.infoItem}>
                <Text style={styles.infoItemIcon}>👤</Text>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemLabel}>
                    {t('today_plans_participants_label', 'რამდენი ადამიანი')}
                  </Text>
                  <Text style={styles.infoItemValue}>
                    {activePlan.targetParticipantsCount ?? 1}
                  </Text>
                </View>
              </View>

              {/* Status */}
              <View style={styles.infoItem}>
                <Text style={styles.infoItemIcon}>📌</Text>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemLabel}>
                    {t('today_plans_detail_status')}
                  </Text>
                  <Text style={styles.infoItemValue}>
                    {activePlan.state === 'Open'
                      ? t('today_plans_activity_coffee') ? 'ღიაა (აქტიური)' : 'Open'
                      : activePlan.state === 'Matched'
                      ? t('today_plans_matched')
                      : activePlan.state === 'Cancelled'
                      ? t('today_plans_cancelled')
                      : t('today_plans_expired')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons Section */}
            <View style={styles.actionSection}>
              {activePlan.isAuthor ? (
                // AUTHOR ACTIONS
                <View style={styles.actionColumn}>
                  <Button
                    variant="primary"
                    title={
                      activePlan.responsesCount > 0
                        ? t('today_plans_view_applicants', { count: activePlan.responsesCount })
                        : t('today_plans_applicants_title')
                    }
                    onPress={() => {
                      onClose();
                      onViewApplicants?.(activePlan);
                    }}
                    style={styles.modalActionBtn}
                    testID="modal-view-applicants-btn"
                  />
                  {activePlan.state === 'Open' ? (
                    <Button
                      variant="danger"
                      title={t('today_plans_cancel_plan')}
                      onPress={handleCancel}
                      busy={isCancelling}
                      style={styles.modalActionBtn}
                      testID="modal-cancel-plan-btn"
                    />
                  ) : null}
                </View>
              ) : activePlan.hasApplied ? (
                // APPLICANT ACTIONS
                <View style={styles.actionColumn}>
                  {activePlan.myResponseState === 'Accepted' ? (
                    <View style={styles.acceptedBox}>
                      <Text style={styles.acceptedText}>
                        🎉 {t('today_plans_status_accepted')}
                      </Text>
                      <Button
                        variant="primary"
                        title={t('today_plans_open_chat')}
                        onPress={() => {
                          onClose();
                          onOpenChat?.(activePlan);
                        }}
                        style={styles.modalActionBtn}
                        testID="modal-open-chat-btn"
                      />
                    </View>
                  ) : activePlan.myResponseState === 'Pending' ? (
                    <View style={styles.pendingBox}>
                      <Text style={styles.pendingText} numberOfLines={1}>
                        ⏳ {t('today_plans_joined')}
                      </Text>
                      <Button
                        variant="secondary"
                        title={t('today_plans_withdraw_btn')}
                        onPress={handleWithdraw}
                        busy={isWithdrawing}
                        style={styles.modalActionBtn}
                        testID="modal-withdraw-btn"
                      />
                    </View>
                  ) : (
                    <View style={styles.closedStatusBox}>
                      <Text style={styles.closedStatusText}>
                        {activePlan.myResponseState === 'Rejected'
                          ? t('today_plans_status_rejected')
                          : activePlan.myResponseState === 'Withdrawn'
                          ? t('today_plans_status_withdrawn')
                          : t('today_plans_status_closed')}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                // NON-AUTHOR / NEW VISITOR
                <View style={styles.actionColumn}>
                  <Button
                    variant="primary"
                    title={`💬 ${t('today_plans_join_btn')}`}
                    onPress={() => {
                      onClose();
                      onApply?.(activePlan);
                    }}
                    disabled={activePlan.state !== 'Open'}
                    style={styles.modalActionBtn}
                    testID="modal-join-plan-btn"
                  />
                </View>
              )}

              {/* Close Button */}
              <Button
                variant="secondary"
                title={t('today_plans_close')}
                onPress={onClose}
                style={styles.modalCloseBtn}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.card,
    borderTopRightRadius: theme.radius.card,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activityBadgeIcon: {
    fontSize: 14,
  },
  activityBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  stateBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  matchedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  matchedBadgeText: {
    color: '#10B981',
  },
  terminalBadge: {
    backgroundColor: 'rgba(185, 175, 203, 0.1)',
    borderColor: theme.colors.border,
  },
  terminalBadgeText: {
    color: theme.colors.muted,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 20,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  contentScroll: {
    paddingHorizontal: theme.space.lg,
  },
  scrollContent: {
    gap: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: 40,
  },
  authorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.space.md,
    borderRadius: theme.radius.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  authorAvatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: theme.colors.soft,
    marginRight: theme.space.md,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  authorAvatarPhoto: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  authorInfoCol: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  authorName: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
  },
  authorAge: {
    fontSize: 15,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  authorLocation: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  authorRoleBadge: {
    backgroundColor: theme.colors.soft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  authorRoleBadgeText: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  photosScroll: {
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    height: 260,
  },
  photoWrapper: {
    width: 260,
    height: 260,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    marginRight: 10,
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
  },
  authorBioText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
    backgroundColor: theme.colors.surface,
    padding: theme.space.md,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  titleSection: {
    marginTop: 2,
  },
  planTitleText: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 28,
  },
  detailSection: {
    gap: 6,
  },
  detailSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  descCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.space.md,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  descText: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
  },
  infoGrid: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoItemIcon: {
    fontSize: 18,
    marginTop: 2,
  },
  infoItemContent: {
    flex: 1,
  },
  infoItemLabel: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  infoItemValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '600',
    marginTop: 1,
    lineHeight: 18,
  },
  budgetAmountHighlight: {
    color: theme.colors.match,
    fontWeight: '700',
  },
  actionSection: {
    gap: theme.space.md,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.space.md,
  },
  actionColumn: {
    gap: 8,
  },
  modalActionBtn: {
    width: '100%',
  },
  acceptedBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    padding: theme.space.md,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 8,
    alignItems: 'center',
  },
  acceptedText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 14,
  },
  pendingBox: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    padding: theme.space.md,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    gap: 8,
    alignItems: 'center',
  },
  pendingText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  closedStatusBox: {
    backgroundColor: theme.colors.soft,
    padding: theme.space.md,
    borderRadius: theme.radius.control,
    alignItems: 'center',
  },
  closedStatusText: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: '500',
  },
  modalCloseBtn: {
    marginTop: 2,
  },
});
