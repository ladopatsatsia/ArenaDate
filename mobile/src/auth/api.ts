import { z } from 'zod';
import type { components } from '@dating/api-contract';

export type Tokens = components['schemas']['TokenResponse'];
export type Account = components['schemas']['AccountResponse'];
export type Login = components['schemas']['LoginRequest'];
export type Register = components['schemas']['RegisterRequest'];
export type Refresh = components['schemas']['RefreshRequest'];
export type Verify = components['schemas']['VerifyRequest'];
export type Reset = components['schemas']['ResetRequest'];
export type OtpSendRequest = components['schemas']['OtpSendRequest'];
export type OtpSendResponse = components['schemas']['OtpSendResponse'];
export type OtpVerifyRequest = components['schemas']['OtpVerifyRequest'];
export type OtpVerifyResponse = components['schemas']['OtpVerifyResponse'];
export class ApiError extends Error {

  constructor(public readonly status: number, public readonly code = 'request_failed') { super(code); }
}
const tokenSchema = z.object({
  accessToken: z.string().min(1), accessExpiresAt: z.iso.datetime({ offset: true }),
  refreshToken: z.string().min(1), sessionExpiresAt: z.iso.datetime({ offset: true }),
  account: z.object({ id: z.uuid() }),
});
export interface SessionApi {
  login(request: Login): Promise<Tokens>;
  refresh(request: Refresh): Promise<Tokens>;
  logout(refreshToken: string): Promise<void>;
  logoutAll(accessToken: string): Promise<void>;
}
export class AuthApi implements SessionApi {
  constructor(readonly baseUrl: string) {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || (!__DEV__ && url.protocol !== 'https:')) throw new Error('Invalid API URL');
  }
  async request<T>(path: `/api/${string}`, body?: unknown, accessToken?: string, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort);
    if (signal?.aborted) abort();
    const timeout = setTimeout(abort, 15000);
    const fullUrl = this.baseUrl.replace(/\/$/, '') + path;
    console.log('[AuthApi.request] Calling:', fullUrl);
    try {
      const response = await fetch(fullUrl, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
      });
      console.log('[AuthApi.request] Status:', response.status);
      if (!response.ok) {
        let code = 'request_failed';
        try {
          const problem: unknown = await response.json();
          if (typeof problem === 'object' && problem && 'code' in problem && typeof problem.code === 'string') code = problem.code;
        } catch { /* A non-JSON error remains an explicit HTTP failure. */ }
        throw new ApiError(response.status, code);
      }
      return response.status === 204 ? undefined as T : await response.json() as T;
    } catch (fetchErr) {
      console.error('[AuthApi.request] Fetch threw:', fetchErr);
      throw fetchErr;
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
  }
  async login(request: Login): Promise<Tokens> { return tokenSchema.parse(await this.request('/api/auth/login', request)); }
  async refresh(request: Refresh): Promise<Tokens> { return tokenSchema.parse(await this.request('/api/auth/refresh', request)); }
  async logout(refreshToken: string): Promise<void> { await this.request('/api/auth/logout', { refreshToken }); }
  async logoutAll(accessToken: string): Promise<void> { await this.request('/api/auth/logout-all', {}, accessToken); }
  async register(request: Register) { await this.request('/api/auth/register', request); }
  async verify(request: Verify) { await this.request('/api/auth/verify', request); }
  async resend(email: string) { await this.request('/api/auth/verification-email', { email }); }
  async forgot(email: string) { await this.request('/api/auth/forgot-password', { email }); }
  async reset(request: Reset) { await this.request('/api/auth/reset-password', request); }
  async sendOtp(request: OtpSendRequest): Promise<OtpSendResponse> {
    return await this.request('/api/auth/otp/send', request);
  }
  async verifyOtp(request: OtpVerifyRequest): Promise<OtpVerifyResponse> {
    const res = await this.request<OtpVerifyResponse>('/api/auth/otp/verify', request);
    tokenSchema.parse(res.tokens);
    return res;
  }
  async loginTelegram(request: { initData: string }): Promise<OtpVerifyResponse> {
    const res = await this.request<OtpVerifyResponse>('/api/auth/telegram', request);
    tokenSchema.parse(res.tokens);
    return res;
  }
}
