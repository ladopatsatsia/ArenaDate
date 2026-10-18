import type { components } from '@dating/api-contract';
import { AuthApi, ApiError } from '../auth/api';
import { SessionManager } from '../auth/session';

export type GameRoomSummary = components['schemas']['GameRoomSummary'] & {
  hasPassword?: boolean;
};
export type GameRoomDetail = components['schemas']['GameRoomDetail'] & {
  hasPassword?: boolean;
};
export type GameMember = components['schemas']['GameMemberDto'];
export type CreateRoomInput = components['schemas']['CreateRoomRequest'] & {
  password?: string | null;
  capacity?: number;
};
export type JoinRoomInput = {
  password?: string;
};
export type JoinRoomResult = components['schemas']['JoinRoomResult'];
export type LeaveRoomResult = components['schemas']['LeaveRoomResult'];
export type DevFixtureSeedInput = components['schemas']['DevFixtureSeedRequest'];
export type JoinQueueInput = components['schemas']['JoinQueueRequest'];
export type GameRoomSnapshot = Omit<components['schemas']['GameRoomSnapshot'], 'pendingDirectRequests' | 'sentDirectRequestUserIds'> & {
  pendingDirectRequests?: DirectMatchRequestDto[] | null;
  sentDirectRequestUserIds?: string[] | null;
};
export type GameRoundDto = components['schemas']['GameRoundDto'];
export type SpinResult = components['schemas']['SpinResult'];
export type AnswerQuestionInput = components['schemas']['AnswerQuestionRequest'];
export type AnswerQuestionResult = components['schemas']['AnswerQuestionResult'];
export type ReconnectRoomResult = components['schemas']['ReconnectRoomResult'];
export type HeartbeatResult = components['schemas']['HeartbeatResult'];
export type SendKissInput = components['schemas']['SendKissRequest'];
export type SendKissResult = components['schemas']['SendKissResult'];
export type SkipKissInput = components['schemas']['SkipKissRequest'];
export type UserAiConsentResponse = components['schemas']['UserAiConsentResponse'];
export type UpdateAiConsentRequest = components['schemas']['UpdateAiConsentRequest'];
export type CrystalTransactionDto = {
  id: string;
  amount: number;
  balanceAfter: number;
  type: string;
  referenceId?: string | null;
  description?: string | null;
  createdAtUtc: string;
};
export type WalletBalanceDto = {
  balance: number;
  outstandingDebt: number;
  recentTransactions?: CrystalTransactionDto[];
};
export type DevGrantRequest = components['schemas']['DevGrantRequest'];
export type GameProfileDto = components['schemas']['GameProfileDto'];
export type UnlockProfileRequest = components['schemas']['UnlockProfileRequest'];
export type UnlockProfileResult = components['schemas']['UnlockProfileResult'];
export type UnlockMatchConversationRequest = components['schemas']['UnlockMatchConversationRequest'];
export type UnlockMatchConversationResult = components['schemas']['UnlockMatchConversationResult'];
export type GameProfileViewNoticeDto = components['schemas']['GameProfileViewNoticeDto'];
export type StoreProductDto = components['schemas']['StoreProductDto'];
export type StorePurchaseRequest = components['schemas']['StorePurchaseRequest'];
export type StorePurchaseResult = components['schemas']['StorePurchaseResult'];
export type StoreRefundRequest = components['schemas']['StoreRefundRequest'];
export type StoreRefundResult = components['schemas']['StoreRefundResult'];
export type SelectTargetRequest = components['schemas']['SelectTargetRequest'];
export type SelectTargetResult = components['schemas']['SelectTargetResult'];
export type GiftCatalogItemDto = components['schemas']['GiftCatalogItemDto'];
export type SendGiftRequest = components['schemas']['SendGiftRequest'];
export type SendGiftResult = components['schemas']['SendGiftResult'];
export type GiftItemDto = components['schemas']['GiftItemDto'];
export type UserGiftsDto = components['schemas']['UserGiftsDto'];
export type SkipTargetRequest = { idempotencyKey?: string };
export type SkipTargetResult = {
  roundId: string;
  spinnerUserId: string;
  status: string;
  nextDeadlineUtc?: string | null;
};
export type PostGameKissRequest = components['schemas']['PostGameKissRequest'];
export type PostGameKissResult = components['schemas']['PostGameKissResult'];

export type DirectMatchRequestDto = {
  requestId: string;
  senderUserId: string;
  senderDisplayName: string;
  senderAge: number;
  senderPhoto?: { id: string; url?: string; state?: string; position: number } | null;
  message: string;
  createdAtUtc: string;
};

export type SendDirectMatchRequestInput = {
  targetUserId: string;
  message: string;
  idempotencyKey: string;
  roomId?: string;
};

export type SendDirectMatchRequestResult = {
  requestId: string;
  targetUserId: string;
  status: string;
  crystalsPaid: number;
  balanceAfter: number;
  createdAtUtc: string;
};

export type RespondDirectMatchRequestInput = {
  action: 'Accept' | 'Decline';
};

export type RespondDirectMatchRequestResult = {
  requestId: string;
  status: string;
  matchId?: string | null;
  conversationId?: string | null;
};

export type GameRoomMessageDto = {
  id: string;
  roomId: string;
  senderUserId: string;
  senderDisplayName: string;
  senderPhotoId?: string | null;
  text: string;
  sentAtUtc: string;
};

export type SendRoomMessageRequest = {
  text: string;
};

export class GameApi {
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

  listRooms = () =>
    this.run(t => this.api.request<GameRoomSummary[]>('/api/game/rooms', undefined, t));

  getRoom = (id: string) =>
    this.run(t => this.api.request<GameRoomDetail>(`/api/game/rooms/${id}`, undefined, t));

  getCurrentRoom = async () => {
    const result = await this.run(t => this.api.request<GameRoomDetail | null>('/api/game/current', undefined, t));
    return result ?? null;
  };

  joinQueue = (capacity: number) =>
    this.run(t => this.api.request<GameRoomDetail>('/api/game/queue', { capacity }, t));

  createRoom = (input?: CreateRoomInput) =>
    this.run(t => this.api.request<GameRoomDetail>('/api/game/rooms', input ?? {}, t));

  joinRoom = (id: string, input?: JoinRoomInput) =>
    this.run(t => this.api.request<JoinRoomResult>(`/api/game/rooms/${id}/join`, input ?? {}, t));

  leaveRoom = (id: string) =>
    this.run(t => this.api.request<LeaveRoomResult>(`/api/game/rooms/${id}/leave`, {}, t));

  getSnapshot = (id: string) =>
    this.run(t => this.api.request<GameRoomSnapshot>(`/api/game/rooms/${id}/snapshot`, undefined, t));

  reconnect = (id: string) =>
    this.run(t => this.api.request<ReconnectRoomResult>(`/api/game/rooms/${id}/reconnect`, {}, t));

  heartbeat = (id: string) =>
    this.run(t => this.api.request<HeartbeatResult>(`/api/game/rooms/${id}/heartbeat`, {}, t));

  spinBottle = (id: string, autoPickTarget: boolean = false) =>
    this.run(t => this.api.request<SpinResult>(`/api/game/rooms/${id}/spin?autoPickTarget=${autoPickTarget}`, { autoPickTarget }, t));

  answerQuestion = (id: string, roundId: string, questionIndex: number, input: AnswerQuestionInput) =>
    this.run(t =>
      this.api.request<AnswerQuestionResult>(`/api/game/rooms/${id}/rounds/${roundId}/questions/${questionIndex}/answer`, input, t)
    );

  skipQuestion = (id: string, roundId: string, questionIndex: number, idempotencyKey: string) =>
    this.run(t =>
      this.api.request<AnswerQuestionResult>(`/api/game/rooms/${id}/rounds/${roundId}/questions/${questionIndex}/skip`, { idempotencyKey }, t)
    );

  sendKiss = (id: string, roundId: string, input: SendKissInput) =>
    this.run(t =>
      this.api.request<SendKissResult>(`/api/game/rooms/${id}/rounds/${roundId}/kiss`, input, t)
    );

  skipKiss = (id: string, roundId: string, idempotencyKey: string) =>
    this.run(t =>
      this.api.request<{ skipped: boolean }>(`/api/game/rooms/${id}/rounds/${roundId}/kiss/skip`, { idempotencyKey }, t)
    );

  selectTarget = (id: string, roundId: string, targetUserId: string) =>
    this.run(t =>
      this.api.request<SelectTargetResult>(`/api/game/rooms/${id}/rounds/${roundId}/target`, { targetUserId }, t)
    );

  skipTarget = (id: string, roundId: string, idempotencyKey: string) =>
    this.run(t =>
      this.api.request<SkipTargetResult>(`/api/game/rooms/${id}/rounds/${roundId}/target/skip`, { idempotencyKey }, t)
    );

  postGameKiss = (id: string, input: PostGameKissRequest) =>
    this.run(t =>
      this.api.request<PostGameKissResult>(`/api/game/rooms/${id}/post-game-kiss`, input, t)
    );

  getAiConsent = () =>
    this.run(t => this.api.request<UserAiConsentResponse>('/api/game/ai-consent', undefined, t));

  updateAiConsent = (aiConsent: boolean) =>
    this.run(t => this.api.request<UserAiConsentResponse>('/api/game/ai-consent', { aiConsent }, t));

  getWallet = () =>
    this.run(t => this.api.request<WalletBalanceDto>('/api/game/wallet', undefined, t));

  devGrant = (amount: number, idempotencyKey: string) =>
    this.run(t => this.api.request<WalletBalanceDto>('/api/game/wallet/dev-grant', { amount, idempotencyKey }, t));

  getGameProfile = (targetUserId: string) =>
    this.run(t => this.api.request<GameProfileDto>(`/api/game/profiles/${targetUserId}`, undefined, t));

  unlockProfile = (targetUserId: string, idempotencyKey: string) =>
    this.run(t => this.api.request<UnlockProfileResult>(`/api/game/profiles/${targetUserId}/unlock`, { idempotencyKey }, t));

  getProfileViews = () =>
    this.run(t => this.api.request<GameProfileViewNoticeDto[]>('/api/game/profiles/views', undefined, t));

  ackProfileViews = () =>
    this.run(t => this.api.request<void>('/api/game/profiles/views/acknowledge', {}, t));

  unlockMatch = (matchId: string, idempotencyKey: string) =>
    this.run(t => this.api.request<UnlockMatchConversationResult>(`/api/matches/${matchId}/unlock`, { idempotencyKey }, t));

  seedDevFixtures = (id: string, input?: DevFixtureSeedInput) =>
    this.run(t =>
      this.api.request<{ added: number }>(`/api/game/rooms/${id}/dev-fixtures`, input ?? { femaleCount: 3, maleCount: 3 }, t)
    );

  getStoreProducts = () =>
    this.run(t => this.api.request<StoreProductDto[]>('/api/game/store/products', undefined, t));

  purchaseStoreProduct = (request: StorePurchaseRequest) =>
    this.run(t => this.api.request<StorePurchaseResult>('/api/game/store/purchase', request, t));

  refundStoreProduct = (request: StoreRefundRequest) =>
    this.run(t => this.api.request<StoreRefundResult>('/api/game/store/refund', request, t));

  getRoomMessages = (id: string) =>
    this.run(t => this.api.request<GameRoomMessageDto[]>(`/api/game/rooms/${id}/messages`, undefined, t));

  sendRoomMessage = (id: string, text: string) =>
    this.run(t => this.api.request<GameRoomMessageDto>(`/api/game/rooms/${id}/messages`, { text }, t));

  sendDirectMatchRequest = (input: SendDirectMatchRequestInput) =>
    this.run(t => this.api.request<SendDirectMatchRequestResult>('/api/game/direct-request', input, t));

  respondDirectMatchRequest = (requestId: string, input: RespondDirectMatchRequestInput) =>
    this.run(t => this.api.request<RespondDirectMatchRequestResult>(`/api/game/direct-request/${requestId}/respond`, input, t));

  getGiftCatalog = () =>
    this.run(t => this.api.request<GiftCatalogItemDto[]>('/api/game/gifts/catalog', undefined, t));

  sendGift = (request: SendGiftRequest) =>
    this.run(t => this.api.request<SendGiftResult>('/api/game/gifts/send', request, t));

  getUserGifts = () =>
    this.run(t => this.api.request<UserGiftsDto>('/api/game/gifts/history', undefined, t));

  createTelegramStarsInvoice = (input: components['schemas']['TelegramStarsInvoiceRequest']) =>
    this.run(t => this.api.request<components['schemas']['TelegramStarsInvoiceResponse']>('/api/payments/telegram-stars/invoice', input, t));

  verifyTelegramStarsPayment = (input: components['schemas']['TelegramStarsVerifyRequest']) =>
    this.run(t => this.api.request<components['schemas']['TelegramStarsVerifyResponse']>('/api/payments/telegram-stars/verify', input, t));

  uploadMedia = (file: import('../chat/ChatMediaApi').ChatMediaFile, mediaType: 'photo' | 'voice', duration?: number): Promise<import('../chat/ChatMediaApi').ChatMediaUploadResult> =>
    this.run(t => import('../chat/ChatMediaApi').then(m => m.uploadChatMedia(this.api.baseUrl, t, file, mediaType, duration)));

  getBaseUrl = () => this.api.baseUrl;
  getToken = () => this.run(async t => t);
}

