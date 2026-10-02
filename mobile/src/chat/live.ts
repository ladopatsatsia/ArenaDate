import { HubConnectionBuilder,HttpTransportType,LogLevel } from '@microsoft/signalr';
export interface LiveConnection { start():Promise<void>; stop():Promise<void>; subscribe():Promise<void>; onHint(fn:()=>void):void; onClose(fn:()=>void):void; onRevoked?(fn:()=>void):void }
export function signalRConnection(base:string,conversation:string,token:()=>Promise<string>):LiveConnection {
 const hub=new HubConnectionBuilder().withUrl(base.replace(/\/$/,'')+'/hubs/chat',{
  accessTokenFactory:token,transport:HttpTransportType.LongPolling,withCredentials:false,
 }).configureLogging(LogLevel.None).build();
 return {start:()=>hub.start(),stop:()=>hub.stop(),subscribe:()=>hub.invoke('Subscribe',conversation),
  onRevoked:fn=>hub.on('ConversationUnavailable',(id:string)=>{if(id===conversation)fn();}),
  onHint:fn=>hub.on('ConversationChanged',(id:string)=>{if(id===conversation)fn();}),onClose:fn=>hub.onclose(fn)};
}
export class LiveChat {
 private active=false;private epoch=0;private retry=0;private timer:ReturnType<typeof setTimeout>|undefined;
 private connection:LiveConnection|undefined;
 constructor(private readonly factory:()=>LiveConnection,private readonly catchup:()=>Promise<void>,private readonly status:(online:boolean)=>void,private readonly revoked:()=>void=()=>undefined) {}
 start() { if(this.active)return;this.active=true;this.retry=0;void this.connect(++this.epoch); }
 async stop() {
  this.active=false;this.epoch++;clearTimeout(this.timer);this.timer=undefined;
  const connection=this.connection;this.connection=undefined;await connection?.stop();
 }
 private schedule(epoch:number) {
  if(this.timer || !this.active || epoch!==this.epoch)return;
  const delay=Math.min(30000,1000*2**Math.min(this.retry++,5));
  this.timer=setTimeout(()=>{this.timer=undefined;void this.connect(epoch);},delay);
 }
 private async connect(epoch:number) {
  if(!this.active||epoch!==this.epoch)return;
  const connection=this.factory();this.connection=connection;
  const current=()=>this.active&&epoch===this.epoch&&this.connection===connection;
  connection.onRevoked?.(()=>{if(current()){this.revoked();void this.stop();}});
  connection.onHint(()=>{if(current())void this.catchup().catch(()=>this.status(false));});
  connection.onClose(()=>{if(current()){this.status(false);this.schedule(epoch);}});
  try {
   await connection.start();if(!current()){await connection.stop();return;}
   await connection.subscribe();await this.catchup();
   if(current()){this.retry=0;this.status(true);}
  } catch {
   await connection.stop().catch(()=>undefined);
   if(current()){this.status(false);this.schedule(epoch);}
  }
 }
}
