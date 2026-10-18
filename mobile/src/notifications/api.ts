import type {components} from '@dating/api-contract';
import {AuthApi,ApiError} from '../auth/api';
import {SessionManager} from '../auth/session';
export type Preferences=components['schemas']['PushPreferences'];
export type Configuration=components['schemas']['PushConfiguration'];
export type DeviceInput=components['schemas']['DeviceRequest'];
export interface TelegramSubscriberStatus {
  isLinked: boolean;
  isActive: boolean;
  username?: string | null;
  firstName?: string | null;
  telegramUserId?: number | null;
  botUsername: string;
}

export interface TelegramToggleRequest {
  isActive: boolean;
}

export interface TelegramLinkRequest {
  telegramUserId: number;
  chatId?: number | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export class PushApi{
 private readonly account:string|undefined;
 constructor(private readonly api:AuthApi,private readonly session:SessionManager){this.account=session.snapshot().account?.id;}
 private run<T>(action:(token:string)=>Promise<T>){
  if(!this.account||this.session.snapshot().account?.id!==this.account)return Promise.reject(new ApiError(401));
  return this.session.withAccess(action);
 }
 configuration=()=>this.run(t=>this.api.request<Configuration>('/api/notifications/configuration',undefined,t));
 preferences=()=>this.run(t=>this.api.request<Preferences>('/api/notifications/preferences',undefined,t));
 save=(value:Preferences)=>this.run(t=>this.api.request<void>('/api/notifications/preferences',value,t));
 device=(value:DeviceInput)=>this.run(t=>this.api.request<void>('/api/notifications/device',value,t));
 resolve=(notificationId:string)=>this.run(t=>this.api.request<components['schemas']['NotificationTarget']>('/api/notifications/resolve',{notificationId},t));
 telegramStatus=()=>this.run(t=>this.api.request<TelegramSubscriberStatus>('/api/notifications/telegram',undefined,t));
 telegramToggle=(isActive:boolean)=>this.run(t=>this.api.request<{success:boolean;isActive:boolean}>('/api/notifications/telegram/toggle',{isActive},t));
 telegramTest=()=>this.run(t=>this.api.request<{success:boolean;message:string}>('/api/notifications/telegram/test',{},t));
 telegramLink=(data:TelegramLinkRequest)=>this.run(t=>this.api.request<{success:boolean}>('/api/notifications/telegram/link',data,t));
}
