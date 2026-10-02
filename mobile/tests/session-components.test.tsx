import '../src/i18n';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { Button, Text } from '../src/components/UI';
import type { Tokens } from '../src/auth/api';
const mockApi={baseUrl:'https://api.test',login:jest.fn(),refresh:jest.fn(),logout:jest.fn(),logoutAll:jest.fn(),request:jest.fn()};
jest.mock('../src/auth/api',()=>({...jest.requireActual('../src/auth/api'),AuthApi:jest.fn(()=>mockApi)}));
jest.mock('expo-secure-store',()=>({WHEN_UNLOCKED_THIS_DEVICE_ONLY:1,getItemAsync:async()=>null,setItemAsync:async()=>{},deleteItemAsync:async()=>{}}));
jest.mock('expo-crypto',()=>({randomUUID:()=> 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}));
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const tokens=(id:string,expired=false):Tokens=>({account:{id},accessToken:'access-'+id,refreshToken:'refresh-'+id,accessExpiresAt:new Date(Date.now()+(expired?-60000:300000)).toISOString(),sessionExpiresAt:new Date(Date.now()+86400000).toISOString()});
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
let cacheReader:()=>unknown=()=>undefined;
function Probe(){
 const {manager,state}=useAuth();const cache=useQueryClient();cacheReader=()=>cache.getQueryData(['account',A,'private']);
 const data=useQuery({queryKey:['account',state.account?.id,'private'],queryFn:()=>manager.withAccess(token=>mockApi.request(token)),enabled:state.status==='signedIn',retry:false});
 return <><Text>{state.account?.id??state.status}</Text><Text>{data.data as string??''}</Text>
  <Button title="Sign in A" onPress={()=>{void manager.signIn({email:'a@test.test',password:'password'});}}/>
  <Button title="Sign in B" onPress={()=>{void manager.signIn({email:'b@test.test',password:'password'});}}/>
  <Button title="Concurrent read" onPress={()=>{void manager.withAccess(t=>mockApi.request(t)).catch(()=>undefined);}}/>
 </>;
}
beforeEach(()=>{jest.clearAllMocks();});
test('mounted account consumers share one token refresh while another read is in flight',async()=>{
 const refresh=deferred<Tokens>();mockApi.login.mockResolvedValue(tokens(A,true));mockApi.refresh.mockReturnValue(refresh.promise);mockApi.request.mockResolvedValue('fresh data');
 const view=render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(screen.getByText('signedOut')).toBeTruthy());
 fireEvent.press(screen.getByRole('button',{name:'Sign in A'}));await waitFor(()=>expect(mockApi.refresh).toHaveBeenCalledTimes(1));
 fireEvent.press(screen.getByRole('button',{name:'Concurrent read'}));fireEvent.press(screen.getByRole('button',{name:'Concurrent read'}));
 expect(mockApi.refresh).toHaveBeenCalledTimes(1);await act(async()=>refresh.resolve(tokens(A)));
 await waitFor(()=>expect(screen.getByText('fresh data')).toBeTruthy());expect(mockApi.refresh).toHaveBeenCalledTimes(1);expect(mockApi.request).toHaveBeenCalledTimes(3);view.unmount();
});
test('account switching removes cached content and an old HTTP response cannot paint the new account',async()=>{
 const old=deferred<string>();mockApi.login.mockImplementation(async(v:{email:string})=>tokens(v.email.startsWith('a')?A:B));
 mockApi.request.mockImplementation(async(token:string)=>token.endsWith(A)?old.promise:'B private');
 const view=render(<AuthProvider><Probe/></AuthProvider>);await waitFor(()=>expect(screen.getByText('signedOut')).toBeTruthy());
 fireEvent.press(screen.getByRole('button',{name:'Sign in A'}));await waitFor(()=>expect(mockApi.request).toHaveBeenCalledWith('access-'+A));
 fireEvent.press(screen.getByRole('button',{name:'Sign in B'}));await waitFor(()=>expect(screen.getByText('B private')).toBeTruthy());
 await act(async()=>old.resolve('A private late response'));expect(screen.queryByText('A private late response')).toBeNull();expect(cacheReader()).toBeUndefined();expect(screen.getByText(B)).toBeTruthy();view.unmount();
});
