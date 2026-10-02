import { Link } from '../../src/components/UI';
import { Button, Text } from '../../src/components/UI';
import { SafetyActions } from "../../src/safety/SafetyActions";
import { useCallback, useMemo } from 'react';
import { FlatList, View } from 'react-native';
import { Card, StateMessage } from '../../src/components/UI';
import { useFocusEffect } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/auth/AuthProvider';
import { MatchApi } from '../../src/matching/api';
export default function Matches() {
 const { t } = useTranslation(); const { state,api: auth,manager } = useAuth();
 const api = useMemo(() => new MatchApi(auth,manager),[auth,manager,state.account?.id]);
 const matches = useInfiniteQuery({ queryKey: ['account',state.account?.id,'matches'], initialPageParam: null as string | null,
  queryFn: ({ pageParam }) => api.list(pageParam), getNextPageParam: page => page.nextCursor ?? undefined, retry: false, maxPages: 5 });
 const { refetch } = matches;
 useFocusEffect(useCallback(() => { void refetch(); },[refetch]));
 const items = [...new Map((matches.data?.pages.flatMap(page => page.items) ?? []).map(m=>[m.id,m])).values()];
 return <Screen title={t('matches')} scroll={false}>
  <FlatList data={matches.isError?[]:items} keyExtractor={m=>m.id} initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} contentContainerStyle={{paddingHorizontal:20,gap:14,paddingBottom:16}}
   refreshing={matches.isRefetching} onRefresh={()=>{void refetch();}}
   ListEmptyComponent={<StateMessage title={t(matches.isPending?'working':matches.isError?'connection_error':'matches_empty')} loading={matches.isPending} />}
   renderItem={({item:match})=><Card>
    <Text accessibilityRole="header">{match.displayName}, {match.age}</Text><Text>{match.city}</Text><Text>{match.lastMessage ?? t('match_confirmed')}</Text><Text>{t('chat_unread', { count: match.unreadCount })}</Text><Link href={{ pathname: '/chat/[id]',params: { id: match.conversationId } }}>{t('chat_open')}</Link><SafetyActions conversationId={match.conversationId}/>
   </Card>}
   ListFooterComponent={<View style={{gap:12}}>{matches.hasNextPage && <Button title={t('discovery_more')} disabled={matches.isFetchingNextPage} onPress={() => { void matches.fetchNextPage(); }} />}
  <Button title={t('retry')} disabled={matches.isFetching} onPress={() => { void refetch(); }} />
   </View>}/>
 </Screen>;
}
