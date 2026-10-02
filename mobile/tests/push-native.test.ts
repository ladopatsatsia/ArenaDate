import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {registerInstallation} from '../src/notifications/native';
import type {PushApi} from '../src/notifications/api';
const project='59d15e99-f1f5-469e-8122-0637b56ead44';
jest.mock('expo-notifications',()=>({getPermissionsAsync:jest.fn(),requestPermissionsAsync:jest.fn(),getExpoPushTokenAsync:jest.fn(),setNotificationChannelAsync:jest.fn(),IosAuthorizationStatus:{PROVISIONAL:3},AndroidImportance:{DEFAULT:3},AndroidNotificationVisibility:{PRIVATE:0}}));
jest.mock('expo-device',()=>({isDevice:true}));
jest.mock('expo-constants',()=>({__esModule:true,default:{executionEnvironment:'bare',expoConfig:{extra:{eas:{projectId:'59d15e99-f1f5-469e-8122-0637b56ead44'}}}},ExecutionEnvironment:{StoreClient:'storeClient'}}));
jest.mock('expo-secure-store',()=>({getItemAsync:async()=>null,setItemAsync:async()=>{},WHEN_UNLOCKED_THIS_DEVICE_ONLY:'private'}));
jest.mock('expo-crypto',()=>({randomUUID:()=> '2aed1543-45f7-4ed5-a104-2e029fa54d11',getRandomBytesAsync:async()=>new Uint8Array(32).fill(1)}));
test('permission denial explicitly deactivates installation without token acquisition',async()=>{
 jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({granted:false} as Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>);
 jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue({granted:false} as Awaited<ReturnType<typeof Notifications.requestPermissionsAsync>>);
 const device=jest.fn(async()=>{});await expect(registerInstallation({device} as unknown as PushApi,'https://api.test',{enabled:true,projectId:project},true)).rejects.toThrow('push_permission_denied');
 expect(device).toHaveBeenCalledWith(expect.objectContaining({enabled:false,token:null,provider:'expo',projectId:project}));
 expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
});
test('configured project is checked before requesting a remote token and Expo Go is rejected',async()=>{
 const device=jest.fn();await expect(registerInstallation({device} as unknown as PushApi,'https://api.test',{enabled:true,projectId:'another'},true)).rejects.toThrow('push_project_mismatch');
 Constants.executionEnvironment='storeClient' as typeof Constants.executionEnvironment;
 await expect(registerInstallation({device} as unknown as PushApi,'https://api.test',{enabled:true,projectId:project},true)).rejects.toThrow('push_development_build');expect(device).not.toHaveBeenCalled();
});

test('an opted-out new account still rebinds and deactivates the prior installation without asking permission',async()=>{
 Constants.executionEnvironment='bare' as typeof Constants.executionEnvironment;
 jest.clearAllMocks();const device=jest.fn(async()=>{});
 await registerInstallation({device} as unknown as PushApi,'https://api.test',{enabled:true,projectId:project},false,false);
 expect(device).toHaveBeenCalledWith(expect.objectContaining({enabled:false,token:null,revision:1}));
 expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
});
