import React from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../components/theme';
import { Text, Card, Button } from '../components/UI';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import type { TodayPlanSummary } from './api';
import { getActivityMeta, formatPlanTime, formatPublicationTime } from './utils';
import { formatCityName } from '../components/cities';

interface TodayPlanCardProps {
  plan: TodayPlanSummary;
  onPress?: (plan: TodayPlanSummary) => void;
  onApply?: (plan: TodayPlanSummary) => void;
  onViewApplicants?: (plan: TodayPlanSummary) => void;
  onCancelPlan?: (plan: TodayPlanSummary) => void;
  onWithdrawResponse?: (plan: TodayPlanSummary) => void;
  onOpenChat?: (plan: TodayPlanSummary) => void;
  onPressProfile?: (userId: string) => void;
  isCancelling?: boolean;
  isWithdrawing?: boolean;
}

export function TodayPlanCard({
  plan,
  onPress,
  onApply,
  onViewApplicants,
  onCancelPlan,
  onWithdrawResponse,
  onOpenChat,
  onPressProfile,
  isCancelling = false,
  isWithdrawing = false,
}: TodayPlanCardProps) {
  const { t, i18n } = useTranslation();
  const activityMeta = getActivityMeta(plan.activity);
  const timeFormatted = formatPlanTime(plan.startsAtUtc, t, undefined, i18n.language);
  const cityFormatted = formatCityName(plan.city, i18n.language);

  const handleCancelPress = () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(t('today_plans_cancel_confirm_body'))
        : true;
      if (confirmed) {
        onCancelPlan?.(plan);
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
          onPress: () => onCancelPlan?.(plan),
        },
      ]
    );
  };

  const handleWithdrawPress = () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(t('today_plans_withdraw_confirm_body'))
        : true;
      if (confirmed) {
        onWithdrawResponse?.(plan);
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
          onPress: () => onWithdrawResponse?.(plan),
        },
      ]
    );
  };

  return (
    <Card style={styles.card} testID={`today-plan-card-${plan.id}`}>
      {/* Clickable Card Content: opens full plan details */}
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => onPress?.(plan)}
        testID={`today-plan-card-press-${plan.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${plan.title}, ${t('today_plans_detail_view_hint')}`}
      >
        {/* Top Author Row */}
        <View style={styles.authorRow}>
          <TouchableOpacity
            style={styles.authorClickable}
            onPress={() => (onPressProfile ? onPressProfile(plan.authorUserId) : onPress?.(plan))}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${plan.authorDisplayName}, ${plan.authorAge}`}
          >
            <View style={styles.avatarContainer}>
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
            <View style={styles.authorDetails}>
              <View style={styles.nameAgeRow}>
                <Text style={styles.authorName}>{plan.authorDisplayName}</Text>
                <Text style={styles.authorAge}>{plan.authorAge}</Text>
              </View>
              <View style={styles.authorLocationRow}>
                <Text style={styles.authorLocation}>
                  📍 {cityFormatted}
                  {plan.district ? ` • ${plan.district}` : ''}
                </Text>
                {plan.createdAtUtc ? (
                  <Text style={styles.publishedTimeText}>
                    • {formatPublicationTime(plan.createdAtUtc, i18n.language)}
                  </Text>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>

          {/* Activity Badge */}
          <View style={styles.activityBadge}>
            <Text style={styles.activityBadgeIcon}>{activityMeta.icon}</Text>
            <Text style={styles.activityBadgeText}>{t(activityMeta.labelKey)}</Text>
          </View>
        </View>

        {/* Plan Title & Meta */}
        <View style={styles.bodySection}>
          <Text style={styles.planTitle}>{plan.title}</Text>
          {plan.description ? (
            <Text style={styles.planDescription} numberOfLines={3}>
              {plan.description}
            </Text>
          ) : null}

          {/* Info Tags: Time, Participants & Budget */}
          <View style={styles.tagsRow}>
            <View style={styles.tagPill}>
              <Text style={styles.tagPillText}>🕒 {timeFormatted}</Text>
            </View>
            <View style={[styles.tagPill, styles.participantsPill]} testID={`plan-participants-${plan.id}`}>
              <Text style={styles.participantsPillText}>👤 {plan.targetParticipantsCount ?? 1}</Text>
            </View>
            {plan.budgetAmount != null && plan.budgetAmount > 0 ? (
              <View style={[styles.tagPill, styles.budgetPill]}>
                <Text style={styles.budgetPillText}>
                  💰 {plan.budgetAmount} {plan.currency || '₾'}
                </Text>
              </View>
            ) : null}
            {plan.state !== 'Open' ? (
              <View
                style={[
                  styles.tagPill,
                  plan.state === 'Matched' ? styles.matchedPill : styles.terminalPill,
                ]}
              >
                <Text
                  style={[
                    styles.tagPillText,
                    plan.state === 'Matched' ? styles.matchedPillText : styles.terminalPillText,
                  ]}
                >
                  {plan.state === 'Matched'
                    ? `✓ ${t('today_plans_matched')}`
                    : plan.state === 'Cancelled'
                    ? t('today_plans_cancelled')
                    : t('today_plans_expired')}
                </Text>
              </View>
            ) : null}
          </View>

          {/* View Details Hint */}
          <View style={styles.viewDetailsRow}>
            <Text style={styles.viewDetailsText}>
              {t('today_plans_detail_view_hint', 'დეტალების ნახვა ›')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Action Footer */}
      <View style={styles.actionRow}>
        {plan.isAuthor ? (
          // AUTHOR ACTIONS
          <View style={styles.authorActionsContainer}>
            <Button
              variant="primary"
              title={
                plan.responsesCount > 0
                  ? t('today_plans_view_applicants', { count: plan.responsesCount })
                  : t('today_plans_applicants_title')
              }
              onPress={() => onViewApplicants?.(plan)}
              style={styles.actionBtn}
              testID={`view-applicants-btn-${plan.id}`}
            />
            {plan.state === 'Open' ? (
              <Button
                variant="danger"
                title={t('today_plans_cancel_plan')}
                onPress={handleCancelPress}
                busy={isCancelling}
                style={styles.cancelBtn}
                testID={`cancel-plan-btn-${plan.id}`}
              />
            ) : null}
          </View>
        ) : plan.hasApplied ? (
          // APPLICANT ACTIONS
          <View style={styles.applicantActionsContainer}>
            {plan.myResponseState === 'Accepted' ? (
              <View style={styles.acceptedRow}>
                <View style={styles.acceptedBadge}>
                  <Text style={styles.acceptedBadgeText} numberOfLines={1}>
                    🎉 {t('today_plans_status_accepted')}
                  </Text>
                </View>
                <Button
                  variant="primary"
                  title={t('today_plans_open_chat')}
                  onPress={() => onOpenChat?.(plan)}
                  style={styles.chatBtn}
                  testID={`open-chat-btn-${plan.id}`}
                />
              </View>
            ) : plan.myResponseState === 'Pending' ? (
              <View style={styles.pendingRow}>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText} numberOfLines={1}>
                    ⏳ {t('today_plans_joined')}
                  </Text>
                </View>
                <Button
                  variant="secondary"
                  title={t('today_plans_withdraw_btn')}
                  onPress={handleWithdrawPress}
                  busy={isWithdrawing}
                  style={styles.withdrawBtn}
                  testID={`withdraw-btn-${plan.id}`}
                />
              </View>
            ) : (
              <View style={styles.statusBadgeOnly}>
                <Text style={styles.statusBadgeText}>
                  {plan.myResponseState === 'Rejected'
                    ? t('today_plans_status_rejected')
                    : plan.myResponseState === 'Withdrawn'
                    ? t('today_plans_status_withdrawn')
                    : t('today_plans_status_closed')}
                </Text>
              </View>
            )}
          </View>
        ) : (
          // NON-AUTHOR / NEW VISITOR ACTION
          <Button
            variant="primary"
            title={`💬 ${t('today_plans_join_btn')}`}
            onPress={() => onApply?.(plan)}
            disabled={plan.state !== 'Open'}
            style={styles.joinBtn}
            testID={`join-plan-btn-${plan.id}`}
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.space.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.space.md,
    gap: theme.space.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: theme.colors.soft,
    marginRight: theme.space.md,
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
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  authorDetails: {
    flex: 1,
  },
  nameAgeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  authorAge: {
    fontSize: 14,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  authorLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  authorLocation: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  publishedTimeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '400',
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    fontWeight: '600',
    color: theme.colors.primary,
  },
  bodySection: {
    gap: 6,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 24,
  },
  planDescription: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tagPill: {
    backgroundColor: theme.colors.soft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagPillText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '500',
  },
  budgetPill: {
    backgroundColor: 'rgba(251, 113, 133, 0.12)',
    borderColor: 'rgba(251, 113, 133, 0.3)',
  },
  budgetPillText: {
    fontSize: 12,
    color: theme.colors.match,
    fontWeight: '600',
  },
  participantsPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  participantsPillText: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '700',
  },
  matchedPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  matchedPillText: {
    color: '#10B981',
    fontWeight: '600',
  },
  terminalPill: {
    backgroundColor: 'rgba(185, 175, 203, 0.1)',
    borderColor: theme.colors.border,
  },
  terminalPillText: {
    color: theme.colors.muted,
  },
  actionRow: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(54, 43, 78, 0.6)',
    paddingTop: theme.space.md,
  },
  authorActionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
  },
  cancelBtn: {
    paddingHorizontal: 14,
  },
  applicantActionsContainer: {
    width: '100%',
  },
  acceptedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  acceptedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 44,
  },
  acceptedBadgeText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 12.5,
    textAlign: 'center',
  },
  chatBtn: {
    paddingHorizontal: 16,
    minHeight: 44,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pendingBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: theme.radius.control,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 44,
  },
  pendingBadgeText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 12.5,
    textAlign: 'center',
  },
  withdrawBtn: {
    paddingHorizontal: 14,
    minHeight: 44,
  },
  statusBadgeOnly: {
    backgroundColor: theme.colors.soft,
    padding: 10,
    borderRadius: theme.radius.control,
    alignItems: 'center',
  },
  statusBadgeText: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  joinBtn: {
    width: '100%',
  },
  viewDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
});
