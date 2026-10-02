import { QueryClient } from '@tanstack/react-query';
import { ApiError, type Login, type Refresh, type Tokens } from '../src/auth/api';
import { SessionManager } from '../src/auth/session';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const requestId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
function tokens(id = A, suffix = '1'): Tokens { return { account: { id }, accessToken: 'access-' + id + suffix, refreshToken: 'refresh-' + id + suffix,
  accessExpiresAt: new Date(Date.now() + 300000).toISOString(), sessionExpiresAt: new Date(Date.now() + 86400000).toISOString() }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function harness() {
  let saved: string | null = null;
  const cache = new QueryClient();
  const clear = jest.fn(() => cache.clear());
  const storage = { get: jest.fn(async () => saved), set: jest.fn(async (value: string) => { saved = value; }), remove: jest.fn(async () => { saved = null; }) };
  const api = {
    login: jest.fn<Promise<Tokens>, [Login]>().mockResolvedValue(tokens()),
    refresh: jest.fn<Promise<Tokens>, [Refresh]>().mockResolvedValue(tokens(A, '2')),
    logout: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
    logoutAll: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
  };
  const manager = new SessionManager(api, storage, clear, () => requestId, 'test-api');
  return { manager, api, storage, clear, cache, saved: () => saved };
}
const credentials = { email: 'a@example.test', password: 'a strong password' };
async function tickUntil(condition: () => boolean) { for (let i = 0; i < 100 && !condition(); i++) await new Promise(r => setTimeout(r, 1)); expect(condition()).toBe(true); }

test('persists only refresh material and clears prior-account cache on login', async () => {
  const h = harness(); h.cache.setQueryData(['account', B], 'B-private');
  await h.manager.signIn(credentials);
  expect(h.cache.getQueryData(['account', B])).toBeUndefined();
  expect(h.manager.snapshot().account?.id).toBe(A);
  expect(h.saved()).toContain('refresh-'); expect(h.saved()).not.toContain('access-');
});
test('parallel unauthorized requests share one refresh and each retries once', async () => {
  const h = harness(); await h.manager.signIn(credentials);
  const pending = deferred<Tokens>(); h.api.refresh.mockReturnValue(pending.promise);
  const action = jest.fn(async (token: string) => { if (token === tokens().accessToken) throw new ApiError(401); return 'allowed'; });
  const first = h.manager.withAccess(action); const second = h.manager.withAccess(action);
  await tickUntil(() => h.api.refresh.mock.calls.length === 1);
  pending.resolve(tokens(A, '2'));
  expect(await Promise.all([first, second])).toEqual(['allowed', 'allowed']);
  expect(h.api.refresh).toHaveBeenCalledTimes(1);
});
test('lost refresh response retains the same request ID across app restart', async () => {
  const h = harness(); await h.manager.signIn(credentials);
  h.api.refresh.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(tokens(A, '2'));
  await expect(h.manager.refresh()).rejects.toThrow();
  expect(h.manager.snapshot().status).toBe('offline');
  const restarted = new SessionManager(h.api, h.storage, h.clear, () => B, 'test-api');
  await restarted.restore();
  expect(h.api.refresh.mock.calls[0]?.[0].requestId).toBe(h.api.refresh.mock.calls[1]?.[0].requestId);
  expect(restarted.snapshot().account?.id).toBe(A);
});
test('logout during refresh cannot resurrect credentials or account', async () => {
  const h = harness(); await h.manager.signIn(credentials);
  const pending = deferred<Tokens>(); h.api.refresh.mockReturnValue(pending.promise);
  const refreshing = h.manager.refresh();
  await tickUntil(() => h.api.refresh.mock.calls.length === 1);
  await h.manager.logout();
  pending.resolve(tokens(A, '2'));
  await expect(refreshing).rejects.toThrow('session_changed');
  expect(h.saved()).toBeNull(); expect(h.manager.snapshot().status).toBe('signedOut');
});
test('late account A response cannot enter account B cache or session', async () => {
  const h = harness(); await h.manager.signIn(credentials);
  h.cache.setQueryData(['account', A, 'private'], 'private A');
  const response = deferred<string>();
  const oldRequest = h.manager.withAccess(async () => response.promise);
  h.api.login.mockResolvedValueOnce(tokens(B));
  await h.manager.signIn({ ...credentials, email: 'b@example.test' });
  response.resolve('private A');
  await expect(oldRequest).rejects.toThrow('session_changed');
  expect(h.cache.getQueryData(['account', A, 'private'])).toBeUndefined();
  expect(h.manager.snapshot().account?.id).toBe(B);
  expect(h.saved()).not.toContain(A);
});
test('invalid refresh removes secure credentials and all account cache', async () => {
  const h = harness(); await h.manager.signIn(credentials); h.cache.setQueryData(['account', A], 'private');
  h.api.refresh.mockRejectedValue(new ApiError(401));
  await expect(h.manager.refresh()).rejects.toThrow();
  expect(h.saved()).toBeNull(); expect(h.cache.getQueryCache().getAll()).toHaveLength(0);
  expect(h.manager.snapshot().notice).toBe('session_expired');
});
test('offline logout is explicit and still clears device credentials', async () => {
  const h = harness(); await h.manager.signIn(credentials); h.api.logout.mockRejectedValue(new Error('offline'));
  await expect(h.manager.logout()).rejects.toThrow();
  expect(h.saved()).toBeNull(); expect(h.manager.snapshot().notice).toBe('logout_local_only');
});
test('concurrent sign-ins do not share a generation', async () => {
  const h = harness(); const pending = deferred<Tokens>(); h.api.login.mockReturnValueOnce(pending.promise);
  const first = h.manager.signIn(credentials);
  await tickUntil(() => h.api.login.mock.calls.length === 1);
  h.api.login.mockResolvedValueOnce(tokens(B));
  await h.manager.signIn({ ...credentials, email: 'b@example.test' });
  pending.resolve(tokens(A));
  await expect(first).rejects.toThrow('session_changed');
  expect(h.manager.snapshot().account?.id).toBe(B);
});
test('malformed secure-storage record is removed rather than treated as a session', async () => {
  const h = harness(); h.storage.get.mockResolvedValue('broken-json'); await h.manager.restore();
  expect(h.storage.remove).toHaveBeenCalled(); expect(h.manager.snapshot().status).toBe('signedOut');
});
test('a stale storage write cannot overwrite a later logout', async () => {
  const h = harness(); const pending = deferred<void>();
  h.storage.set.mockImplementationOnce(async () => pending.promise);
  const signingIn = h.manager.signIn(credentials);
  await tickUntil(() => h.storage.set.mock.calls.length === 1);
  const clearing = h.manager.clear();
  pending.resolve();
  await clearing; await expect(signingIn).rejects.toThrow('session_changed');
  expect(h.manager.snapshot().status).toBe('signedOut'); expect(h.saved()).toBeNull();
});
