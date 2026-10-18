import type { components } from '@dating/api-contract';
import { AuthApi, ApiError } from '../auth/api';
import { SessionManager } from '../auth/session';
export type SwipeInput = components['schemas']['SwipeRequest'];
export type SwipeResult = components['schemas']['SwipeResult'];
export type SuperLikeInput = components['schemas']['SuperLikeRequest'];
export type SuperLikeResult = components['schemas']['SuperLikeResult'];
export type MatchNotice = components['schemas']['MatchNotification'];
export type LikeRequest = components['schemas']['LikeRequestSummary'] & {
  origin?: string;
  note?: string | null;
};
export type MatchSummary = components['schemas']['MatchSummary'];
export type ProfileViewSummary = components['schemas']['ProfileViewSummary'];
export class MatchApi {
 private readonly accountId: string | undefined;
 constructor(private readonly api: AuthApi, private readonly session: SessionManager) { this.accountId = session.snapshot().account?.id; }
 private run<T>(action: (token: string) => Promise<T>): Promise<T> {
  if (!this.accountId || this.accountId !== this.session.snapshot().account?.id) return Promise.reject(new ApiError(401));
  return this.session.withAccess(action);
 }
 decide = (input: SwipeInput) => this.run(t => this.api.request<SwipeResult>('/api/swipes', input, t));
 superLike = (input: SuperLikeInput) => this.run(t => this.api.request<SuperLikeResult>('/api/swipes/superlike', input, t));
 receipt = (request: string) => this.run(t => this.api.request<SwipeResult>(`/api/swipes/${request}`, undefined, t));
 list = (cursor: string | null) => this.run(t => this.api.request<components['schemas']['MatchPage']>(cursor ? `/api/matches?cursor=${encodeURIComponent(cursor)}` : '/api/matches', undefined, t));
 requests = () => this.run(t => this.api.request<LikeRequest[]>('/api/matches/requests', undefined, t));
 notices = () => this.run(t => this.api.request<MatchNotice[]>('/api/matches/notices', undefined, t));
 acknowledge = (match: string) => this.run(t => this.api.request<void>(`/api/matches/${match}/acknowledge`, {}, t));
 unlock = (matchId: string, idempotencyKey: string) =>
  this.run(t => this.api.request<components['schemas']['UnlockMatchConversationResult']>(`/api/matches/${matchId}/unlock`, { idempotencyKey }, t));
 recordView = (targetId: string) => this.run(t => this.api.request<void>(`/api/matches/views/${targetId}`, {}, t));
 viewedYou = () => this.run(t => this.api.request<ProfileViewSummary[]>('/api/matches/views/viewed-you', undefined, t));
 youViewed = () => this.run(t => this.api.request<ProfileViewSummary[]>('/api/matches/views/you-viewed', undefined, t));
}
