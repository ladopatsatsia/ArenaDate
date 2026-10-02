import { createContext, PropsWithChildren, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { AuthApi } from './api';
import { SessionManager } from './session';

const Context = createContext<{ manager: SessionManager; api: AuthApi } | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, gcTime: 5 * 60 * 1000 } } }));
  const [value] = useState(() => {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5180';
    const api = new AuthApi(baseUrl);
    const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
    const manager = new SessionManager(api, {
      get: () => SecureStore.getItemAsync('dating.refresh', options),
      set: value => SecureStore.setItemAsync('dating.refresh', value, options),
      remove: () => SecureStore.deleteItemAsync('dating.refresh', options),
    }, () => { void queryClient.cancelQueries(); queryClient.clear(); }, Crypto.randomUUID, baseUrl);
    return { manager, api };
  });
  useEffect(() => { void value.manager.restore(); }, [value]);
  useEffect(()=>{focusManager.setFocused(AppState.currentState==='active');const subscription=AppState.addEventListener('change',next=>focusManager.setFocused(next==='active'));return()=>{subscription.remove();focusManager.setFocused(undefined);};},[]);
  return <QueryClientProvider client={queryClient}><Context.Provider value={value}>{children}</Context.Provider></QueryClientProvider>;
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error('AuthProvider required');
  const state = useSyncExternalStore(context.manager.subscribe, context.manager.snapshot);
  return { ...context, state };
}
