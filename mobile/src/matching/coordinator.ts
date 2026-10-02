import { ApiError } from '../auth/api';
import type { SwipeInput, SwipeResult } from './api';
export type Journal = { pending: SwipeInput | null };
export interface JournalStore { load(): Promise<Journal>; save(value: Journal): Promise<void>; hasSeen(id: string): Promise<boolean>; markSeen(id: string): Promise<void> }
export interface SwipeTransport {
 decide(input: SwipeInput): Promise<SwipeResult>; receipt(id: string): Promise<SwipeResult>;
 acknowledge(id: string): Promise<void>;
}
export class SwipeCoordinator {
 private journal: Journal = { pending: null };
 private ready = false; private busy = false;
 constructor(private readonly api: SwipeTransport, private readonly store: JournalStore, private readonly uuid: () => string) {}
 get pending() { return this.journal.pending; }
 async restore() { this.journal = await this.store.load(); this.ready = true; }
 async decide(targetId: string, kind: 'like' | 'pass') {
  if (!this.ready || this.busy || this.pending) throw new Error('swipe_pending');
  this.busy = true;
  try {
   const next = { ...this.journal, pending: { requestId: this.uuid(), targetId, kind } };
   await this.store.save(next); this.journal = next; // durable intent BEFORE network
   return await this.send(false);
  } finally { this.busy = false; }
 }
 async reconcile() {
  if (!this.ready || this.busy) throw new Error('swipe_pending');
  if (!this.pending) return null;
  this.busy = true;
  try { return await this.send(true); } finally { this.busy = false; }
 }
 private async send(lookup: boolean): Promise<SwipeResult> {
  const pending = this.pending!;
  try {
   let result: SwipeResult;
   if (lookup) {
    try { result = await this.api.receipt(pending.requestId); }
    catch (error) {
     // 404 means not committed YET. Retry the exact intent; a concurrent original may still commit.
     if (!(error instanceof ApiError) || error.status !== 404) throw error;
     result = await this.api.decide(pending);
    }
   } else result = await this.api.decide(pending);
   if (result.requestId !== pending.requestId || result.targetId !== pending.targetId || result.kind !== pending.kind)
    throw new Error('invalid_swipe_response');
   // Keep the confirmed response pending until UI has durably claimed its match notification.
   return result;
  } catch (error) {
   if (error instanceof ApiError && [400,403,404,409,422].includes(error.status)) {
    const next = { ...this.journal, pending: null }; await this.store.save(next); this.journal = next;
   }
   // Timeouts, offline, 401, 429 and 5xx keep the SAME request, including across restart.
   throw error;
  }
 }
 async complete() {
  const next = { ...this.journal, pending: null }; await this.store.save(next); this.journal = next;
 }
 async claimMatch(id: string): Promise<boolean> {
  if (await this.store.hasSeen(id)) { await this.api.acknowledge(id); return false; }
  await this.store.markSeen(id); // deduplicate before modal, even across restart
  // A failed acknowledgement is retried by the next inbox poll; durable local claim still wins.
  try { await this.api.acknowledge(id); } catch { return true; }
  return true;
 }
}
