import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { theme } from '../components/theme';
import { Text, TodayPlansSkeleton } from '../components/UI';
import { formatCityName } from '../components/cities';
import { PremiumModal } from '../premium/PremiumModal';
import {
  TodayPlansApi,
  type TodayPlanSummary,
  type TodayPlanApplicant,
  type CreateTodayPlanRequest,
  type CreateTodayPlanResponseRequest,
} from './api';
import { TodayPlanCard } from './TodayPlanCard';
import { CreatePlanModal } from './CreatePlanModal';
import { ApplyModal } from './ApplyModal';
import { ApplicantsModal } from './ApplicantsModal';
import { ApplicantProfileModal } from './ApplicantProfileModal';
import { TodayPlansFilterModal, type DayFilter } from './TodayPlansFilterModal';
import { TodayPlanDetailModal } from './TodayPlanDetailModal';

type FeedTab = 'all' | 'my_plans' | 'my_responses';

function FilterFunnelIcon({ color = '#FFFFFF', size = 18 }: { color?: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      testID="today-plans-filter-funnel-icon"
    >
      <View
        style={{
          width: 14,
          height: 2.2,
          backgroundColor: color,
          borderRadius: 1.5,
          marginBottom: 2.5,
        }}
      />
      <View
        style={{
          width: 9,
          height: 2.2,
          backgroundColor: color,
          borderRadius: 1.5,
          marginBottom: 2.5,
        }}
      />
      <View
        style={{
          width: 4,
          height: 2.2,
          backgroundColor: color,
          borderRadius: 1.5,
        }}
      />
    </View>
  );
}

export function TodayPlansScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { api: authApi, manager, state: authState } = useAuth();
  const cache = useQueryClient();
  const accountId = authState.account?.id;

  const api = useMemo(
    () => new TodayPlansApi(authApi, manager),
    [authApi, manager, accountId]
  );

  // Screen State
  const [activeTab, setActiveTab] = useState<FeedTab>('all');
  const [filterCity, setFilterCity] = useState<string>('all');
  const [filterActivity, setFilterActivity] = useState<string>('all');
  const [filterDay, setFilterDay] = useState<DayFilter>('all');

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [applyPlan, setApplyPlan] = useState<TodayPlanSummary | null>(null);
  const [applicantsPlan, setApplicantsPlan] = useState<TodayPlanSummary | null>(null);
  const [profileApplicant, setProfileApplicant] = useState<TodayPlanApplicant | null>(null);
  const [detailPlan, setDetailPlan] = useState<TodayPlanSummary | null>(null);
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // In-flight Action Trackers
  const [cancellingPlanId, setCancellingPlanId] = useState<string | null>(null);
  const [withdrawingPlanId, setWithdrawingPlanId] = useState<string | null>(null);
  const [acceptingApplicantId, setAcceptingApplicantId] = useState<string | null>(null);
  const [rejectingApplicantId, setRejectingApplicantId] = useState<string | null>(null);

  // Queries
  const limitsQueryKey = ['today-plans', 'limits', accountId];
  const limitsQuery = useQuery({
    queryKey: limitsQueryKey,
    queryFn: api.getLimits,
    staleTime: 15000,
  });

  const publicFeedKey = [
    'today-plans',
    'public',
    filterCity,
    filterActivity,
    filterDay,
  ];
  const publicFeed = useInfiniteQuery({
    queryKey: publicFeedKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      api.getPublicPlans({
        city: filterCity === 'all' ? undefined : filterCity,
        activity: filterActivity === 'all' ? undefined : filterActivity,
        day: filterDay === 'all' ? undefined : filterDay,
        cursor: pageParam,
        limit: 15,
      }),
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: activeTab === 'all',
  });

  const myPlansKey = ['today-plans', 'my', accountId];
  const myPlansQuery = useQuery({
    queryKey: myPlansKey,
    queryFn: api.getMyPlans,
    enabled: activeTab === 'my_plans',
  });

  const myResponsesKey = ['today-plans', 'my-responses', accountId];
  const myResponsesQuery = useQuery({
    queryKey: myResponsesKey,
    queryFn: api.getMyResponses,
    enabled: activeTab === 'my_responses',
  });

  const applicantsKey = ['today-plans', applicantsPlan?.id, 'applicants'];
  const applicantsQuery = useQuery({
    queryKey: applicantsKey,
    queryFn: () => (applicantsPlan ? api.getApplicants(applicantsPlan.id) : Promise.resolve([])),
    enabled: !!applicantsPlan,
  });

  // Invalidate all plan lists helper
  const invalidateAllFeeds = useCallback(() => {
    void cache.invalidateQueries({ queryKey: ['today-plans'] });
  }, [cache]);

  const activeFiltersCount = useMemo(() => {
    return (
      (filterCity !== 'all' ? 1 : 0) +
      (filterActivity !== 'all' ? 1 : 0) +
      (filterDay !== 'all' ? 1 : 0)
    );
  }, [filterCity, filterActivity, filterDay]);

  const hasActiveFilters = activeFiltersCount > 0;

  const handleResetFilters = useCallback(() => {
    setFilterCity('all');
    setFilterActivity('all');
    setFilterDay('all');
  }, []);

  // Mutations
  const createPlanMutation = useMutation({
    mutationFn: (request: CreateTodayPlanRequest) => api.createPlan(request),
    onSuccess: () => {
      invalidateAllFeeds();
      setActiveTab('my_plans');
    },
  });

  const cancelPlanMutation = useMutation({
    mutationFn: (planId: string) => api.cancelPlan(planId),
    onMutate: (planId) => setCancellingPlanId(planId),
    onSettled: () => setCancellingPlanId(null),
    onSuccess: () => invalidateAllFeeds(),
  });

  const applyMutation = useMutation({
    mutationFn: ({
      planId,
      request,
    }: {
      planId: string;
      request: CreateTodayPlanResponseRequest;
    }) => api.createResponse(planId, request),
    onSuccess: () => {
      invalidateAllFeeds();
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: ({ planId, responseId }: { planId: string; responseId: string }) =>
      api.withdrawResponse(planId, responseId),
    onMutate: ({ planId }) => setWithdrawingPlanId(planId),
    onSettled: () => setWithdrawingPlanId(null),
    onSuccess: () => invalidateAllFeeds(),
  });

  const acceptApplicantMutation = useMutation({
    mutationFn: ({ planId, responseId }: { planId: string; responseId: string }) =>
      api.acceptResponse(planId, responseId),
    onMutate: ({ responseId }) => setAcceptingApplicantId(responseId),
    onSettled: () => setAcceptingApplicantId(null),
    onSuccess: (result) => {
      invalidateAllFeeds();
      setApplicantsPlan(null);
      if (result.conversationId) {
        router.push({
          pathname: '/chat/[id]',
          params: { id: result.conversationId },
        });
      }
    },
    onError: (err: any) => {
      console.error('[TodayPlansScreen] Accept applicant error:', err);
      const code = err?.code || err?.message || 'request_failed';
      let message = t('today_plans_accept_error') || 'დათანხმება ვერ მოხერხდა';
      if (code === 'plan_already_matched') {
        message = 'გეგმა უკვე დაკავებულია ან დათანხმებული.';
      } else if (code === 'plan_expired') {
        message = 'გეგმის მოქმედების ვადა ამოიწურა.';
      } else if (code === 'response_not_pending') {
        message = 'კანდიდატმა უკვე გააუქმა განაცხადი ან განაცხადი არ არის აქტიური.';
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(message);
      } else {
        Alert.alert(t('error') || 'შეცდომა', message);
      }
    },
  });

  const rejectApplicantMutation = useMutation({
    mutationFn: ({ planId, responseId }: { planId: string; responseId: string }) =>
      api.rejectResponse(planId, responseId),
    onMutate: ({ responseId }) => setRejectingApplicantId(responseId),
    onSettled: () => setRejectingApplicantId(null),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: applicantsKey });
      invalidateAllFeeds();
    },
  });

  // Action handlers
  const handleOpenCreate = () => {
    if (limitsQuery.data && !limitsQuery.data.canCreatePlan) {
      setPremiumModalVisible(true);
      return;
    }
    setCreateModalVisible(true);
  };

  const handleApplyPress = (plan: TodayPlanSummary) => {
    if (limitsQuery.data && !limitsQuery.data.canApply) {
      setPremiumModalVisible(true);
      return;
    }
    setApplyPlan(plan);
  };

  const handleCancelPress = (plan: TodayPlanSummary) => {
    cancelPlanMutation.mutate(plan.id);
  };

  const handleWithdrawPress = (plan: TodayPlanSummary) => {
    if (!plan.myResponseId) return;
    withdrawMutation.mutate({ planId: plan.id, responseId: plan.myResponseId });
  };

  const handleOpenChat = (plan: TodayPlanSummary) => {
    // If conversationId is returned in Detail or myResponseDto
    if ('conversationId' in plan && (plan as { conversationId?: string }).conversationId) {
      router.push({
        pathname: '/chat/[id]',
        params: { id: (plan as { conversationId: string }).conversationId },
      });
    } else {
      // Navigate to messages tab as fallback
      router.push('/(tabs)/messages');
    }
  };

  // Prepare active list data
  const feedItems: TodayPlanSummary[] = useMemo(() => {
    if (activeTab === 'all') {
      return (
        publicFeed.data?.pages.flatMap(p => p.items) ?? []
      );
    }
    if (activeTab === 'my_plans') {
      return myPlansQuery.data ?? [];
    }
    if (activeTab === 'my_responses') {
      return (
        myResponsesQuery.data?.map(r => ({
          id: r.planId,
          authorUserId: r.authorUserId,
          authorDisplayName: r.authorDisplayName,
          authorAge: 0,
          authorCity: r.planCity,
          authorPhoto: r.authorPhoto,
          city: r.planCity,
          district: r.planDistrict,
          activity: r.planActivity,
          title: r.planTitle,
          description: r.message ? `"${r.message}"` : '',
          startsAtUtc: r.planStartsAtUtc,
          expiresAtUtc: r.planExpiresAtUtc,
          budgetAmount: null,
          currency: 'GEL',
          state: r.planState,
          responsesCount: 0,
          isAuthor: false,
          hasApplied: true,
          myResponseState: r.state,
          myResponseId: r.responseId,
          createdAtUtc: r.createdAtUtc,
          conversationId: r.conversationId,
        })) ?? []
      );
    }
    return [];
  }, [
    activeTab,
    publicFeed.data,
    myPlansQuery.data,
    myResponsesQuery.data,
  ]);

  const isCurrentFeedLoading =
    activeTab === 'all'
      ? publicFeed.isLoading
      : activeTab === 'my_plans'
      ? myPlansQuery.isLoading
      : myResponsesQuery.isLoading;

  const isCurrentFeedRefetching =
    activeTab === 'all'
      ? publicFeed.isRefetching
      : activeTab === 'my_plans'
      ? myPlansQuery.isRefetching
      : myResponsesQuery.isRefetching;

  const handleRefresh = async () => {
    void limitsQuery.refetch();
    if (activeTab === 'all') await publicFeed.refetch();
    if (activeTab === 'my_plans') await myPlansQuery.refetch();
    if (activeTab === 'my_responses') await myResponsesQuery.refetch();
  };

  const limits = limitsQuery.data;
  const isLimitReached =
    limits && (!limits.canCreatePlan || !limits.canApply);

  return (
    <View style={styles.container}>
      {/* 1. TOP QUOTA / LIMITS BAR */}
      <View style={styles.limitsBar}>
        <View style={styles.limitsTextContainer}>
          <Text style={styles.limitsInfoText}>
            {limits
              ? t('today_plans_limits_info', {
                  activeCount: limits.activePlansCount,
                  activeLimit: limits.activePlansLimit,
                  usedCount: limits.dailyResponsesUsed,
                  dailyLimit: limits.dailyResponsesLimit,
                })
              : '...'}
          </Text>
        </View>
        {isLimitReached || (limits && !limits.hasPremium) ? (
          <TouchableOpacity
            style={styles.premiumBadgeBtn}
            onPress={() => setPremiumModalVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('today_plans_upgrade_premium')}
          >
            <Text style={styles.premiumBadgeText}>
              {t('today_plans_upgrade_premium')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* 2. COMPACT SEGMENT SELECTOR (✨ ყველა / 📝 ჩემი / 💌 პასუხები) + SMALL FILTER BUTTON */}
      <View style={styles.tabsRow}>
        <View style={styles.tabsList}>
          {(
            [
              {
                key: 'all',
                shortLabelKey: 'today_plans_tab_all_short',
                icon: '✨',
                count: undefined,
              },
              {
                key: 'my_plans',
                shortLabelKey: 'today_plans_tab_my_short',
                icon: '📝',
                count: myPlansQuery.data?.length,
              },
              {
                key: 'my_responses',
                shortLabelKey: 'today_plans_tab_responses_short',
                icon: '💌',
                count: myResponsesQuery.data?.length,
              },
            ] as const
          ).map(tab => {
            const selected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tabButton,
                  tab.key === 'my_responses' && styles.tabButtonResponses,
                  selected && styles.tabButtonSelected,
                ]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
                testID={`feed-tab-${tab.key}`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <View style={styles.tabContentRow}>
                  <Text style={styles.tabIcon}>{tab.icon}</Text>
                  <Text
                    style={[styles.tabButtonText, selected && styles.tabButtonTextSelected]}
                    numberOfLines={1}
                  >
                    {t(tab.shortLabelKey)}
                  </Text>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <View
                      style={[
                        styles.tabCountPill,
                        selected && styles.tabCountPillSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.tabCountText,
                          selected && styles.tabCountTextSelected,
                        ]}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'all' && (
          <TouchableOpacity
            style={[
              styles.filterIconBtn,
              hasActiveFilters && styles.filterIconBtnActive,
            ]}
            onPress={() => setFilterModalVisible(true)}
            activeOpacity={0.8}
            testID="open-filters-modal-btn"
            accessibilityRole="button"
            accessibilityLabel={t('today_plans_filters_open_btn')}
          >
            <FilterFunnelIcon
              color={hasActiveFilters ? '#c084fc' : '#94A3B8'}
              size={18}
            />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* 4. ACTIVE FILTERS SUMMARY (only when filtered on 'all') */}
      {activeTab === 'all' && hasActiveFilters && (
        <View style={styles.activeFiltersRow}>
          <Text style={styles.activeFiltersLabel}>
            {t('today_plans_filters_active_badge')}:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeFiltersChips}
          >
            {filterCity !== 'all' && (
              <View style={styles.activeFilterPill}>
                <Text style={styles.activeFilterPillText}>
                  📍 {formatCityName(filterCity, i18n.language)}
                </Text>
              </View>
            )}
            {filterActivity !== 'all' && (
              <View style={styles.activeFilterPill}>
                <Text style={styles.activeFilterPillText}>
                  🎯 {t(`today_plans_activity_${filterActivity}`)}
                </Text>
              </View>
            )}
            {filterDay !== 'all' && (
              <View style={styles.activeFilterPill}>
                <Text style={styles.activeFilterPillText}>
                  📅 {t(`today_plans_day_${filterDay}`)}
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={handleResetFilters}
              style={styles.clearFilterPill}
              activeOpacity={0.7}
              accessibilityLabel={t('today_plans_filters_clear_btn')}
            >
              <Text style={styles.clearFilterPillText}>✕</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* 4. MAIN FEED LIST */}
      {isCurrentFeedLoading && feedItems.length === 0 ? (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <TouchableOpacity
              style={styles.compactCreateBtn}
              onPress={handleOpenCreate}
              activeOpacity={0.8}
              testID="create-plan-hero-btn"
            >
              <Text style={styles.compactCreateBtnText}>
                {t('today_plans_add_button', 'დაამატე შენი დღის გეგმა')}
              </Text>
            </TouchableOpacity>
          </View>
          <TodayPlansSkeleton count={3} />
        </View>
      ) : (
        <FlatList
          data={feedItems}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isCurrentFeedRefetching}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          onEndReached={() => {
            if (activeTab === 'all' && publicFeed.hasNextPage && !publicFeed.isFetchingNextPage) {
              void publicFeed.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            // Compact "Create Plan" button
            <TouchableOpacity
              style={styles.compactCreateBtn}
              onPress={handleOpenCreate}
              activeOpacity={0.8}
              testID="create-plan-hero-btn"
            >
              <Text style={styles.compactCreateBtnText}>
                {t('today_plans_add_button', 'დაამატე შენი დღის გეგმა')}
              </Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>
                {activeTab === 'all'
                  ? '✨'
                  : activeTab === 'my_plans'
                  ? '📝'
                  : '💌'}
              </Text>
              <Text style={styles.emptyText}>
                {activeTab === 'all'
                  ? t('today_plans_empty_all')
                  : activeTab === 'my_plans'
                  ? t('today_plans_empty_my_plans')
                  : t('today_plans_empty_my_responses')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TodayPlanCard
              plan={item}
              onPress={plan => setDetailPlan(plan)}
              onApply={handleApplyPress}
              onViewApplicants={plan => setApplicantsPlan(plan)}
              onCancelPlan={handleCancelPress}
              onWithdrawResponse={handleWithdrawPress}
              onOpenChat={handleOpenChat}
              isCancelling={cancellingPlanId === item.id}
              isWithdrawing={withdrawingPlanId === item.id}
            />
          )}
          ListFooterComponent={
            publicFeed.isFetchingNextPage ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : null
          }
        />
      )}

      {/* 5. MODALS */}
      <CreatePlanModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSubmit={async request => {
          await createPlanMutation.mutateAsync(request);
        }}
        onOpenPremium={() => setPremiumModalVisible(true)}
        defaultCity={filterCity !== 'all' ? filterCity : 'tbilisi'}
        isSubmitting={createPlanMutation.isPending}
      />

      <ApplyModal
        visible={!!applyPlan}
        plan={applyPlan}
        onClose={() => setApplyPlan(null)}
        onSubmit={async (planId, request) => {
          await applyMutation.mutateAsync({ planId, request });
        }}
        onOpenPremium={() => setPremiumModalVisible(true)}
        isSubmitting={applyMutation.isPending}
      />

      <ApplicantsModal
        visible={!!applicantsPlan}
        plan={applicantsPlan}
        applicants={applicantsQuery.data ?? []}
        isLoading={applicantsQuery.isLoading}
        onClose={() => setApplicantsPlan(null)}
        onAccept={async applicant => {
          if (!applicantsPlan) return;
          try {
            await acceptApplicantMutation.mutateAsync({
              planId: applicantsPlan.id,
              responseId: applicant.id,
            });
          } catch {
            // Handled in acceptApplicantMutation.onError
          }
        }}
        onReject={async applicant => {
          if (!applicantsPlan) return;
          try {
            await rejectApplicantMutation.mutateAsync({
              planId: applicantsPlan.id,
              responseId: applicant.id,
            });
          } catch {
            // Handled in rejectApplicantMutation.onError
          }
        }}
        onOpenProfile={applicant => setProfileApplicant(applicant)}
        onOpenChat={handleOpenChat}
        acceptingId={acceptingApplicantId}
        rejectingId={rejectingApplicantId}
      />

      <ApplicantProfileModal
        visible={!!profileApplicant}
        applicant={profileApplicant}
        onClose={() => setProfileApplicant(null)}
      />

      <TodayPlanDetailModal
        visible={!!detailPlan}
        plan={detailPlan}
        onClose={() => setDetailPlan(null)}
        onApply={handleApplyPress}
        onViewApplicants={plan => setApplicantsPlan(plan)}
        onCancelPlan={handleCancelPress}
        onWithdrawResponse={handleWithdrawPress}
        onOpenChat={handleOpenChat}
        isCancelling={cancellingPlanId === detailPlan?.id}
        isWithdrawing={withdrawingPlanId === detailPlan?.id}
        api={api}
      />

      <TodayPlansFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        city={filterCity}
        activity={filterActivity}
        day={filterDay}
        onApply={({ city, activity, day }) => {
          setFilterCity(city);
          setFilterActivity(activity);
          setFilterDay(day);
        }}
        onReset={handleResetFilters}
      />

      <PremiumModal
        visible={premiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
        onSuccess={() => {
          void limitsQuery.refetch();
          setPremiumModalVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  limitsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  limitsTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  limitsInfoText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  premiumBadgeBtn: {
    backgroundColor: 'rgba(251, 113, 133, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.match,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiumBadgeText: {
    fontSize: 11,
    color: theme.colors.match,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    backgroundColor: theme.colors.background,
  },
  tabsList: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonResponses: {
    flex: 1.15,
  },
  tabButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  tabButtonText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabButtonTextSelected: {
    color: theme.colors.onPrimary,
    fontWeight: '700',
  },
  tabContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabIcon: {
    fontSize: 12,
  },
  tabCountPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCountPillSelected: {
    backgroundColor: theme.colors.onPrimary,
  },
  tabCountText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: theme.colors.text,
  },
  tabCountTextSelected: {
    color: theme.colors.primary,
  },
  filterIconBtn: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.control,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterIconBtnActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderColor: '#a855f7',
  },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: theme.colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.onPrimary,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.sm,
    gap: 8,
  },
  activeFiltersLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  activeFiltersChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeFilterPill: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeFilterPillText: {
    fontSize: 11,
    color: theme.colors.text,
    fontWeight: '600',
  },
  clearFilterPill: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearFilterPillText: {
    fontSize: 10,
    color: theme.colors.muted,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.sm,
    paddingBottom: 40,
  },
  compactCreateBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.space.md,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  compactCreateBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyEmoji: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
