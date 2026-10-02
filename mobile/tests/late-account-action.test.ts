import { ChatApi } from '../src/chat/api';
import { MatchApi } from '../src/matching/api';
import { ProfileApi } from '../src/profile/api';
import { DiscoveryApi } from '../src/discovery/api';
import type { AuthApi } from '../src/auth/api';
import type { SessionManager } from '../src/auth/session';
test('a picker/location callback begun by A cannot write to newly signed-in B', async () => {
  let id = 'A';
  const request = jest.fn();
  const api = { request } as unknown as AuthApi;
  const session = { snapshot: () => ({ account: { id } }), withAccess: jest.fn() } as unknown as SessionManager;
  const chat = new ChatApi(api, session); const matches = new MatchApi(api, session); const photos = new ProfileApi(api, session); const discovery = new DiscoveryApi(api, session);
  id = 'B';
  await expect(chat.send('conversation',{ clientMessageId: 'old-request',text: 'hello' })).rejects.toThrow();
  await expect(matches.decide({ requestId: 'old-request',targetId: 'target',kind: 'like' })).rejects.toThrow();
  await expect(photos.begin('old-request')).rejects.toThrow();
  await expect(discovery.location(41,44)).rejects.toThrow();
  expect(request).not.toHaveBeenCalled(); expect(session.withAccess).not.toHaveBeenCalled();
});
