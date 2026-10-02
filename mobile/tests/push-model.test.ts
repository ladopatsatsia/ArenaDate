import {InstallationJournal,authorizedNotification,notificationId} from '../src/notifications/model';
import {PushApi} from '../src/notifications/api';
import type {AuthApi} from '../src/auth/api';
import type {SessionManager} from '../src/auth/session';
const id='59d15e99-f1f5-469e-8122-0637b56ead44';
test('untrusted payload URLs, extra fields and malformed IDs cannot select a route',async()=>{
 const resolve=jest.fn(async()=>({conversationId:id}));
 for(const data of [{url:'https://evil.test'}, {notificationId:'../../profile',version:1},{notificationId:id,version:1,url:'/admin'},{notificationId:id,version:2},null]){
  expect(notificationId(data)).toBeNull();expect(await authorizedNotification(data,resolve,()=>true)).toBeNull();
 }
 expect(resolve).not.toHaveBeenCalled();
 expect(await authorizedNotification({notificationId:id,version:1},resolve,()=>true)).toBe(id);
});
test('late authorization result cannot navigate after account switching',async()=>{
 let current=true;let release:(value:{conversationId:string})=>void=()=>{};
 const result=authorizedNotification({notificationId:id,version:1},()=>new Promise(r=>{release=r;}),()=>current);
 current=false;release({conversationId:id});expect(await result).toBeNull();
});
test('installation revisions serialize and proof survives restart while origins remain separate',async()=>{
 let saved:string|null=null;const store={get:async()=>saved,set:async(v:string)=>{saved=v;}};
 const journal=new InstallationJournal(store,()=>id,async()=> 'a'.repeat(64));
 const values=await Promise.all([journal.next('https://a.test'),journal.next('https://a.test')]);
 expect(values.map(v=>v.revision)).toEqual([1,2]);expect(values[0]?.secret).toBe(values[1]?.secret);
 const restarted=new InstallationJournal(store,()=>id,async()=> 'b'.repeat(64));
 expect((await restarted.next('https://a.test')).revision).toBe(3);
 expect((await restarted.next('https://b.test')).secret).toBe('b'.repeat(64));
});
test('installation storage failure prevents returning an unpersisted identity',async()=>{
 const journal=new InstallationJournal({get:async()=>null,set:async()=>{throw new Error('keychain');}},()=>id,async()=> 'a'.repeat(64));
 await expect(journal.next('https://a.test')).rejects.toThrow('keychain');
});
test('old-account push API cannot register a token or resolve targets for the new account',async()=>{
 let account='A';const request=jest.fn();const session={snapshot:()=>({account:{id:account}}),withAccess:async(fn:(t:string)=>Promise<unknown>)=>fn('token')};
 const api=new PushApi({request} as unknown as AuthApi,session as unknown as SessionManager);account='B';
 await expect(api.resolve(id)).rejects.toMatchObject({status:401});await expect(api.preferences()).rejects.toMatchObject({status:401});expect(request).not.toHaveBeenCalled();
});
