import type { Message,SendInput } from './api';
export function mergeMessages(existing:Message[],incoming:Message[],older=false):Message[] {
 const byId=new Map(existing.map(m=>[m.id,m]));for(const m of incoming)byId.set(m.id,m);
 const ordered=[...byId.values()].sort((a,b)=>BigInt(a.sequence)<BigInt(b.sequence)?-1:1);
 return older?ordered.slice(0,500):ordered.slice(-500);
}
export interface PendingStore { load():Promise<SendInput|null>; save(value:SendInput|null):Promise<void> }
export class MessageSender {
 pending:SendInput|null=null; private busy=false;private revoked=false;private writes:Promise<void>=Promise.resolve();
 private save(value:SendInput|null){this.writes=this.writes.catch(()=>undefined).then(()=>this.store.save(this.revoked?null:value));return this.writes;}
 async revoke(){this.revoked=true;this.pending=null;await this.save(null);}
 constructor(private readonly send:(input:SendInput)=>Promise<Message>,private readonly store:PendingStore,private readonly uuid:()=>string) {}
 async restore() { const value=await this.store.load();if(!this.revoked)this.pending=value; }
 async submit(text?:string,pendingChanged?:(input:SendInput)=>void) {
  if(this.revoked)throw new Error('conversation_unavailable');if(this.busy)throw new Error('message_pending');this.busy=true;
  try {
   if(!this.pending) {
    if(!text?.trim() || text.length>2000)throw new Error('invalid_message');
    const value={clientMessageId:this.uuid(),text};await this.save(value);if(this.revoked)throw new Error('conversation_unavailable');this.pending=value;
   } else if(text!==undefined) throw new Error('message_pending');
   pendingChanged?.(this.pending);
   const result=await this.send(this.pending);
   if(this.revoked)throw new Error('conversation_unavailable');
   if(result.clientMessageId!==this.pending.clientMessageId || result.text!==this.pending.text)throw new Error('invalid_message_response');
   await this.save(null);this.pending=null;return result;
  } finally { this.busy=false; }
 }
}
