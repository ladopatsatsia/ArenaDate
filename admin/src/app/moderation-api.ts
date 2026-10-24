import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { components } from '@dating/api-contract';
export type Identity = components['schemas']['AdminIdentity'];
export type Photo = components['schemas']['PhotoReview'];
export type Report = components['schemas']['ReportSummary'];
export type UserReview = components['schemas']['UserReview'];
export type Audit = components['schemas']['AuditDto'];
export type GameQuestion = components['schemas']['GameQuestionDto'];
export type CreateQuestionInput = components['schemas']['CreateQuestionRequest'];
export type UpdateQuestionInput = components['schemas']['UpdateQuestionRequest'];
export interface AdminProfileSummary {
  userId: string;
  email: string;
  displayName: string;
  gender: string;
  city: string;
  age: number;
  active: boolean;
  emailConfirmed: boolean;
  visible: boolean;
  photoCount: number;
  primaryPhotoId: string | null;
  crystals: number;
}
export interface AdminPhoto {
  id: string;
  state: string;
  position: number;
  createdAt: string;
}
export interface AdminProfileDetail {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  active: boolean;
  displayName: string;
  bio: string;
  gender: string;
  desiredGenders: string[];
  city: string;
  cityKey: string;
  dateOfBirth: string;
  age: number;
  interests: string[];
  relationshipGoal: string;
  languages: string[];
  visible: boolean;
  minAge: number;
  maxAge: number;
  radiusKm: number;
  locationMode: string;
  revision: number;
  photos: AdminPhoto[];
  crystals: number;
}
export interface AdminCreateUserInput {
  email: string;
  password: string;
  displayName: string;
  dateOfBirth: string;
  gender: string;
  city?: string;
  initialCrystals?: number;
}
export interface AdminAdjustCrystalsInput {
  amount: number;
  mode?: 'delta' | 'set';
  reason?: string;
}
export interface AdminCrystalAdjustmentResult {
  userId: string;
  oldBalance: number;
  newBalance: number;
  delta: number;
}
export interface TelegramStats {
  totalSubscribers: number;
  activeSubscribers: number;
  linkedUsersCount: number;
  latestActivityUtc: string | null;
}
export interface TelegramBroadcastRequest {
  message: string;
  buttonText?: string;
  webAppRelativePath?: string;
}
export interface TelegramBroadcastResult {
  totalSubscribers: number;
  targeted: number;
  successCount: number;
  failedCount: number;
  blockedCount: number;
  completedAtUtc: string;
}
export interface TelegramNotificationConfigDto {
  masterEnabled: boolean;
  chatMessageEnabled: boolean;
  chatMessageTemplate: string;
  chatMessageButtonText: string;
  matchRequestEnabled: boolean;
  matchRequestTemplate: string;
  matchRequestButtonText: string;
  matchEnabled: boolean;
  matchTemplate: string;
  matchButtonText: string;
  superLikeEnabled: boolean;
  superLikeTemplate: string;
  superLikeButtonText: string;
  welcomeTemplate: string;
  welcomeButtonText: string;
  updatedAtUtc: string;
}
export interface UpdateTelegramNotificationConfigRequest {
  masterEnabled: boolean;
  chatMessageEnabled: boolean;
  chatMessageTemplate: string;
  chatMessageButtonText: string;
  matchRequestEnabled: boolean;
  matchRequestTemplate: string;
  matchRequestButtonText: string;
  matchEnabled: boolean;
  matchTemplate: string;
  matchButtonText: string;
  superLikeEnabled: boolean;
  superLikeTemplate: string;
  superLikeButtonText: string;
  welcomeTemplate: string;
  welcomeButtonText: string;
}
export interface AdminTelegramTestNotificationRequest {
  notificationType: string;
  targetChatId?: number | null;
}
export interface AdminTransactionDto {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  primaryPhotoId: string | null;
  category: 'subscription' | 'crystal_purchase' | 'crystal_spend' | string;
  itemTitle: string;
  itemDescription: string;
  priceAmount: number | null;
  currency: string | null;
  crystals: number | null;
  platform: string;
  status: 'active' | 'completed' | 'expired' | 'refunded' | 'inactive' | string;
  transactionId: string | null;
  createdAtUtc: string;
  expiresAtUtc: string | null;
}
export interface AdminTransactionsStats {
  totalRevenueGel: number;
  totalRevenueStars: number;
  totalSubscriptionsCount: number;
  totalActiveSubscriptionsCount: number;
  totalCrystalsSold: number;
  totalPayingUsersCount: number;
}
export interface AdminTransactionsResponse {
  items: AdminTransactionDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  stats: AdminTransactionsStats;
}
@Injectable({ providedIn: 'root' })
export class ModerationApi {
 private readonly http = inject(HttpClient);
 readonly identity = signal<Identity | null>(null);
 private readonly base = '/api/moderation';
 csrf() { return firstValueFrom(this.http.get<void>(this.base + '/csrf')); }
 async restore() { await this.csrf(); const me = await this.get<Identity>('/me'); this.identity.set(me); return me; }
 async login(value: { email: string; password: string; code?: string }) {
  await this.csrf(); await this.post('/login', value); await this.restore();
 }
 async logout() { await this.post('/logout', {}); this.identity.set(null); await this.csrf(); }
 listProfiles(search?: string, page = 1, pageSize = 50): Promise<AdminProfileSummary[]> {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  query.set('page', page.toString());
  query.set('pageSize', pageSize.toString());
  return this.get<AdminProfileSummary[]>('/profiles?' + query.toString());
 }
 getProfile(userId: string): Promise<AdminProfileDetail> {
  return this.get<AdminProfileDetail>('/profiles/' + userId);
 }
 createUser(input: AdminCreateUserInput): Promise<AdminProfileSummary> {
  return this.postReturn<AdminProfileSummary>('/users', input);
 }
 adjustCrystals(userId: string, input: AdminAdjustCrystalsInput): Promise<AdminCrystalAdjustmentResult> {
  return this.postReturn<AdminCrystalAdjustmentResult>('/users/' + userId + '/crystals', input);
 }
 deleteUser(userId: string, reason?: string): Promise<void> {
  const query = reason ? '?reason=' + encodeURIComponent(reason) : '';
  return this.delete('/users/' + userId + query);
 }
 getTelegramStats(): Promise<TelegramStats> {
  return this.get<TelegramStats>('/telegram-stats');
 }
 broadcastTelegram(input: TelegramBroadcastRequest): Promise<TelegramBroadcastResult> {
  return this.postReturn<TelegramBroadcastResult>('/broadcast-telegram', input);
 }
 getTelegramConfig(): Promise<TelegramNotificationConfigDto> {
  return this.get<TelegramNotificationConfigDto>('/telegram-config');
 }
 updateTelegramConfig(input: UpdateTelegramNotificationConfigRequest): Promise<TelegramNotificationConfigDto> {
  return this.putReturn<TelegramNotificationConfigDto>('/telegram-config', input);
 }
 resetTelegramConfig(): Promise<TelegramNotificationConfigDto> {
  return this.postReturn<TelegramNotificationConfigDto>('/telegram-config/reset', {});
 }
 testTelegramConfig(input: AdminTelegramTestNotificationRequest): Promise<{ success: boolean; type: string }> {
  return this.postReturn<{ success: boolean; type: string }>('/telegram-config/test', input);
 }
 listTransactions(category = 'all', search?: string, page = 1, pageSize = 50): Promise<AdminTransactionsResponse> {
  const query = new URLSearchParams();
  if (category) query.set('category', category);
  if (search) query.set('search', search);
  query.set('page', page.toString());
  query.set('pageSize', pageSize.toString());
  return this.get<AdminTransactionsResponse>('/transactions?' + query.toString());
 }

 async get<T>(path: string): Promise<T> { try { return await firstValueFrom(this.http.get<T>(this.base + path)); } catch (e) { this.expired(e); throw e; } }
 async post(path: string, body: unknown): Promise<void> { try { await firstValueFrom(this.http.post<void>(this.base + path, body)); } catch (e) { this.expired(e); throw e; } }
 async postReturn<T>(path: string, body: unknown): Promise<T> { try { return await firstValueFrom(this.http.post<T>(this.base + path, body)); } catch (e) { this.expired(e); throw e; } }
 async put(path: string, body: unknown): Promise<void> { try { await firstValueFrom(this.http.put<void>(this.base + path, body)); } catch (e) { this.expired(e); throw e; } }
 async putReturn<T>(path: string, body: unknown): Promise<T> { try { return await firstValueFrom(this.http.put<T>(this.base + path, body)); } catch (e) { this.expired(e); throw e; } }
 async delete(path: string): Promise<void> { try { await firstValueFrom(this.http.delete<void>(this.base + path)); } catch (e) { this.expired(e); throw e; } }
 private expired(e: unknown) { if (e instanceof HttpErrorResponse && e.status === 401) this.identity.set(null); }
}
export function adminError(e: unknown): string {
 if (e instanceof HttpErrorResponse) {
  if (e.status === 401) return 'Sign in again. Check your password and a fresh authenticator code.';
  if (e.status === 400) return 'The request was rejected. Check the fields or reload to renew security protection.';
  if (e.status === 403) return 'This action is not permitted.';
  if (e.status === 404) return 'This item is no longer available.';
  if (e.status === 409) return 'This item changed. Refresh the queue before retrying.';
  if (e.status === 429) return 'Too many requests. Wait before retrying.';
 }
 return 'The server could not be reached. Refresh to check the result before retrying.';
}
