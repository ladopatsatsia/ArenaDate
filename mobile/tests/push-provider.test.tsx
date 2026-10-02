import {registerInstallation} from "../src/notifications/native";
import '../src/i18n';
import {Text} from 'react-native';
import {act,render,screen,waitFor} from '@testing-library/react-native';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import {PushProvider,usePush} from '../src/notifications/PushProvider';
import {useAuth} from '../src/auth/AuthProvider';
const notification='59d15e99-f1f5-469e-8122-0637b56ead44',conversation='2aed1543-45f7-4ed5-a104-2e029fa54d11';
const mockPush=jest.fn();let mockResponse:(value:unknown)=>void=()=>{};
jest.mock('../src/auth/AuthProvider');
jest.mock('../src/notifications/native',()=>({registerInstallation:jest.fn()}));
jest.mock('expo-router',()=>({useRouter:()=>({push:mockPush}),useRootNavigationState:()=>({key:'root'})}));
jest.mock('expo-notifications',()=>({
 setNotificationHandler:jest.fn(),addPushTokenListener:()=>({remove:jest.fn()}),addNotificationReceivedListener:()=>({remove:jest.fn()}),
 addNotificationResponseReceivedListener:(fn:(value:unknown)=>void)=>{mockResponse=fn;return{remove:jest.fn()};},
 getLastNotificationResponseAsync:jest.fn(),clearLastNotificationResponseAsync:jest.fn(async()=>{}),
}));
function Probe(){return <Text>{usePush().notice}</Text>;}
test('cold-start tap waits for authentication, fetches authorized target and deduplicates background response',async()=>{
 mockPush.mockClear();const response={notification:{request:{content:{data:{notificationId:notification,version:1}}}}};
 jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(response as unknown as Notifications.NotificationResponse);
 let account:string|null=null;
 const request=jest.fn(async(path:string)=>path.endsWith('configuration')?{enabled:false,projectId:null}:path.endsWith('preferences')?{matches:false,messages:false}:{conversationId:conversation});
 const manager={snapshot:()=>({account:account?{id:account}:null}),withAccess:async(fn:(t:string)=>Promise<unknown>)=>fn('token')};
 const auth={baseUrl:'https://api.test',request};
 const update=()=>jest.mocked(useAuth).mockReturnValue({api:auth,manager,state:{status:account?'signedIn':'signedOut',account:account?{id:account}:null}} as unknown as ReturnType<typeof useAuth>);
 update();const cache=new QueryClient();const tree=()=> <QueryClientProvider client={cache}><PushProvider><Probe/></PushProvider></QueryClientProvider>;
 const view=render(tree());await act(async()=>{});expect(mockPush).not.toHaveBeenCalled();expect(request).not.toHaveBeenCalled();
 account='A';update();view.rerender(tree());await waitFor(()=>expect(mockPush).toHaveBeenCalledTimes(1));
 expect(request).toHaveBeenCalledWith('/api/notifications/resolve',{notificationId:notification},'token');
 expect(mockPush).toHaveBeenCalledWith({pathname:'/chat/[id]',params:{id:conversation}});
 await act(async()=>{mockResponse(response);});expect(mockPush).toHaveBeenCalledTimes(1);
 expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled();view.unmount();cache.clear();
});
test('malicious tap data never navigates or triggers target lookup',async()=>{
 mockPush.mockClear();jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(null);
 const request=jest.fn(async(path:string)=>path.endsWith('configuration')?{enabled:false,projectId:null}:{matches:false,messages:false});
 const manager={snapshot:()=>({account:{id:'A'}}),withAccess:async(fn:(t:string)=>Promise<unknown>)=>fn('token')};
 jest.mocked(useAuth).mockReturnValue({api:{baseUrl:'https://api.test',request},manager,state:{account:{id:'A'}}} as unknown as ReturnType<typeof useAuth>);
 const cache=new QueryClient();const view=render(<QueryClientProvider client={cache}><PushProvider><Probe/></PushProvider></QueryClientProvider>);
 await waitFor(()=>expect(request).toHaveBeenCalledTimes(2));
 await act(async()=>{mockResponse({notification:{request:{content:{data:{url:'/chat/private',notificationId:notification,version:1}}}}});});
 expect(mockPush).not.toHaveBeenCalled();expect(request).toHaveBeenCalledTimes(2);expect(screen.queryByText('push_failed')).toBeNull();view.unmount();cache.clear();
});

test('background registration refresh cannot race and undo an explicit preference enable',async()=>{
 jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(null);
 let release:()=>void=()=>{};const events:string[]=[];
 jest.mocked(registerInstallation).mockImplementationOnce(async()=>{events.push('refresh');await new Promise<void>(r=>{release=r;});}).mockImplementation(async()=>{events.push('enable');});
 const request=jest.fn(async(path:string,body?:unknown)=>{
  if(path.endsWith('configuration'))return{enabled:true,projectId:notification};
  if(path.endsWith('preferences')&&body){events.push('saved');return undefined;}
  return{matches:false,messages:false};
 });
 const manager={snapshot:()=>({account:{id:'A'}}),withAccess:async(fn:(t:string)=>Promise<unknown>)=>fn('token')};
 jest.mocked(useAuth).mockReturnValue({api:{baseUrl:'https://api.test',request},manager,state:{account:{id:'A'}}} as unknown as ReturnType<typeof useAuth>);
 let actions:ReturnType<typeof usePush>|null=null;function Controls(){actions=usePush();return <Text>{actions.notice}</Text>;}
 const cache=new QueryClient();const view=render(<QueryClientProvider client={cache}><PushProvider><Controls/></PushProvider></QueryClientProvider>);
 await waitFor(()=>expect(events).toEqual(['refresh']));
 let saving:Promise<void>|undefined;
 await act(async()=>{saving=actions!.save({matches:true,messages:true});});
 expect(events).toEqual(['refresh']);
 await act(async()=>{release();await saving;});
 expect(events).toEqual(['refresh','enable','saved']);expect(screen.getByText('push_saved')).toBeTruthy();
 view.unmount();cache.clear();
});
