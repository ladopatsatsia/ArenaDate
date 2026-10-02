import { safetyRevoked } from "../src/safety/api";
import { AppState } from 'react-native';
import '../src/i18n';
import { act,fireEvent,render,screen,waitFor } from '@testing-library/react-native';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import ChatRoute, { ChatScreen } from '../src/chat/ChatScreen';
import { useAuth } from '../src/auth/AuthProvider';
import type { Message } from '../src/chat/api';
jest.mock('../src/auth/AuthProvider');
jest.mock('expo-router',()=>({Link:require('react-native').Text,useFocusEffect:(fn:()=>void)=>require('react').useEffect(fn,[fn]),useLocalSearchParams:()=>({})}));
jest.mock('react-native-safe-area-context',()=>({SafeAreaView:require('react-native').View,useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
jest.mock('expo-crypto',()=>({randomUUID:()=> '73503d49-b7ee-41c5-832b-7223dca26105'}));
jest.mock('../src/chat/storage',()=>({pendingStore:()=>({load:async()=>null,save:async()=>{}})}));
jest.mock('../src/chat/live',()=>({signalRConnection:()=>({}),LiveChat:class{start(){} async stop(){}}}));

test('an invalid chat link provides a recovery route instead of a blank screen',()=>{
 jest.mocked(useAuth).mockReturnValue({state:{account:{id:'A'}}} as ReturnType<typeof useAuth>);
 render(<ChatRoute/>);expect(screen.getByText('This conversation is no longer available.')).toBeTruthy();expect(screen.getByText('Matches')).toBeTruthy();
});
test('composer keeps a lost response pending, retries the same ID and renders one literal text message',async()=>{
 AppState.currentState='active';
 const message:Message={id:'server-id',conversationId:'conversation',senderId:'A',clientMessageId:'73503d49-b7ee-41c5-832b-7223dca26105',sequence:'1',text:'<b>hello</b>',sentAt:'2026-10-01T00:00:00Z'};
 let sends=0;let saved=false;const bodies:unknown[]=[];
 const request=jest.fn(async(path:string,body?:unknown)=>{
  if(path.endsWith('/messages')&&body){bodies.push(body);sends++;saved=true;if(sends===1)throw new Error('lost');return message;}
  if(path.includes('/messages'))return {items:saved?[message]:[],nextBefore:null,nextAfter:null,readSequence:'0',peerReadSequence:'0'};
  return {};
 });
 const manager={snapshot:()=>({account:{id:'A'}}),withAccess:async(action:(token:string)=>Promise<unknown>)=>action('token')};
 jest.mocked(useAuth).mockReturnValue({api:{baseUrl:'https://api.test',request},manager,state:{status:'signedIn',account:{id:'A'}}} as unknown as ReturnType<typeof useAuth>);
 const cache=new QueryClient({defaultOptions:{queries:{retry:false}}});
 const view=render(<QueryClientProvider client={cache}><ChatScreen id="conversation" account="A"/></QueryClientProvider>);
 await waitFor(()=>expect(screen.getByText('No messages yet.')).toBeTruthy());
 fireEvent.changeText(screen.getByLabelText('Message'),'<b>hello</b>');fireEvent.press(screen.getByRole('button',{name:'Send'}));
 await waitFor(()=>expect(screen.getByText('Not confirmed. Retry the same message.')).toBeTruthy());
 fireEvent.press(screen.getByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(screen.getByText('Sent',{exact:false})).toBeTruthy());
 expect(bodies).toHaveLength(2);expect(bodies[0]).toEqual(bodies[1]);expect(screen.getAllByText('<b>hello</b>')).toHaveLength(1);
 view.unmount();cache.clear();
});

test('a later HTTP send response cannot advance the history cursor past an unseen peer message',async()=>{
 AppState.currentState='active';
 const first:Message={id:'first-id',conversationId:'conversation',senderId:'B',clientMessageId:'first-client',sequence:'1',text:'first',sentAt:'2026-10-01T00:00:00Z'};
 const missed:Message={...first,id:'missed-id',clientMessageId:'missed-client',sequence:'2',text:'during send'};
 const own:Message={...first,id:'own-id',senderId:'A',clientMessageId:'73503d49-b7ee-41c5-832b-7223dca26105',sequence:'3',text:'outgoing'};
 let committed=false;
 const request=jest.fn(async(path:string,body?:unknown)=>{
  if(path.endsWith('/messages')&&body){committed=true;return own;}
  if(path.includes('/messages'))return {items:committed?(path.endsWith('after=1')?[missed,own]:[]):[first],nextBefore:null,nextAfter:null,readSequence:'0',peerReadSequence:'0'};
  return {};
 });
 const manager={snapshot:()=>({account:{id:'A'}}),withAccess:async(action:(token:string)=>Promise<unknown>)=>action('token')};
 jest.mocked(useAuth).mockReturnValue({api:{baseUrl:'https://api.test',request},manager,state:{status:'signedIn',account:{id:'A'}}} as unknown as ReturnType<typeof useAuth>);
 const cache=new QueryClient();const view=render(<QueryClientProvider client={cache}><ChatScreen id="conversation" account="A"/></QueryClientProvider>);
 await waitFor(()=>expect(screen.getByText('first')).toBeTruthy());
 fireEvent.changeText(screen.getByLabelText('Message'),'outgoing');fireEvent.press(screen.getByRole('button',{name:'Send'}));
 await waitFor(()=>expect(screen.getByText('during send')).toBeTruthy());
 expect(request).toHaveBeenCalledWith('/api/conversations/conversation/messages?after=1',undefined,'token');
 expect(screen.getAllByText('outgoing')).toHaveLength(1);view.unmount();cache.clear();
});

test('revocation clears visible messages, draft and cached previews and rejects late history results',async()=>{
 AppState.currentState='active';
 const first:Message={id:'first',conversationId:'conversation',senderId:'B',clientMessageId:'peer-id',sequence:'1',text:'private old message',sentAt:'2026-10-01T00:00:00Z'};
 let calls=0;let release: (value:unknown)=>void=()=>{};
 const request=jest.fn(async(path:string)=>{
  if(path.includes('/messages')){calls++;if(calls>1)return new Promise(r=>{release=r;});return {items:[first],readSequence:'0',peerReadSequence:'0'};}
  return {};
 });
 const manager={snapshot:()=>({account:{id:'A'}}),withAccess:async(fn:(t:string)=>Promise<unknown>)=>fn('token')};
 jest.mocked(useAuth).mockReturnValue({api:{baseUrl:'https://api.test',request},manager,state:{account:{id:'A'}}} as unknown as ReturnType<typeof useAuth>);
 const cache=new QueryClient();cache.setQueryData(['account','A','matches'],['private preview']);
 const view=render(<QueryClientProvider client={cache}><ChatScreen id="conversation" account="A"/></QueryClientProvider>);
 await waitFor(()=>expect(screen.getByText('private old message')).toBeTruthy());
 fireEvent.changeText(screen.getByLabelText('Message'),'unsent private draft');
 fireEvent.press(screen.getByRole('button',{name:'Newest messages'}));
 await act(async()=>{safetyRevoked('A','conversation');});
 await act(async()=>{release({items:[{...first,text:'late private message'}],readSequence:'0',peerReadSequence:'0'});});
 expect(screen.queryByText('late private message')).toBeNull();expect(screen.queryByText('private old message')).toBeNull();
 expect(screen.getByLabelText('Message').props.value).toBe('');expect(screen.getByLabelText('Message').props.editable).toBe(false);
 expect(cache.getQueryData(['account','A','matches'])).toBeUndefined();
 view.unmount();cache.clear();
});
