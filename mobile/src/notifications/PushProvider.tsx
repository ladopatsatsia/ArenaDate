import {createContext,type PropsWithChildren,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import { Alert, AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useRootNavigationState, useRouter } from 'expo-router';
import {useTranslation} from 'react-i18next';
import {useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/AuthProvider';
import {ApiError} from '../auth/api';
import {PushApi,type Configuration,type Preferences} from './api';
import {registerInstallation} from './native';
import {authorizedNotification,notificationId} from './model';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Platform.OS === 'web';

// The OS may already have displayed background pushes. Foreground hints never reveal stale account data.
if (!isExpoGo) {
  try {
    Notifications.setNotificationHandler({handleNotification:async()=>({shouldShowBanner:false,shouldShowList:false,shouldPlaySound:false,shouldSetBadge:false})});
  } catch {
    // Expo Go (SDK 53+) or unsupported platform safe fallback
  }
}

interface ContextValue{configuration:Configuration|null;preferences:Preferences|null;busy:boolean;notice:string;save(value:Preferences):Promise<void>;reload():Promise<void>}
const Context=createContext<ContextValue|null>(null);
export function PushProvider({children}:PropsWithChildren){
 const {t}=useTranslation();const {state,api:auth,manager}=useAuth();const account=state.account?.id;const router=useRouter();const navigation=useRootNavigationState();const cache=useQueryClient();
 const api=useMemo(()=>new PushApi(auth,manager),[auth,manager,account]);const pending=useRef<unknown>(null);const handled=useRef(new Set<string>());const [tap,setTap]=useState(0);
 const [data,setData]=useState<{account?:string;configuration:Configuration;preferences:Preferences}|null>(null);
 const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);const operations=useRef<Promise<void>>(Promise.resolve());const handling=useRef(false);
 const run=useCallback((work:()=>Promise<void>)=>{const next=operations.current.catch(()=>undefined).then(work);operations.current=next;return next;},[]);
 const current=useCallback(()=>!!account&&manager.snapshot().account?.id===account,[account,manager]);
 const failure=(error:unknown)=>error instanceof Error&&['push_not_configured','push_development_build','push_project_mismatch','push_permission_denied'].includes(error.message)?error.message:'push_failed';
 const reload=useCallback(()=>run(async()=>{
  if(!current())return;setBusy(true);
  try{const [configuration,preferences]=await Promise.all([api.configuration(),api.preferences()]);if(!current())return;
   setData({account,configuration,preferences});setNotice('');
   if(configuration.enabled&&!isExpoGo)await registerInstallation(api,auth.baseUrl,configuration,false,preferences.matches||preferences.messages);
  }catch(error){if(current())setNotice(failure(error));}finally{if(current()){setBusy(false);setTap(v=>v+1);}}
 }),[api,auth.baseUrl,account,current,run]);
 useEffect(()=>{void reload();const app=AppState.addEventListener('change',next=>{if(next==='active')void reload();});
  let tokenListener:{remove():void}|null=null;
  if(!isExpoGo){
   try{tokenListener=Notifications.addPushTokenListener(()=>{void reload();});}catch { /* ignore */ }
  }
  return()=>{app.remove();tokenListener?.remove();};
 },[reload]);
 useEffect(()=>{
  const receive=(response:Notifications.NotificationResponse)=>{const value=response.notification.request.content.data;const id=notificationId(value);if(id&&!handled.current.has(id)){pending.current=value;setTap(v=>v+1);}};
  let listener:{remove():void}|null=null;
  let active=true;
  if(!isExpoGo){
   try{
    listener=Notifications.addNotificationResponseReceivedListener(receive);
    void Notifications.getLastNotificationResponseAsync().then(value=>{if(active&&value)receive(value);},()=>{if(active)setNotice('push_failed');});
   }catch { /* ignore */ }
  }
  return()=>{active=false;listener?.remove();};
 },[]);
 useEffect(()=>{
  if(!account||!navigation?.key||!pending.current||handling.current)return;
  const selectedId=notificationId(pending.current);if(selectedId&&handled.current.has(selectedId)){pending.current=null;return;}
  const value=pending.current;handling.current=true;
  void authorizedNotification(value,api.resolve,current).then(async conversation=>{
   if(!current())return;
   if(conversation){router.push({pathname:'/chat/[id]',params:{id:conversation}});setNotice('');}
   else {setNotice('push_unavailable');Alert.alert(t('push_title'),t('push_unavailable'));}
   if(selectedId){handled.current.add(selectedId);if(handled.current.size>100)handled.current.delete(handled.current.values().next().value!);}
   if(pending.current===value)pending.current=null;try{await Notifications.clearLastNotificationResponseAsync();}catch { /* ignore */ }
  }).catch(error=>{
   if(current()){setNotice(error instanceof ApiError&&[403,404].includes(error.status)?'push_unavailable':'push_failed');
    if(error instanceof ApiError&&[400,403,404].includes(error.status)){if(selectedId)handled.current.add(selectedId);Alert.alert(t('push_title'),t('push_unavailable'));if(pending.current===value)pending.current=null;try{void Notifications.clearLastNotificationResponseAsync().catch(()=>setNotice('push_failed'));}catch { /* ignore */ }}
   }
  }).finally(()=>{handling.current=false;if(pending.current&&(pending.current!==value||!current()))setTap(v=>v+1);});
 },[api,account,current,navigation?.key,router,tap,t]);
 useEffect(()=>{
  let listener:{remove():void}|null=null;
  if(!isExpoGo){
   try{
    listener=Notifications.addNotificationReceivedListener(notification=>{
     void authorizedNotification(notification.request.content.data,api.resolve,current).then(target=>{
      if(target&&current())void cache.invalidateQueries({queryKey:['account',account,'matches']});
     }).catch(()=>{/* Untrusted or no-longer-authorized hints cause no navigation or display. */});
    });
   }catch { /* ignore */ }
  }
  return()=>listener?.remove();
 },[api,current,cache,account]);
 function save(value:Preferences){return run(async()=>{
  if(!current()||!data||data.account!==account)return;setBusy(true);setNotice('');
  try{
   if(data.configuration.enabled&&!isExpoGo&&(value.matches||value.messages))await registerInstallation(api,auth.baseUrl,data.configuration,true);
   await api.save(value);if(current()){setData({...data,preferences:value});setNotice('push_saved');}
  }catch(error){if(current())setNotice(failure(error));}finally{if(current())setBusy(false);}
 });}
 const own=data?.account===account?data:null;
 return <Context.Provider value={{configuration:own?.configuration??null,preferences:own?.preferences??null,busy,notice,save,reload}}>{children}</Context.Provider>;
}
export function usePush(){const value=useContext(Context);if(!value)throw new Error('PushProvider required');return value;}
