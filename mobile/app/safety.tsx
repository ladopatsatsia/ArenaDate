import { Button, Text } from '../src/components/UI';
import {useMemo,useState} from 'react';
import { FlatList, View } from 'react-native';
import { Card, StateMessage } from '../src/components/UI';
import {useInfiniteQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {useAuth} from '../src/auth/AuthProvider';
import {Screen} from '../src/components/Screen';
import {SafetyApi} from '../src/safety/api';
import {SafetyActions} from '../src/safety/SafetyActions';
function Items({kind}:{kind:'blocks'|'prior-conversations'}){
 const {api:auth,manager,state}=useAuth();const {t}=useTranslation();const api=useMemo(()=>new SafetyApi(auth,manager),[auth,manager,state.account?.id]);
 const query=useInfiniteQuery({queryKey:['account',state.account?.id,'safety',kind],initialPageParam:null as string|null,queryFn:({pageParam})=>api.list(kind,pageParam),getNextPageParam:p=>p.nextCursor??undefined,retry:false,maxPages:5});
 const items=[...new Map((query.data?.pages.flatMap(p=>p.items)??[]).map(item=>[item.id,item])).values()];
 return <FlatList data={query.isError?[]:items} keyExtractor={item=>item.id} windowSize={5} initialNumToRender={8} contentContainerStyle={{padding:20,gap:14}}
  refreshing={query.isRefetching} onRefresh={()=>{void query.refetch();}}
  ListEmptyComponent={<StateMessage title={t(query.isPending?'working':query.isError?'connection_error':'safety_empty_'+kind)} loading={query.isPending}/>}
  renderItem={({item})=><Card>
   <Text>{t(kind==='blocks'?'safety_blocked_account':'safety_prior')}{' #'+item.id.slice(0,8)}{item.createdAt?' · '+new Date(item.createdAt).toLocaleDateString():''}</Text>
   <SafetyActions targetId={kind==='blocks'?item.id:undefined} conversationId={kind==='prior-conversations'?item.id:undefined} unblock={kind==='blocks'} closed/>
  </Card>}
  ListFooterComponent={<View style={{gap:12}}>{query.hasNextPage&&<Button disabled={query.isFetchingNextPage} title={t('discovery_more')} onPress={()=>{void query.fetchNextPage();}}/>}
  <Button disabled={query.isFetching} title={t('retry')} onPress={()=>{void query.refetch();}}/>
 </View>}/>;
}
export default function SafetyCenter(){const {t}=useTranslation();const [kind,setKind]=useState<'blocks'|'prior-conversations'>('blocks');return <Screen title={t('safety_center')} scroll={false}><View style={{paddingHorizontal:20,gap:8}}>{(['blocks','prior-conversations'] as const).map(value=><Button key={value} selected={kind===value} title={t('safety_'+value)} onPress={()=>setKind(value)}/>)}</View><Items key={kind} kind={kind}/></Screen>;}
