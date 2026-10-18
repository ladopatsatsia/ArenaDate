import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { z } from 'zod';
import type { PendingStore } from './model';

export function pendingStore(account: string, conversation: string, origin: string): PendingStore {
  const key = 'dating.chat.' + account + '.' + conversation;
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  const input = z.object({ clientMessageId: z.uuid(), text: z.string().min(1).max(2000) });

  const isWeb = Platform.OS === 'web';

  const getItem = async (k: string): Promise<string | null> => {
    if (isWeb) {
      try {
        return typeof window !== 'undefined' ? window.localStorage.getItem(k) : null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(k, options);
  };

  const setItem = async (k: string, v: string): Promise<void> => {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem(k, v);
      } catch {
        // ignore
      }
      return;
    }
    await SecureStore.setItemAsync(k, v, options);
  };

  const deleteItem = async (k: string): Promise<void> => {
    if (isWeb) {
      try {
        if (typeof window !== 'undefined') window.localStorage.removeItem(k);
      } catch {
        // ignore
      }
      return;
    }
    await SecureStore.deleteItemAsync(k, options).catch(() => {});
  };

  return {
    load: async () => {
      const manifest = await getItem(key);
      if (!manifest) return null;
      const { parts } = z.object({ parts: z.number().int().min(1).max(32) }).parse(JSON.parse(manifest));
      let data = '';
      for (let i = 0; i < parts; i++) {
        const part = await getItem(key + '.' + i);
        if (part === null) return null;
        data += part;
      }
      const parsed = z.object({ origin: z.literal(origin), input }).parse(JSON.parse(data));
      return parsed.input;
    },
    save: async (value) => {
      if (value === null) {
        await deleteItem(key);
        for (let i = 0; i < 32; i++) await deleteItem(key + '.' + i);
        return;
      }
      const data = Array.from(JSON.stringify({ origin, input: value }));
      const parts = Math.ceil(data.length / 400);
      if (parts > 32) throw new Error('storage_error');
      for (let i = 0; i < parts; i++) {
        await setItem(key + '.' + i, data.slice(i * 400, (i + 1) * 400).join(''));
      }
      await setItem(key, JSON.stringify({ parts }));
    },
  };
}
