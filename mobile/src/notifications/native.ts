import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Constants,{ExecutionEnvironment} from 'expo-constants';
import {Platform} from 'react-native';
import {InstallationJournal} from './model';
import type {PushApi,Configuration} from './api';
const storageOptions={keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
const journal=new InstallationJournal({
 get:()=>SecureStore.getItemAsync('dating.push-installation',storageOptions),
 set:value=>SecureStore.setItemAsync('dating.push-installation',value,storageOptions),
},Crypto.randomUUID,async()=>Array.from(await Crypto.getRandomBytesAsync(32),b=>b.toString(16).padStart(2,'0')).join(''));
export async function registerInstallation(api:PushApi,origin:string,config:Configuration,ask:boolean,desired=true){
 if(!config.enabled||!config.projectId)throw new Error('push_not_configured');
 if(!Device.isDevice||Constants.executionEnvironment===ExecutionEnvironment.StoreClient)throw new Error('push_development_build');
 const projectId=Constants.expoConfig?.extra?.eas?.projectId??Constants.easConfig?.projectId;
 if(projectId!==config.projectId)throw new Error('push_project_mismatch');
 if(Platform.OS!=='ios'&&Platform.OS!=='android')throw new Error('push_development_build');
 if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('activity',{name:'Activity',importance:Notifications.AndroidImportance.DEFAULT,lockscreenVisibility:Notifications.AndroidNotificationVisibility.PRIVATE});
 let permission=desired?await Notifications.getPermissionsAsync():{granted:false,ios:undefined};
 if(desired&&ask&&!permission.granted)permission=await Notifications.requestPermissionsAsync();
 const enabled=permission.granted||permission.ios?.status===Notifications.IosAuthorizationStatus.PROVISIONAL;
 const token=enabled?(await Notifications.getExpoPushTokenAsync({projectId})).data:null;
 const install=await journal.next(origin);
 await api.device({installationId:install.id,secret:install.secret,revision:install.revision,provider:'expo',projectId,platform:Platform.OS,enabled,token});
 if(desired&&!enabled)throw new Error('push_permission_denied');
}
