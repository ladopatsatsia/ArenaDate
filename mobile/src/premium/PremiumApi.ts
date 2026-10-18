import type { components } from '@dating/api-contract';
import { AuthApi, ApiError } from '../auth/api';
import { SessionManager } from '../auth/session';

export type PremiumPackage = components['schemas']['PremiumPackageDto'];
export type PremiumStatus = components['schemas']['PremiumStatusDto'];
export type SubscribePackageRequest = components['schemas']['SubscribePackageRequest'];
export type SubscribeResult = components['schemas']['SubscribeResultDto'];
export type TelegramStarsInvoiceRequest = components['schemas']['TelegramStarsInvoiceRequest'];
export type TelegramStarsInvoiceResponse = components['schemas']['TelegramStarsInvoiceResponse'];
export type TelegramStarsVerifyRequest = components['schemas']['TelegramStarsVerifyRequest'];
export type TelegramStarsVerifyResponse = components['schemas']['TelegramStarsVerifyResponse'];

export class PremiumApi {
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

  status = () => this.run(t => this.api.request<PremiumStatus>('/api/premium/status', undefined, t));

  packages = () => this.run(t => this.api.request<PremiumPackage[]>('/api/premium/packages', undefined, t));

  subscribe = (input: SubscribePackageRequest) =>
    this.run(t => this.api.request<SubscribeResult>('/api/premium/subscribe', input, t));

  createTelegramStarsInvoice = (input: TelegramStarsInvoiceRequest) =>
    this.run(t => this.api.request<TelegramStarsInvoiceResponse>('/api/payments/telegram-stars/invoice', input, t));

  verifyTelegramStarsPayment = (input: TelegramStarsVerifyRequest) =>
    this.run(t => this.api.request<TelegramStarsVerifyResponse>('/api/payments/telegram-stars/verify', input, t));
}

