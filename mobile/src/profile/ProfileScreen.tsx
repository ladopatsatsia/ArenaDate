import { Button, Link, Text, TextInput } from '../components/UI';
import { useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { Alert, Linking, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { Screen } from '../components/Screen';
import { ProfileApi, uploadPhoto } from './api';
import { ProfileEditor } from './ProfileEditor';
import { PrivatePhoto } from './PrivatePhoto';
export default function ProfileScreen() {
  const { state, api: auth, manager } = useAuth(); const { t } = useTranslation(); const cache = useQueryClient();
  const api = new ProfileApi(auth, manager);
  const key = ['account', state.account?.id, 'profile'];
  const profile = useQuery({ queryKey: key, queryFn: api.get });
  const { refetch } = profile;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  const choices = useQuery({ queryKey: ['account', state.account?.id, 'profile-choices'], queryFn: api.choices });
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ requestId: string; bytes: Blob } | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  async function action(fn: () => Promise<unknown>) {
    setBusy(true); setMessage('');
    try { await fn(); await cache.invalidateQueries({ queryKey: key }); }
    catch { setMessage('profile_action_failed'); }
    finally { setBusy(false); }
  }
  async function togglePause() {
    if (!profile.data) return;
    const targetPaused = profile.data.visible;
    await action(async () => {
      await api.pauseDiscoverability(targetPaused);
      cache.setQueryData(key, { ...profile.data, visible: !targetPaused });
      setMessage(targetPaused ? 'discoverability_paused' : 'discoverability_resumed');
    });
  }
  async function deleteAccount() {
    if (!deletePassword) return;
    setBusy(true); setMessage('');
    try {
      await api.deleteAccount(deletePassword);
      await manager.clear('account_deleted');
    } catch {
      setMessage('account_delete_failed');
    } finally {
      setBusy(false);
    }
  }
  async function upload(value: { requestId: string; bytes: Blob }) {
    await uploadPhoto(api, value.requestId, value.bytes); setPending(null); setMessage('photo_received');
  }
  async function pick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setMessage('photo_permission_denied'); return; }
    if (permission.accessPrivileges === 'limited') setMessage('photo_permission_limited');
    const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1, exif: false });
    if (selection.canceled) return;
    const asset = selection.assets[0];
    if (!asset) throw new Error('photo_not_selected');
    const context = ImageManipulator.manipulate(asset.uri);
    context.resize(asset.width >= asset.height ? { width: Math.min(asset.width, 1600) } : { height: Math.min(asset.height, 1600) });
    const rendered = await context.renderAsync();
    try {
      const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
      const file = new File(result.uri);
      let bytes: Blob;
      try { bytes = new Blob([await file.bytes()]); } finally { file.delete(); }
      if (bytes.size > 8 * 1024 * 1024) throw new Error('photo_too_large');
      const value = { requestId: Crypto.randomUUID(), bytes }; setPending(value); await upload(value);
    } finally { rendered.release(); context.release(); }
  }
  async function logout(all: boolean) { setBusy(true); try { await manager.logout(all); } catch { /* SessionManager displays local-only revocation status. */ } finally { setBusy(false); } }
  if (profile.isPending || choices.isPending) return <Screen title={t('profile')}><Text>{t('working')}</Text></Screen>;
  if (!profile.data || !choices.data) return <Screen title={t('profile')}><Text>{t('connection_error')}</Text>
    <Button title={t('retry')} onPress={() => { void profile.refetch(); void choices.refetch(); }} /></Screen>;
  const data = profile.data;
  return <Screen title={t('profile')}>
    <Link href="/notifications">{t("push_title")}</Link>
    <Link href="/safety">{t('safety_center')}</Link>
    <Text>{t(data.complete ? 'profile_complete' : 'profile_incomplete')}</Text>
    <Button title={t('profile_refresh')} disabled={profile.isFetching} onPress={() => { void refetch(); }} />
    <ProfileEditor key={data.revision} profile={data} choices={choices.data} api={api} saved={value => { cache.setQueryData(key, value); setMessage('profile_saved'); }} />
    <Text>{t('profile_photos')}</Text>
    {data.photos.length===0&&<Text>{t('photos_empty')}</Text>}
    {data.photos.map((photo, index) => <View key={photo.id} style={{ gap: 8 }}>
      <PrivatePhoto photo={photo} /><Text>{t('photo_' + photo.state)}{index === 0 ? ' · ' + t('photo_primary') : ''}</Text>
      {index > 0 && <Button disabled={busy} title={t('photo_move_up')} onPress={() => { void action(async () => {
        const ids = data.photos.map(p => p.id); const previous = ids[index - 1];
        if (!previous) throw new Error('invalid_photo_order');
        ids[index - 1] = photo.id; ids[index] = previous;
        cache.setQueryData(key, await api.reorder(data.revision, ids));
      }); }} />}
      <Button disabled={busy} title={t('photo_remove')} onPress={() => Alert.alert(t('photo_remove'), t('photo_remove_confirm'), [
        { text: t('cancel'), style: 'cancel' }, { text: t('photo_remove'), style: 'destructive', onPress: () => { void action(() => api.remove(photo.id)); } }])} />
    </View>)}
    <Button title={t(busy ? 'working' : 'photo_add')} disabled={busy || !!pending || data.photos.length >= 6} onPress={() => { void action(pick); }} />
    {pending && <><Button title={t('photo_retry')} disabled={busy} onPress={() => { void action(() => upload(pending)); }} />
      <Button title={t('cancel')} disabled={busy} onPress={() => { setPending(null); setMessage('photo_cancelled'); }} /></>}
    {message && <Text accessibilityRole="alert">{t(message)}</Text>}
    {(message === 'photo_permission_denied' || message === 'photo_permission_limited') &&
      <Button title={t('open_settings')} onPress={() => { void Linking.openSettings().catch(() => setMessage('profile_action_failed')); }} />}
    <Button title={t(data.visible ? 'discoverability_pause' : 'discoverability_resumed')} disabled={busy} onPress={() => { void togglePause(); }} />
    <Button testID="profile-logout" title={t('logout')} disabled={busy} onPress={() => { void logout(false); }} />
    <Button title={t('logout_all')} disabled={busy} onPress={() => { void logout(true); }} />
    {!showDelete ? (
      <Button testID="delete-account-button" title={t('account_delete')} disabled={busy} onPress={() => setShowDelete(true)} />
    ) : (
      <View style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: '#826675', borderRadius: 8, marginTop: 8 }}>
        <Text style={{ fontWeight: 'bold' }}>{t('account_delete_confirm_title')}</Text>
        <Text>{t('account_delete_confirm_desc')}</Text>
        <TextInput
          testID="delete-account-password"
          accessibilityLabel={t('account_delete_password')}
          placeholder={t('account_delete_password')}
          secureTextEntry
          value={deletePassword}
          onChangeText={setDeletePassword}
          style={{ borderWidth: 1, borderColor: '#826675', padding: 10, color: '#432d37' }}
        />
        <Button
          testID="delete-account-confirm"
          title={t('account_delete_action')}
          disabled={busy || !deletePassword}
          onPress={() => { void deleteAccount(); }}
        />
        <Button title={t('cancel')} disabled={busy} onPress={() => { setShowDelete(false); setDeletePassword(''); }} />
      </View>
    )}
  </Screen>;
}
