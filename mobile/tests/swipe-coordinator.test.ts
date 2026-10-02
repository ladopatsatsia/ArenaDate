import { ApiError } from '../src/auth/api';
import { SwipeCoordinator, type Journal, type JournalStore, type SwipeTransport } from '../src/matching/coordinator';
function setup() {
 let journal: Journal = { pending: null }; const seen = new Set<string>();
 const store: JournalStore = { load: jest.fn(async () => journal), save: jest.fn(async value => { journal = JSON.parse(JSON.stringify(value)) as Journal; }),
  hasSeen: async id => seen.has(id), markSeen: jest.fn(async id => { seen.add(id); }) };
 const api: SwipeTransport = { decide: jest.fn(async input => ({ ...input, matchId: null })), receipt: jest.fn(), acknowledge: jest.fn(async () => {}) };
 const uuid = jest.fn(() => 'request-1'); const coordinator = new SwipeCoordinator(api,store,uuid);
 return { store,api,uuid,coordinator };
}
test('timeout remains pending, blocks opposite gesture, and restart retries the SAME request after unknown receipt',async () => {
 const s = setup(); await s.coordinator.restore();
 jest.mocked(s.api.decide).mockRejectedValueOnce(new Error('timeout'));
 await expect(s.coordinator.decide('target','like')).rejects.toThrow('timeout');
 await expect(s.coordinator.decide('target','pass')).rejects.toThrow('swipe_pending');
 const restarted = new SwipeCoordinator(s.api,s.store,s.uuid); await restarted.restore();
 jest.mocked(s.api.receipt).mockRejectedValueOnce(new ApiError(404));
 expect(await restarted.reconcile()).toEqual({ requestId: 'request-1',targetId:'target',kind:'like',matchId:null });
 expect(s.api.decide).toHaveBeenNthCalledWith(2,{requestId:'request-1',targetId:'target',kind:'like'});
 expect(s.uuid).toHaveBeenCalledTimes(1); await restarted.complete(); expect(restarted.pending).toBeNull();
});
test('committed lost response is reconciled without a second write and match claims survive restart and acknowledgement failure',async () => {
 const s=setup();await s.coordinator.restore();jest.mocked(s.api.decide).mockRejectedValueOnce(new Error('lost'));
 await expect(s.coordinator.decide('target','like')).rejects.toThrow();
 jest.mocked(s.api.receipt).mockResolvedValue({requestId:'request-1',targetId:'target',kind:'like',matchId:'actual-match'});
 expect((await s.coordinator.reconcile())?.matchId).toBe('actual-match');
 jest.mocked(s.api.acknowledge).mockRejectedValueOnce(new Error('offline'));
 expect(await s.coordinator.claimMatch('actual-match')).toBe(true);
 const restarted=new SwipeCoordinator(s.api,s.store,s.uuid);await restarted.restore();
 expect(await restarted.claimMatch('actual-match')).toBe(false);
 expect(s.api.decide).toHaveBeenCalledTimes(1);
});
test('intent storage failure prevents sending; same-tick repeated gestures cannot race',async () => {
 const s=setup();await s.coordinator.restore();
 jest.mocked(s.store.save).mockRejectedValueOnce(new Error('storage'));
 await expect(s.coordinator.decide('target','like')).rejects.toThrow('storage');expect(s.api.decide).not.toHaveBeenCalled();
 const first=s.coordinator.decide('target','like');
 await expect(s.coordinator.decide('target','pass')).rejects.toThrow('swipe_pending');await first;
 expect(s.api.decide).toHaveBeenCalledTimes(1);
});
test.each([429,500,401])('HTTP %i keeps pending intent',async status => {
 const s=setup();await s.coordinator.restore();jest.mocked(s.api.decide).mockRejectedValue(new ApiError(status));
 await expect(s.coordinator.decide('target','like')).rejects.toThrow();expect(s.coordinator.pending?.requestId).toBe('request-1');
});
test.each([400,403,404,409])('definitive HTTP %i clears pending without converting to another decision',async status => {
 const s=setup();await s.coordinator.restore();jest.mocked(s.api.decide).mockRejectedValue(new ApiError(status));
 await expect(s.coordinator.decide('target','like')).rejects.toThrow();expect(s.coordinator.pending).toBeNull();expect(s.api.decide).toHaveBeenCalledTimes(1);
});
test('mismatched server response is not accepted as the pending decision',async () => {
 const s=setup();await s.coordinator.restore();jest.mocked(s.api.decide).mockResolvedValue({requestId:'other',targetId:'target',kind:'like',matchId:null});
 await expect(s.coordinator.decide('target','like')).rejects.toThrow('invalid_swipe_response');expect(s.coordinator.pending).not.toBeNull();
});
