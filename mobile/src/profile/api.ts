import type { components } from '@dating/api-contract';
import { ApiError, AuthApi } from '../auth/api';
import { SessionManager } from '../auth/session';
export type OwnProfile = components['schemas']['OwnProfileDto'];
export type Photo = components['schemas']['PhotoDto'];
export type Choices = components['schemas']['ProfileChoices'];
export type ProfileInput = components['schemas']['ProfileUpdate'];
export class ProfileApi {
  private readonly accountId: string | undefined;
  constructor(private readonly api: AuthApi, private readonly session: SessionManager) { this.accountId = session.snapshot().account?.id; }
  private authorized<T>(action: (token: string) => Promise<T>): Promise<T> {
    if (!this.accountId || this.session.snapshot().account?.id !== this.accountId) return Promise.reject(new ApiError(401));
    return this.session.withAccess(action);
  }
  get = () => this.authorized(t => this.api.request<OwnProfile>('/api/profile', undefined, t));
  choices = () => this.authorized(t => this.api.request<Choices>('/api/profile/choices', undefined, t));
  save = (input: ProfileInput) => this.authorized(t => this.api.request<OwnProfile>('/api/profile', input, t));
  begin = (requestId: string) => this.authorized(t => this.api.request<Photo>('/api/profile/photos/uploads', { requestId }, t));
  reorder = (revision: OwnProfile['revision'], photoIds: string[]) => this.authorized(t => this.api.request<OwnProfile>('/api/profile/photos/reorder', { revision, photoIds }, t));
  pauseDiscoverability = (paused: boolean) => this.authorized(t => this.api.request<void>('/api/account/discoverability-pause', { paused }, t));
  deleteAccount = (password: string) => this.authorized(t => this.api.request<void>('/api/account/delete', { password }, t));
  private async fetch(path: string, token: string, init?: RequestInit) {
    const abort = new AbortController(); const timeout = setTimeout(() => abort.abort(), 45000);
    try {
      const response = await fetch(this.api.baseUrl.replace(/\/$/, '') + path, { ...init, signal: abort.signal,
        headers: { ...init?.headers, Authorization: 'Bearer ' + token } });
      if (!response.ok) throw new ApiError(response.status);
      return response;
    } finally { clearTimeout(timeout); }
  }
  finalize = (id: string, bytes: Blob) => this.authorized(async t => {
    const response = await this.fetch('/api/profile/photos/' + id + '/finalize', t,
      { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes });
    return await response.json() as Photo;
  });
  remove = (id: string) => this.authorized(async t => { await this.fetch('/api/profile/photos/' + id, t, { method: 'DELETE' }); });
  image = (id: string) => this.authorized(async t => {
    const grant = await this.api.request<components['schemas']['MediaGrant']>(`/api/profile/photos/${id}/access`, {}, t);
    const response = await this.fetch('/api/profile/photos/' + id + '/content?thumbnail=true&ticket=' + encodeURIComponent(grant.ticket), t);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onerror = () => reject(new Error('photo_read_failed'));
      reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(blob);
    });
  });
}
// Keep the same request ID across interrupted Begin/finalize responses. No fake completion.
export async function uploadPhoto(api: Pick<ProfileApi, 'begin' | 'finalize'>, requestId: string, bytes: Blob): Promise<Photo> {
  const slot = await api.begin(requestId);
  return slot.state === 'uploading' ? api.finalize(slot.id, bytes) : slot;
}
