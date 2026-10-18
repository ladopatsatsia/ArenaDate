import { createContext, PropsWithChildren, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { AuthApi } from './api';
import { SessionManager } from './session';
import { initTelegram } from '../telegram/telegramSdk';

const Context = createContext<{ manager: SessionManager; api: AuthApi } | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, gcTime: 5 * 60 * 1000 } } }));
  const [value] = useState(() => {
    const isRemoteWeb = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.location?.origin && !window.location.origin.includes('localhost:') && !window.location.origin.includes('127.0.0.1:');
    const baseUrl = isRemoteWeb
      ? window.location.origin
      : (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5180');
    console.log('[AuthProvider] Base API URL:', baseUrl);
    const api = new AuthApi(baseUrl);
    const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
    const storage = Platform.OS === 'web'
      ? {
          get: async () => {
            try { return typeof window !== 'undefined' ? window.localStorage.getItem('dating.refresh') : null; }
            catch { return null; }
          },
          set: async (val: string) => {
            try { if (typeof window !== 'undefined') window.localStorage.setItem('dating.refresh', val); }
            catch { /* ignore */ }
          },
          remove: async () => {
            try { if (typeof window !== 'undefined') window.localStorage.removeItem('dating.refresh'); }
            catch { /* ignore */ }
          },
        }
      : {
          get: () => SecureStore.getItemAsync('dating.refresh', options),
          set: (val: string) => SecureStore.setItemAsync('dating.refresh', val, options),
          remove: () => SecureStore.deleteItemAsync('dating.refresh', options),
        };

    const manager = new SessionManager(api, storage, () => { void queryClient.cancelQueries(); queryClient.clear(); }, Crypto.randomUUID, baseUrl);
    return { manager, api };
  });
  useEffect(() => {
    initTelegram();
    void value.manager.restore();
  }, [value]);
  useEffect(()=>{focusManager.setFocused(AppState.currentState==='active');const subscription=AppState.addEventListener('change',next=>focusManager.setFocused(next==='active'));return()=>{subscription.remove();focusManager.setFocused(undefined);};},[]);
  return <QueryClientProvider client={queryClient}><Context.Provider value={value}>{children}</Context.Provider></QueryClientProvider>;
}

export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error('AuthProvider required');
  const state = useSyncExternalStore(context.manager.subscribe, context.manager.snapshot);
  return { ...context, state };
}



