import { MessageSender,mergeMessages,type PendingStore } from '../src/chat/model';
import type { Message,SendInput } from '../src/chat/api';
const message=(sequence:string,id=sequence):Message=>({id,conversationId:'conversation',senderId:'sender',clientMessageId:'request',sequence,text:'hello',sentAt:'2026-10-01T00:00:00Z'});
test('lost response persists intent across restart and retries the same message ID without replacing text',async()=>{
 let saved:SendInput|null=null;const store:PendingStore={load:async()=>saved,save:async value=>{saved=value;}};
 const send=jest.fn().mockRejectedValueOnce(new Error('lost response')).mockResolvedValue(message('1'));
 const first=new MessageSender(send,store,()=> 'request');await first.restore();
 await expect(first.submit('hello')).rejects.toThrow('lost response');expect(saved).toEqual({clientMessageId:'request',text:'hello'});
 const restored=new MessageSender(send,store,()=> 'another');await restored.restore();
 await expect(restored.submit('changed')).rejects.toThrow('message_pending');
 expect(await restored.submit()).toEqual(message('1'));expect(send).toHaveBeenNthCalledWith(2,{clientMessageId:'request',text:'hello'});expect(saved).toBeNull();
});
test('storage must succeed before send; repeat taps cannot create competing pending messages',async()=>{
 const store:PendingStore={load:async()=>null,save:jest.fn().mockRejectedValueOnce(new Error('storage')).mockResolvedValue(undefined)};
 const send=jest.fn(async()=>message('1'));const sender=new MessageSender(send,store,()=> 'request');await sender.restore();
 await expect(sender.submit('hello')).rejects.toThrow('storage');expect(send).not.toHaveBeenCalled();
 const changed=jest.fn();const first=sender.submit('hello',changed);
 await expect(sender.submit('again')).rejects.toThrow('message_pending');await first;
 expect(changed).toHaveBeenCalledWith({clientMessageId:'request',text:'hello'});expect(send).toHaveBeenCalledTimes(1);
});
test('HTTP and hint history races merge one stable ID and sort by exact server sequence, not timestamps',()=>{
 const a=message('9007199254740993','a');const b=message('9007199254740994','b');
 expect(mergeMessages([b],[a,b])).toEqual([a,b]);
});
test('history window is bounded while older pagination retains the requested end',()=>{
 const values=Array.from({length:600},(_,i)=>message(String(i+1)));
 expect(mergeMessages([],values)).toHaveLength(500);expect(mergeMessages([],values)[0]?.sequence).toBe('101');
 expect(mergeMessages([],values,true).at(-1)?.sequence).toBe('500');
});
test('a mismatched response never clears an ambiguous message',async()=>{
 const store:PendingStore={load:async()=>null,save:async()=>{}};const sender=new MessageSender(async()=>({...message('1'),clientMessageId:'other'}),store,()=> 'request');
 await sender.restore();await expect(sender.submit('hello')).rejects.toThrow('invalid_message_response');expect(sender.pending).not.toBeNull();
});

test('revocation during a storage write deletes the intent and cannot send or restore it',async()=>{
 let saved:SendInput|null=null;let release=()=>{};let began=()=>{};
 const started=new Promise<void>(r=>{began=r;});
 const store:PendingStore={load:async()=>saved,save:async value=>{if(value){began();await new Promise<void>(r=>{release=r;});}saved=value;}};
 const send=jest.fn(async()=>message('1'));const sender=new MessageSender(send,store,()=> 'request');
 const submitting=sender.submit('hello');const rejected=expect(submitting).rejects.toThrow('conversation_unavailable');
 await started;const revoked=sender.revoke();release();await rejected;await revoked;
 expect(saved).toBeNull();expect(sender.pending).toBeNull();expect(send).not.toHaveBeenCalled();
 await expect(sender.submit('later')).rejects.toThrow('conversation_unavailable');
});
test('revocation while HTTP send is in flight ignores late response and keeps storage empty',async()=>{
 let release: (value:Message)=>void=()=>{};const send=jest.fn(()=>new Promise<Message>(r=>{release=r;}));
 let saved:SendInput|null=null;const sender=new MessageSender(send,{load:async()=>saved,save:async v=>{saved=v;}},()=> 'request');
 const submitting=sender.submit('hello');const rejected=expect(submitting).rejects.toThrow('conversation_unavailable');
 for(let i=0;i<10;i++)await Promise.resolve();expect(send).toHaveBeenCalledTimes(1);
 await sender.revoke();release(message('1'));await rejected;expect(saved).toBeNull();expect(sender.pending).toBeNull();
});
