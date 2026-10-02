import type { components } from '@dating/api-contract';
import { AuthApi, ApiError } from '../auth/api';
import { SessionManager } from '../auth/session';
export type SwipeInput = components['schemas']['SwipeRequest'];
export type SwipeResult = components['schemas']['SwipeResult'];
export type MatchNotice = components['schemas']['MatchNotification'];
export class MatchApi {
 private readonly accountId: string | undefined;
 constructor(private readonly api: AuthApi, private readonly session: SessionManager) { this.accountId = session.snapshot().account?.id; }
 private run<T>(action: (token: string) => Promise<T>): Promise<T> {
  if (!this.accountId || this.accountId !== this.session.snapshot().account?.id) return Promise.reject(new ApiError(401));
  return this.session.withAccess(action);
 }
 decide = (input: SwipeInput) => this.run(t => this.api.request<SwipeResult>('/api/swipes', input, t));
 receipt = (request: string) => this.run(t => this.api.request<SwipeResult>(`/api/swipes/${request}`, undefined, t));
 list = (cursor: string | null) => this.run(t => this.api.request<components['schemas']['MatchPage']>(cursor ? `/api/matches?cursor=${encodeURIComponent(cursor)}` : '/api/matches', undefined, t));
 notices = () => this.run(t => this.api.request<MatchNotice[]>('/api/matches/notices', undefined, t));
 acknowledge = (match: string) => this.run(t => this.api.request<void>(`/api/matches/${match}/acknowledge`, {}, t));
}
