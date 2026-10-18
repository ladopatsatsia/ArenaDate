import { ApiError, AuthApi } from '../auth/api';
import { SessionManager } from '../auth/session';
import type { Photo } from '../profile/api';

export type TodayPlanActivityType = 'coffee' | 'walk' | 'cinema' | 'food' | 'other';
export type TodayPlanStateType = 'Open' | 'Matched' | 'Cancelled' | 'Expired';
export type TodayPlanResponseStateType = 'Pending' | 'Accepted' | 'Rejected' | 'Withdrawn' | 'Closed';

export interface TodayPlanSummary {
  id: string;
  authorUserId: string;
  authorDisplayName: string;
  authorAge: number;
  authorCity: string;
  authorPhoto?: Photo | null;
  city: string;
  district?: string | null;
  activity: string;
  title: string;
  description: string;
  startsAtUtc: string;
  expiresAtUtc: string;
  budgetAmount?: number | null;
  currency: string;
  state: string;
  responsesCount: number;
  isAuthor: boolean;
  hasApplied: boolean;
  myResponseState?: string | null;
  myResponseId?: string | null;
  createdAtUtc: string;
  targetParticipantsCount?: number;
}

export interface TodayPlanDetail extends TodayPlanSummary {
  authorPhotos?: Photo[] | null;
  authorBio: string;
  selectedCompanionUserId?: string | null;
  matchedAtUtc?: string | null;
  conversationId?: string | null;
}

export interface TodayPlanFeedPage {
  items: TodayPlanSummary[];
  nextCursor?: string | null;
  totalCount: number;
}

export interface TodayPlanApplicant {
  id: string;
  applicantUserId: string;
  displayName: string;
  age: number;
  city: string;
  photo?: Photo | null;
  photos?: Photo[] | null;
  bio: string;
  message?: string | null;
  state: string;
  createdAtUtc: string;
}

export interface TodayPlanMyResponse {
  responseId: string;
  planId: string;
  planTitle: string;
  planActivity: string;
  planCity: string;
  planDistrict?: string | null;
  planStartsAtUtc: string;
  planExpiresAtUtc: string;
  planState: string;
  authorUserId: string;
  authorDisplayName: string;
  authorPhoto?: Photo | null;
  message?: string | null;
  state: string;
  createdAtUtc: string;
  conversationId?: string | null;
}

export interface AcceptPlanResponseResult {
  planId: string;
  responseId: string;
  companionUserId: string;
  state: string;
  conversationId?: string | null;
  matchedAtUtc: string;
}

export interface TodayPlanLimits {
  hasPremium: boolean;
  activePlansCount: number;
  activePlansLimit: number;
  canCreatePlan: boolean;
  dailyResponsesUsed: number;
  dailyResponsesLimit: number;
  dailyResponsesRemaining: number;
  canApply: boolean;
  resetsAtUtc: string;
  timeZone: string;
}

export interface CreateTodayPlanRequest {
  city: string;
  district?: string | null;
  activity: string;
  title: string;
  description?: string | null;
  startsAtUtc: string;
  expiresAtUtc: string;
  budgetAmount?: number | null;
  targetParticipantsCount?: number;
}

export interface CreateTodayPlanResponseRequest {
  message?: string | null;
}

export class TodayPlansApi {
  private readonly accountId: string | undefined;

  constructor(private readonly api: AuthApi, private readonly session: SessionManager) {
    this.accountId = session.snapshot().account?.id;
  }

  private run<T>(action: (token: string) => Promise<T>): Promise<T> {
    if (!this.accountId || this.accountId !== this.session.snapshot().account?.id) {
      return Promise.reject(new ApiError(401));
    }
    return this.session.withAccess(action);
  }

  getPublicPlans = (params?: {
    city?: string;
    activity?: string;
    day?: string;
    cursor?: string | null;
    limit?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.city) query.set('city', params.city);
    if (params?.activity) query.set('activity', params.activity);
    if (params?.day) query.set('day', params.day);
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    const path = (`/api/today-plans${qs ? '?' + qs : ''}`) as `/api/${string}`;
    return this.run(t => this.api.request<TodayPlanFeedPage>(path, undefined, t));
  };

  getMyPlans = () =>
    this.run(t => this.api.request<TodayPlanSummary[]>('/api/today-plans/my', undefined, t));

  getMyResponses = () =>
    this.run(t => this.api.request<TodayPlanMyResponse[]>('/api/today-plans/my-responses', undefined, t));

  getLimits = () =>
    this.run(t => this.api.request<TodayPlanLimits>('/api/today-plans/limits', undefined, t));

  getPlanById = (id: string) =>
    this.run(t => this.api.request<TodayPlanDetail>(`/api/today-plans/${id}`, undefined, t));

  createPlan = (input: CreateTodayPlanRequest) =>
    this.run(t => this.api.request<TodayPlanDetail>('/api/today-plans', input, t));

  cancelPlan = (id: string) =>
    this.run(t => this.api.request<TodayPlanDetail>(`/api/today-plans/${id}/cancel`, {}, t));

  getApplicants = (planId: string) =>
    this.run(t => this.api.request<TodayPlanApplicant[]>(`/api/today-plans/${planId}/applicants`, undefined, t));

  createResponse = (planId: string, input: CreateTodayPlanResponseRequest) =>
    this.run(t => this.api.request<TodayPlanMyResponse>(`/api/today-plans/${planId}/responses`, input, t));

  withdrawResponse = (planId: string, responseId: string) =>
    this.run(t => this.api.request<void>(`/api/today-plans/${planId}/responses/${responseId}/withdraw`, {}, t));

  acceptResponse = (planId: string, responseId: string) =>
    this.run(t => this.api.request<AcceptPlanResponseResult>(`/api/today-plans/${planId}/responses/${responseId}/accept`, {}, t));

  rejectResponse = (planId: string, responseId: string) =>
    this.run(t => this.api.request<void>(`/api/today-plans/${planId}/responses/${responseId}/reject`, {}, t));
}
