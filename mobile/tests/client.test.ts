import { getReadiness } from '../src/api/client';

const mockFetch = jest.fn();
beforeEach(() => { global.fetch = mockFetch; mockFetch.mockReset(); });
test('uses the real readiness endpoint and accepts only a ready response', async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ status: 'ready' }) });
  await expect(getReadiness('http://10.0.2.2:5080/')).resolves.toEqual({ status: 'ready' });
  expect(mockFetch.mock.calls[0][0]).toBe('http://10.0.2.2:5080/api/health/ready');
});
test.each([{ ok: false }, { ok: true, json: async () => ({ status: 'ok' }) }])('never interprets failure as readiness', async response => {
  mockFetch.mockResolvedValue(response);
  await expect(getReadiness('http://localhost:5080')).rejects.toThrow();
});
test('rejects credential-bearing URLs before sending', async () => {
  await expect(getReadiness('http://secret:password@localhost')).rejects.toThrow('Invalid API URL');
  expect(mockFetch).not.toHaveBeenCalled();
});
