import type { components } from '@dating/api-contract';
import { AuthApi, ApiError } from '../auth/api';
import { SessionManager } from '../auth/session';
import { uploadChatMedia, type ChatMediaFile, type ChatMediaUploadResult } from './ChatMediaApi';

export type Message = components['schemas']['MessageDto'];
export type History = components['schemas']['HistoryPage'];
export type SendInput = components['schemas']['SendMessage'];

export class ChatApi {
  private readonly accountId: string | undefined;

  constructor(private readonly api: AuthApi, private readonly session: SessionManager) {
    this.accountId = session.snapshot().account?.id;
  }

  private run<T>(action: (token: string) => Promise<T>) {
    if (!this.accountId || this.session.snapshot().account?.id !== this.accountId) {
      return Promise.reject(new ApiError(401));
    }
    return this.session.withAccess(action);
  }

  token = () => this.run(async (token) => token);
  history = (id: string, before?: string, after?: string) =>
    this.run((t) =>
      this.api.request<History>(
        `/api/conversations/${id}/messages${before ? '?before=' + before : after ? '?after=' + after : ''}`,
        undefined,
        t
      )
    );
  send = (id: string, input: SendInput) =>
    this.run((t) => this.api.request<Message>(`/api/conversations/${id}/messages`, input, t));
  read = (id: string, messageId: string) =>
    this.run((t) => this.api.request(`/api/conversations/${id}/read`, { messageId }, t));

  uploadMedia = (file: ChatMediaFile, mediaType: 'photo' | 'voice', duration?: number): Promise<ChatMediaUploadResult> =>
    this.run((t) => uploadChatMedia(this.api.baseUrl, t, file, mediaType, duration));
}
