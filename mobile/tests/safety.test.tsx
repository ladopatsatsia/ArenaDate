import {Text} from "react-native";
import '../src/i18n';
import {fireEvent,render,screen,waitFor} from '@testing-library/react-native';
import {useQuery,QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {SafetyActions} from '../src/safety/SafetyActions';
import {SafetyApi,safetyRevoked,safetySubscribe} from '../src/safety/api';
import {useAuth} from '../src/auth/AuthProvider';
import type {AuthApi} from '../src/auth/api';
import type {SessionManager} from '../src/auth/session';
jest.mock('../src/auth/AuthProvider');
jest.mock('expo-crypto',()=>({randomUUID:()=> 'same-request'}));
jest.mock('../src/chat/storage',()=>({pendingStore:()=>({save:async()=>{}})}));
test('report and block requires explicit confirmation and ambiguous retry preserves payload and ID',async()=>{
 const request=jest.fn().mockRejectedValueOnce(new Error('lost response')).mockResolvedValue(undefined);
 const manager={snapshot:()=>({account:{id:'A'}}),withAccess:async(fn:(t:string)=>Promise<unknown>)=>fn('token')};
 jest.mocked(useAuth).mockReturnValue({api:{baseUrl:'https://api.test',request},manager,state:{account:{id:'A'}}} as unknown as ReturnType<typeof useAuth>);
 const cache=new QueryClient();cache.setQueryData(['account','A','matches'],['private preview']);
 const cleared=jest.fn();const unsubscribe=safetySubscribe('A',cleared);
 const view=render(<QueryClientProvider client={cache}><SafetyActions conversationId="conversation"/></QueryClientProvider>);
 fireEvent.press(screen.getByRole('button',{name:'Report / block'}));
 fireEvent.press(screen.getByRole('button',{name:'Block'}));fireEvent.press(screen.getByRole('button',{name:'Also send a report'}));
 expect(request).not.toHaveBeenCalled();
 fireEvent.changeText(screen.getByLabelText('Description (up to 1,000 characters)'),'evidence description');
 fireEvent.press(screen.getByRole('button',{name:'Confirm'}));
 await waitFor(()=>expect(screen.getByText('Outcome unknown. Retry submits the same request.')).toBeTruthy());
 fireEvent.press(screen.getByRole('button',{name:'Retry'}));
 await waitFor(()=>expect(screen.getByText('Saved')).toBeTruthy());
 expect(request).toHaveBeenCalledTimes(2);expect(request.mock.calls[0]).toEqual(request.mock.calls[1]);
 expect(request.mock.calls[0]?.[1]).toMatchObject({action:'block',report:{kind:'profile',description:'evidence description'}});
 expect(cleared).toHaveBeenCalledWith('conversation');expect(cache.getQueryData(['account','A','matches'])).toBeUndefined();
 unsubscribe();view.unmount();cache.clear();
});
test('old account safety handlers cannot mutate a newly signed in account; revocation is account scoped',async()=>{
 let account='A';const request=jest.fn();const manager={snapshot:()=>({account:{id:account}}),withAccess:async(fn:(t:string)=>Promise<unknown>)=>fn('token')};
 const api=new SafetyApi({request} as unknown as AuthApi,manager as unknown as SessionManager);account='B';
 await expect(api.execute({requestId:'id',action:'block',targetId:'peer'})).rejects.toMatchObject({status:401});expect(request).not.toHaveBeenCalled();
 const a=jest.fn(),b=jest.fn();const offA=safetySubscribe('A',a),offB=safetySubscribe('B',b);safetyRevoked('A','conversation');
 expect(a).toHaveBeenCalledWith('conversation');expect(b).not.toHaveBeenCalled();offA();offB();
});

test('confirmed block clears an actively observed match preview and refetches authorized rows',async()=>{
 let blocked=false;
 const request=jest.fn(async()=>{blocked=true;});
 const manager={snapshot:()=>({account:{id:'A'}}),withAccess:async(fn:(t:string)=>Promise<unknown>)=>fn('token')};
 jest.mocked(useAuth).mockReturnValue({api:{baseUrl:'https://api.test',request},manager,state:{account:{id:'A'}}} as unknown as ReturnType<typeof useAuth>);
 function Preview(){const q=useQuery({queryKey:['account','A','matches'],queryFn:async()=>blocked?[]:['private preview']});return <Text>{q.data?.join('')}</Text>;}
 const cache=new QueryClient();const view=render(<QueryClientProvider client={cache}><Preview/><SafetyActions conversationId="conversation"/></QueryClientProvider>);
 await waitFor(()=>expect(screen.getByText('private preview')).toBeTruthy());
 fireEvent.press(screen.getByRole('button',{name:'Report / block'}));fireEvent.press(screen.getByRole('button',{name:'Block'}));fireEvent.press(screen.getByRole('button',{name:'Confirm'}));
 await waitFor(()=>expect(screen.getByText('Saved')).toBeTruthy());expect(screen.queryByText('private preview')).toBeNull();expect(cache.getQueryData(['account','A','matches'])).toEqual([]);
 view.unmount();cache.clear();
});
