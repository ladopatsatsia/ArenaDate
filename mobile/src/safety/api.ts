import type { components } from "@dating/api-contract";
import { AuthApi,ApiError } from '../auth/api';
import { SessionManager } from '../auth/session';
export type SafetyInput = components["schemas"]["SafetyRequest"] & {action:"block"|"unblock"|"unmatch"|"report"};
export type SafetyPage = components["schemas"]["SafetyPage"];
export class SafetyApi {
 private readonly account:string|undefined;
 constructor(private readonly api:AuthApi,private readonly session:SessionManager){this.account=session.snapshot().account?.id;}
 private run<T>(fn:(token:string)=>Promise<T>){
  if(!this.account||this.session.snapshot().account?.id!==this.account)return Promise.reject(new ApiError(401));
  return this.session.withAccess(fn);
 }
 execute=(input:SafetyInput)=>this.run(t=>this.api.request<void>('/api/safety',input,t));
 list=(kind:'blocks'|'prior-conversations',cursor?:string|null)=>this.run(t=>this.api.request<SafetyPage>(`/api/safety/${kind}${cursor?'?cursor='+cursor:''}`,undefined,t));
}
type Listener=(conversation:string)=>void;
const listeners=new Map<string,Set<Listener>>();
export function safetySubscribe(account:string,listener:Listener){
 const set=listeners.get(account)??new Set<Listener>();set.add(listener);listeners.set(account,set);
 return()=>{set.delete(listener);if(!set.size)listeners.delete(account);};
}
export function safetyRevoked(account:string,conversation:string){listeners.get(account)?.forEach(fn=>fn(conversation));}
