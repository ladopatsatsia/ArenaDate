import {z} from 'zod';
const payload=z.object({notificationId:z.uuid(),version:z.literal(1)}).strict();
export function notificationId(data:unknown):string|null{const result=payload.safeParse(data);return result.success?result.data.notificationId:null;}
const installation=z.object({origin:z.string(),id:z.uuid(),secret:z.string().regex(/^[0-9a-f]{64}$/),revision:z.number().int().positive().max(2147483646)});
export interface InstallationStorage{get():Promise<string|null>;set(value:string):Promise<void>}
export class InstallationJournal{
 private flight:Promise<unknown>=Promise.resolve();
 constructor(private readonly store:InstallationStorage,private readonly uuid:()=>string,private readonly secret:()=>Promise<string>){}
 next(origin:string){
  const work=this.flight.catch(()=>undefined).then(async()=>{
   const raw=await this.store.get();const old=raw?installation.parse(JSON.parse(raw)):null;
   const value=old?.origin===origin?{...old,revision:old.revision+1}:{origin,id:this.uuid(),secret:await this.secret(),revision:1};
   installation.parse(value);await this.store.set(JSON.stringify(value));return value;
  });this.flight=work;return work;
 }
}
export async function authorizedNotification(data:unknown,resolve:(id:string)=>Promise<{conversationId:string}>,current:()=>boolean):Promise<string|null>{
 const id=notificationId(data);if(!id||!current())return null;
 const target=await resolve(id);return current()&&z.uuid().safeParse(target.conversationId).success?target.conversationId:null;
}
