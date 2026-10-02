import { z } from 'zod';
import { ApiError, type Account, type Login, type SessionApi, type Tokens } from './api';

export interface TokenStorage { get(): Promise<string | null>; set(value: string): Promise<void>; remove(): Promise<void> }
const storedSchema = z.object({ refreshToken: z.string().min(1), origin: z.string(), requestId: z.uuid().optional() });
type Stored = z.infer<typeof storedSchema>;
export type SessionState = { status: 'booting' | 'signedOut' | 'signedIn' | 'offline'; account: Account | null; notice?: string };
export class SessionManager {
  private state: SessionState = { status: 'booting', account: null };
  private listeners = new Set<() => void>();
  private generation = 0;
  private access: string | null = null;
  private accessExpires = 0;
  private record: Stored | null = null;
  private flight: Promise<void> | null = null;
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly api: SessionApi, private readonly storage: TokenStorage,
    private readonly clearCache: () => void, private readonly uuid: () => string, private readonly origin: string) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(state: SessionState) { this.state = state; for (const listener of this.listeners) listener(); }
  private async persist(epoch: number, value: Stored | null) {
    const operation = this.writes.catch(() => undefined).then(async () => {
      if (epoch !== this.generation) return;
      if (value) await this.storage.set(JSON.stringify(value)); else await this.storage.remove();
    });
    this.writes = operation;
    await operation;
  }
  async clear(notice?: string) {
    const epoch = ++this.generation;
    this.flight = null; this.access = null; this.accessExpires = 0; this.record = null;
    this.clearCache();
    this.update({ status: 'signedOut', account: null, notice });
    try { await this.persist(epoch, null); }
    catch { if (epoch === this.generation) this.update({ status: 'offline', account: null, notice: 'storage_error' }); }
    return epoch;
  }
  async restore() {
    if (this.flight) { try { await this.flight; } catch { /* Refresh already updated the visible failure state. */ } return; }
    const epoch = this.generation;
    try {
      await this.writes;
      const raw = await this.storage.get();
      if (epoch !== this.generation) return;
      if (!raw) { this.update({ status: 'signedOut', account: null }); return; }
      let decoded: unknown;
      try { decoded = JSON.parse(raw); } catch { await this.clear("session_expired"); return; }
      const parsed = storedSchema.safeParse(decoded);
      if (!parsed.success || parsed.data.origin !== this.origin) { await this.clear('session_expired'); return; }
      this.record = parsed.data;
      await this.refresh();
    } catch {
      if (epoch === this.generation) { this.access = null; this.clearCache(); this.update({ status: 'offline', account: null, notice: 'connection_error' }); }
    }
  }
  async signIn(credentials: Login) {
    const epoch = await this.clear();
    if (epoch !== this.generation) throw new Error("session_changed");
    if (this.state.status === 'offline') throw new Error('storage_error');
    const result = await this.api.login(credentials);
    if (epoch !== this.generation) throw new Error('session_changed');
    await this.accept(result, epoch);
  }
  private async accept(tokens: Tokens, epoch: number) {
    const record: Stored = { refreshToken: tokens.refreshToken, origin: this.origin };
    await this.persist(epoch, record);
    if (epoch !== this.generation) throw new Error('session_changed');
    this.record = record; this.access = tokens.accessToken; this.accessExpires = Date.parse(tokens.accessExpiresAt);
    this.update({ status: 'signedIn', account: tokens.account });
  }
  refresh(): Promise<void> {
    if (this.flight) return this.flight;
    const epoch = this.generation;
    const run = async () => {
      if (!this.record) { await this.clear('session_expired'); throw new ApiError(401); }
      try {
        const pending = { ...this.record, requestId: this.record.requestId ?? this.uuid() };
        this.record = pending;
        // Persist the same request ID before sending: restart/lost-response retries are idempotent.
        await this.persist(epoch, pending);
        if (epoch !== this.generation) throw new Error('session_changed');
        const tokens = await this.api.refresh({ refreshToken: pending.refreshToken, requestId: pending.requestId });
        if (epoch !== this.generation) throw new Error('session_changed');
        await this.accept(tokens, epoch);
      } catch (error) {
        if (epoch === this.generation) {
          if (error instanceof ApiError && [400, 401, 403, 409].includes(error.status)) await this.clear('session_expired');
          else { this.access = null; this.clearCache(); this.update({ status: 'offline', account: null, notice: 'connection_error' }); }
        }
        throw error;
      }
    };
    const pending = run();
    this.flight = pending;
    void pending.finally(() => { if (this.flight === pending) this.flight = null; }).catch(() => undefined);
    return pending;
  }
  async withAccess<T>(action: (accessToken: string) => Promise<T>): Promise<T> {
    const epoch = this.generation;
    if (!this.access || this.accessExpires <= Date.now() + 15000) await this.refresh();
    if (epoch !== this.generation || !this.access) throw new ApiError(401);
    const access = this.access;
    try {
      const result = await action(access);
      if (epoch !== this.generation) throw new Error('session_changed');
      return result;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || epoch !== this.generation) throw error;
      // A later request may already have rotated this token.
      if (this.access === access) await this.refresh();
      if (epoch !== this.generation || !this.access) throw error;
      try {
        const result = await action(this.access);
        if (epoch !== this.generation) throw new Error('session_changed', { cause: error });
        return result;
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401 && epoch === this.generation) await this.clear('session_expired');
        throw retryError;
      }
    }
  }
  async logout(all = false) {
    const epoch = this.generation;
    let confirmed = false;
    try {
      if (all) await this.withAccess(token => this.api.logoutAll(token));
      else if (this.record) await this.api.logout(this.record.refreshToken);
      confirmed = true;
    } finally { if (epoch === this.generation) await this.clear(confirmed ? undefined : 'logout_local_only'); }
  }
}
