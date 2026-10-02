import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import type { PendingStore } from './model';
export function pendingStore(account:string,conversation:string,origin:string):PendingStore {
 const key='dating.chat.'+account+'.'+conversation;
 const options={keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
 const input=z.object({clientMessageId:z.uuid(),text:z.string().min(1).max(2000)});
 return {
  load:async()=>{
   const manifest=await SecureStore.getItemAsync(key,options);if(!manifest)return null;
   const {parts}=z.object({parts:z.number().int().min(1).max(32)}).parse(JSON.parse(manifest));
   let data='';for(let i=0;i<parts;i++){const part=await SecureStore.getItemAsync(key+'.'+i,options);if(part===null)throw new Error('storage_error');data+=part;}
   return z.object({origin:z.literal(origin),input}).parse(JSON.parse(data)).input;
  },
  save:async value=>{
   if(value===null) { await SecureStore.deleteItemAsync(key,options);for(let i=0;i<32;i++)await SecureStore.deleteItemAsync(key+'.'+i,options);return; }
   const data=Array.from(JSON.stringify({origin,input:value}));const parts=Math.ceil(data.length/400);
   if(parts>32)throw new Error('storage_error');
   for(let i=0;i<parts;i++)await SecureStore.setItemAsync(key+'.'+i,data.slice(i*400,(i+1)*400).join(''),options);
   // Commit manifest only after all small encrypted chunks exist; no plaintext message file.
   await SecureStore.setItemAsync(key,JSON.stringify({parts}),options);
  }
 };
}
