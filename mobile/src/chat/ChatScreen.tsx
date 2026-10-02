import { Button, Text, TextInput } from '../components/UI';
import { SafetyActions } from "../safety/SafetyActions";
import { safetySubscribe } from "../safety/api";
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { AppState, FlatList, KeyboardAvoidingView, Platform, View, type ViewToken } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../auth/api';
import { ChatApi,type Message } from './api';
import { MessageSender,mergeMessages } from './model';
import { pendingStore } from './storage';
import { LiveChat,signalRConnection } from './live';
import { Screen } from '../components/Screen';
import { Link, StateMessage } from '../components/UI';
import { theme } from '../components/theme';
import { useReducedMotion } from '../components/useReducedMotion';
export default function ChatRoute() {
 const {id}=useLocalSearchParams<{id:string}>();const {state}=useAuth();const {t}=useTranslation();
 if(typeof id!=='string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || !state.account)return <Screen title={t('chat_title')}><StateMessage title={t('chat_unavailable')}/><Link href="/(tabs)/matches">{t('matches')}</Link></Screen>;
 return <ChatScreen key={state.account.id+id} id={id} account={state.account.id}/>;
}
export function ChatScreen({id,account}:{id:string;account:string}) {
 const {api:auth,manager}=useAuth();const {t}=useTranslation();const insets=useSafeAreaInsets();const cache=useQueryClient();
 const reduced=useReducedMotion();const olderLock=useRef(false);
 const api=useMemo(()=>new ChatApi(auth,manager),[auth,manager]);
 const sender=useMemo(()=>new MessageSender(input=>api.send(id,input),pendingStore(account,id,auth.baseUrl),Crypto.randomUUID),[api,id,account,auth.baseUrl]);
 const [messages,setMessages]=useState<Message[]>([]);const rows=useRef<Message[]>([]);const [peerRead,setPeerRead]=useState('0');
 const [before,setBefore]=useState<string|null>(null);const [text,setText]=useState('');const [notice,setNotice]=useState('');
 const [sending,setSending]=useState(false);const [ready,setReady]=useState(false);const [online,setOnline]=useState(false);const [loading,setLoading]=useState(true);
 const [pending,setPending]=useState(sender.pending);const [visible,setVisible]=useState<Message|null>(null);
 const revoked=useRef(false);const [closed,setClosed]=useState(false);const stopLive=useRef<()=>void>(()=>undefined);
 const clear=useCallback(()=>{
  revoked.current=true;setClosed(true);rows.current=[];historyThrough.current=undefined;setMessages([]);setText("");setPending(null);setPeerRead("0");setBefore(null);setVisible(null);setReady(false);setLoading(false);setOnline(false);setNotice("chat_unavailable");stopLive.current();
  void sender.revoke().catch(()=>setNotice("chat_storage_failed"));
  void cache.cancelQueries({queryKey:["account",account]}).then(()=>cache.resetQueries({queryKey:["account",account]}));
 },[sender,cache,account]);
 useEffect(()=>safetySubscribe(account,conversation=>{if(conversation===id)clear();}),[account,id,clear]);
 const historyThrough=useRef<string|undefined>(undefined);
 const active=useRef(true);const catching=useRef(false);const again=useRef(false);const sendingLock=useRef(false);const focused=useRef(false);const list=useRef<FlatList<Message>>(null);
 const current=useCallback(()=>!revoked.current&&active.current&&manager.snapshot().account?.id===account,[account,manager]);
 const merge=useCallback((incoming:Message[],older=false)=>{if(!current())return;rows.current=mergeMessages(rows.current,incoming,older);setMessages(rows.current);},[current]);
 const catchup=useCallback(async()=>{
  if(!current())return;if(catching.current){again.current=true;return;}catching.current=true;
  try {
   do {
    again.current=false;
    let after=historyThrough.current;let pages=0;
    do {
     const page=await api.history(id,undefined,after);if(!current())return;
     merge(page.items);historyThrough.current=page.items.at(-1)?.sequence ?? historyThrough.current;setPeerRead(page.peerReadSequence);if(!after)setBefore(page.nextBefore??null);
     after=page.nextAfter??undefined;pages++;
    } while(after&&current()&&pages<10);
    if(after&&current()) {const latest=await api.history(id);if(!current())return;rows.current=[];merge(latest.items);historyThrough.current=latest.items.at(-1)?.sequence;setBefore(latest.nextBefore??null);setPeerRead(latest.peerReadSequence);}
   } while(again.current&&current());
   setNotice('');void cache.invalidateQueries({queryKey:['account',account,'matches']});
  } catch(error) {if(current()){setNotice(error instanceof ApiError&&[403,404].includes(error.status)?'chat_unavailable':'connection_error');if(error instanceof ApiError&&[403,404].includes(error.status)){clear();}}throw error;}
  finally {catching.current=false;if(current())setLoading(false);}
 },[api,id,current,merge,cache,account,clear]);
 const live=useMemo(()=>new LiveChat(()=>signalRConnection(auth.baseUrl,id,api.token),catchup,value=>{if(current())setOnline(value);},clear),[auth.baseUrl,id,api,catchup,current,clear]);
 stopLive.current=()=>{void live.stop();};
 useEffect(()=>{active.current=true;void sender.restore().then(()=>{if(current()){setPending(sender.pending);setReady(true);}},()=>{if(current())setNotice('chat_storage_failed');});
  return()=>{active.current=false;};},[sender,current]);
 useFocusEffect(useCallback(()=>{
  focused.current=true;
  const update=()=>{if(!revoked.current&&AppState.currentState==='active'){live.start();void catchup().catch(()=>undefined);}else{void live.stop();}};
  update();const subscription=AppState.addEventListener('change',update);
  const fallback=setInterval(()=>{if(AppState.currentState==='active')void catchup().catch(()=>undefined);},30000);
  return()=>{focused.current=false;subscription.remove();clearInterval(fallback);void live.stop();};
 },[live,catchup]));
 useEffect(()=>{
  if(!visible||!focused.current||AppState.currentState!=='active')return;
  const timer=setTimeout(()=>{void api.read(id,visible.id).then(()=>cache.invalidateQueries({queryKey:['account',account,'matches']}),error=>{if(current()){if(error instanceof ApiError&&[403,404].includes(error.status))clear();else setNotice('connection_error');}});},300);
  return()=>clearTimeout(timer);
 },[visible,api,id,cache,account,current,clear]);
 const onVisible=useRef(({viewableItems}:{viewableItems:ViewToken<Message>[]})=>{
  const latest=viewableItems.map(v=>v.item).filter(m=>!m.id.startsWith('pending-')).sort((a,b)=>BigInt(a.sequence)>BigInt(b.sequence)?-1:1)[0];
  if(latest)setVisible(latest);
 }).current;
 async function send(retry=false) {
  if(!current()||!ready||sendingLock.current)return;sendingLock.current=true;setSending(true);setNotice('');
  try {
   const operation=sender.submit(retry?undefined:text,value=>{if(current())setPending(value);});
   // Durable storage precedes network; show selected text optimistically without inventing sent state.
   const result=await operation;if(!current())return;merge([result]);setPending(null);setText('');list.current?.scrollToOffset({offset:0,animated:!reduced});void catchup().catch(()=>undefined);
  } catch(error) {if(current()){if(error instanceof ApiError&&[403,404].includes(error.status))clear();else{setPending(sender.pending);setNotice('chat_send_failed');}}}
  finally {sendingLock.current=false;if(current())setSending(false);}
 }
 async function older() {
  if(!before||loading||olderLock.current)return;olderLock.current=true;setLoading(true);
  try{const page=await api.history(id,before);if(current()){merge(page.items,true);setBefore(page.nextBefore??null);}}
  catch(error){if(current()){if(error instanceof ApiError&&[403,404].includes(error.status))clear();else setNotice('connection_error');}}finally{olderLock.current=false;if(current())setLoading(false);}
 }
 const displayed=[...messages].reverse();
 const pendingVisible=pending&&!messages.some(m=>m.senderId===account&&m.clientMessageId===pending.clientMessageId);
 return <KeyboardAvoidingView style={{flex:1,paddingBottom:insets.bottom,paddingLeft:insets.left,paddingRight:insets.right,backgroundColor:theme.colors.background}} behavior={Platform.OS==='ios'?'padding':'height'} keyboardVerticalOffset={Platform.OS==='ios'?insets.top+44:0}>
  <SafetyActions conversationId={id} closed={closed}/><Text>{t(online?'chat_online':'chat_reconnecting')}</Text>
  {!!notice&&<Text accessibilityRole="alert">{t(notice)}</Text>}
  <Button title={t('chat_newest')} disabled={closed||loading} onPress={()=>{rows.current=[];historyThrough.current=undefined;setMessages([]);setLoading(true);void catchup().catch(()=>undefined);list.current?.scrollToOffset({offset:0,animated:!reduced});}}/>
  <FlatList ref={list} inverted data={displayed} initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7} keyExtractor={m=>m.id} onViewableItemsChanged={onVisible} viewabilityConfig={{itemVisiblePercentThreshold:60}}
   keyboardShouldPersistTaps="handled" maintainVisibleContentPosition={{minIndexForVisible:0,autoscrollToTopThreshold:40}}
   ListEmptyComponent={<Text>{t(closed?'chat_unavailable':loading?'working':notice?'connection_error':'chat_empty')}</Text>}
   ListHeaderComponent={pending?<View style={{padding:12}}>{pendingVisible&&<Text>{pending.text}</Text>}<Text>{t(sending?'chat_pending':'chat_failed')}</Text>
    <Button disabled={sending} title={t('retry')} onPress={()=>{void send(true);}}/></View>:null}
   ListFooterComponent={before?<Button disabled={loading} title={t('chat_older')} onPress={()=>{void older();}}/>:null}
   renderItem={({item})=><View style={{padding:14,marginVertical:6,marginHorizontal:12,borderRadius:20,backgroundColor:item.senderId===account?theme.colors.ownMessage:theme.colors.surface,borderWidth:1,borderColor:theme.colors.border}}>
    <Text selectable>{item.text}</Text>{item.senderId!==account&&<SafetyActions conversationId={id} messageId={item.id}/>}<Text>{new Date(item.sentAt).toLocaleTimeString()}{item.senderId===account?' · '+t(BigInt(item.sequence)<=BigInt(peerRead)?'chat_read':'chat_sent'):''}</Text>
   </View>}/>
  <View style={{padding:12,gap:8}}>
   <TextInput testID="chat-message" accessibilityLabel={t('chat_message')} placeholder={t('chat_message')} multiline maxLength={2000} value={text}
    onChangeText={setText} editable={!pending&&!sending&&ready} style={{borderWidth:1,borderRadius:8,padding:12,maxHeight:140}}/>
   <Button testID="chat-send" variant="primary" title={t(sending?'working':'chat_send')} disabled={!ready||!!pending||sending||!text.trim()||notice==='chat_unavailable'} onPress={()=>{void send();}}/>
  </View>
 </KeyboardAvoidingView>;
}
