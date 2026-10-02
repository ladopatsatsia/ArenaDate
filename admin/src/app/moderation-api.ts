import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { components } from '@dating/api-contract';
export type Identity = components['schemas']['AdminIdentity'];
export type Photo = components['schemas']['PhotoReview'];
export type Report = components['schemas']['ReportSummary'];
export type UserReview = components['schemas']['UserReview'];
export type Audit = components['schemas']['AuditDto'];
@Injectable({ providedIn: 'root' })
export class ModerationApi {
 private readonly http = inject(HttpClient);
 readonly identity = signal<Identity | null>(null);
 private readonly base = '/api/moderation';
 csrf() { return firstValueFrom(this.http.get<void>(this.base + '/csrf')); }
 async restore() { await this.csrf(); const me = await this.get<Identity>('/me'); this.identity.set(me); return me; }
 async login(value: { email: string; password: string; code: string }) {
  await this.csrf(); await this.post('/login', value); await this.restore();
 }
 async logout() { await this.post('/logout', {}); this.identity.set(null); await this.csrf(); }
 async get<T>(path: string): Promise<T> { try { return await firstValueFrom(this.http.get<T>(this.base + path)); } catch (e) { this.expired(e); throw e; } }
 async post(path: string, body: unknown): Promise<void> { try { await firstValueFrom(this.http.post<void>(this.base + path, body)); } catch (e) { this.expired(e); throw e; } }
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
