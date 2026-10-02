import { Button, Text } from '../src/components/UI';
import {useState} from "react";
import { Linking, Switch, View } from 'react-native';
import {useTranslation} from 'react-i18next';
import {Screen} from '../src/components/Screen';
import {usePush} from '../src/notifications/PushProvider';
export default function NotificationSettings(){
 const [settingsError,setSettingsError]=useState(false);const {t}=useTranslation();const {configuration,preferences,busy,notice,save,reload}=usePush();
 return <Screen title={t('push_title')}>
  <Text>{t('push_privacy')}</Text>
  {!configuration?<Text>{t('working')}</Text>:!configuration.enabled?<Text>{t('push_not_configured')}</Text>:null}
  {preferences&&<><View><Text>{t('push_matches')}</Text><Switch accessibilityLabel={t('push_matches')} disabled={busy||!configuration?.enabled} value={preferences.matches} onValueChange={matches=>{void save({...preferences,matches});}}/></View>
   <View><Text>{t('push_messages')}</Text><Switch accessibilityLabel={t('push_messages')} disabled={busy||!configuration?.enabled} value={preferences.messages} onValueChange={messages=>{void save({...preferences,messages});}}/></View></>}
  {settingsError&&<Text accessibilityRole="alert">{t("push_failed")}</Text>}{!!notice&&<Text accessibilityRole="alert">{t(notice)}</Text>}
  <Button title={t('retry')} disabled={busy} onPress={()=>{void reload();}}/>
  <Button title={t('push_system_settings')} onPress={()=>{void Linking.openSettings().catch(()=>setSettingsError(true));}}/>
 </Screen>;
}
