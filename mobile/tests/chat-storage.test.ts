import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { pendingStore } from '../src/chat/storage';
jest.mock('expo-secure-store',()=>({WHEN_UNLOCKED_THIS_DEVICE_ONLY:1,getItemAsync:jest.fn(),setItemAsync:jest.fn(),deleteItemAsync:jest.fn()}));
test('chunked encrypted journal roundtrips Unicode, remains account-bound and removes content after confirmation',async()=>{
 const values=new Map<string,string>();
 jest.mocked(SecureStore.getItemAsync).mockImplementation(async key=>values.get(key)??null);
 jest.mocked(SecureStore.setItemAsync).mockImplementation(async(key,value)=>{expect(new TextEncoder().encode(value).length).toBeLessThan(2048);values.set(key,value);});
 jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key=>{values.delete(key);});
 const store=pendingStore('A','conversation','https://api.test');const input={clientMessageId:'73503d49-b7ee-41c5-832b-7223dca26105',text:'🙂'.repeat(900)};
 await store.save(input);expect(await store.load()).toEqual(input);expect(await pendingStore('B','conversation','https://api.test').load()).toBeNull();
 await expect(pendingStore('A','conversation','https://other.test').load()).rejects.toThrow();
 await store.save(null);expect(await store.load()).toBeNull();expect(values.size).toBe(0);
});

test('pendingStore works on web platform using localStorage', async () => {
  const originalOS = Platform.OS;
  const platformObj = Platform as unknown as { OS: string };
  platformObj.OS = 'web';
  const memStore = new Map<string, string>();
  const globalObj = global as unknown as { window?: unknown };
  globalObj.window = {
    localStorage: {
      getItem: (k: string) => memStore.get(k) ?? null,
      setItem: (k: string, v: string) => { memStore.set(k, v); },
      removeItem: (k: string) => { memStore.delete(k); },
    },
  };

  try {
    const store = pendingStore('userWeb', 'conv123', 'https://api.test');
    const input = { clientMessageId: '73503d49-b7ee-41c5-832b-7223dca26105', text: 'Hello from web! 🚀' };
    await store.save(input);
    expect(await store.load()).toEqual(input);
    await store.save(null);
    expect(await store.load()).toBeNull();
  } finally {
    platformObj.OS = originalOS;
    delete globalObj.window;
  }
});
