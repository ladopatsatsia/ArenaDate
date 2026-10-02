import type { components } from '@dating/api-contract';
import { AuthApi, ApiError } from '../auth/api';
import { SessionManager } from '../auth/session';
export type Settings = components['schemas']['DiscoverySettings'];
export type SettingsInput = components['schemas']['SettingsRequest'];
export type Card = components['schemas']['DiscoveryCard'];
export type Page = components['schemas']['DiscoveryPage'];
export class DiscoveryApi {
  private readonly accountId: string | undefined;
  constructor(private readonly api: AuthApi, private readonly session: SessionManager) { this.accountId = session.snapshot().account?.id; }
  private run<T>(action: (token: string) => Promise<T>): Promise<T> {
    if (!this.accountId || this.accountId !== this.session.snapshot().account?.id) return Promise.reject(new ApiError(401));
    return this.session.withAccess(action);
  }
  settings = () => this.run(t => this.api.request<Settings>('/api/discovery/settings', undefined, t));
  save = (input: SettingsInput) => this.run(t => this.api.request<Settings>('/api/discovery/settings', input, t));
  location = (latitude: number, longitude: number) => this.run(t => this.api.request<Settings>('/api/discovery/location', { latitude, longitude, consent: true }, t));
  clearLocation = () => this.run(async t => {
    const abort = new AbortController(); const timer = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await fetch(this.api.baseUrl.replace(/\/$/, '') + '/api/discovery/location', {
        method: 'DELETE', headers: { Authorization: 'Bearer ' + t }, signal: abort.signal });
      if (!response.ok) throw new ApiError(response.status);
      return await response.json() as Settings;
    } finally { clearTimeout(timer); }
  });
  page = (cursor: string | null) => this.run(t => this.api.request<Page>(cursor ? `/api/discovery?cursor=${encodeURIComponent(cursor)}` : '/api/discovery', undefined, t));
  current = (id: string) => this.run(t => this.api.request<Card>(`/api/discovery/${id}`, undefined, t));
}
