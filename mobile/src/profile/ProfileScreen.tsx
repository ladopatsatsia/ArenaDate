import { Button, ProfileSkeleton, Text, TextInput } from '../components/UI';
import { useFocusEffect } from 'expo-router';
import { useState, useCallback, useMemo } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { Screen } from '../components/Screen';
import { theme } from '../components/theme';
import { ProfileApi, uploadPhoto } from './api';
import { ProfileEditor } from './ProfileEditor';
import { PrivatePhoto } from './PrivatePhoto';
import { PremiumApi, type PremiumStatus } from '../premium/PremiumApi';
import { PremiumModal } from '../premium/PremiumModal';

const EMPTY_PREMIUM_STATUS: PremiumStatus = {
  hasPremium: false,
  activePackageId: null,
  expiresAtUtc: null,
  isLifetime: false,
  packages: [],
};

export default function ProfileScreen() {
  const { state, api: auth, manager } = useAuth();
  const { t } = useTranslation();
  const cache = useQueryClient();
  const api = new ProfileApi(auth, manager);
  const premiumApi = useMemo(() => new PremiumApi(auth, manager), [auth, manager]);
  const key = ['account', state.account?.id, 'profile'];
  const profile = useQuery({ queryKey: key, queryFn: api.get });
  const { refetch } = profile;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  const choices = useQuery({ queryKey: ['account', state.account?.id, 'profile-choices'], queryFn: api.choices });
  const premiumStatus = useQuery({
    queryKey: ['account', state.account?.id, 'premium-status'],
    queryFn: async (): Promise<PremiumStatus> => {
      try {
        const res = await premiumApi.status();
        return res ?? EMPTY_PREMIUM_STATUS;
      } catch {
        return EMPTY_PREMIUM_STATUS;
      }
    },
    enabled: !!state.account?.id,
    staleTime: 30000,
  });
  const hasPremium = !!premiumStatus.data?.hasPremium;

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<{ requestId: string; fileUri: string } | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [premiumModalOpen, setPremiumModalOpen] = useState(false);

  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage('');
    try {
      await fn();
      await cache.invalidateQueries({ queryKey: key });
    } catch (err: unknown) {
      console.error('Photo action failed:', err);
      const e = err as { message?: string; status?: number } | undefined;
      if (e?.message === 'photo_too_large') setMessage('photo_too_large');
      else if (e?.message === 'photo_not_selected') setMessage('photo_not_selected');
      else if (e?.status === 400 || e?.message?.includes('photo_limit')) setMessage('photo_limit');
      else setMessage('profile_action_failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!deletePassword) return;
    setBusy(true);
    setMessage('');
    try {
      await api.deleteAccount(deletePassword);
      await manager.clear('account_deleted');
    } catch {
      setMessage('account_delete_failed');
    } finally {
      setBusy(false);
    }
  }

  async function upload(val: { requestId: string; fileUri: string }) {
    await action(async () => {
      await uploadPhoto(api, val.requestId, val.fileUri);
      setPending(null);
      setMessage('photo_received');
    });
  }

  async function pick() {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage('photo_permission_denied');
        return;
      }
      if (permission.accessPrivileges === 'limited') setMessage('photo_permission_limited');
    }
    const selection = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
      exif: false,
    });
    if (selection.canceled || !selection.assets || selection.assets.length === 0) return;
    const asset = selection.assets[0];
    if (!asset || !asset.uri) throw new Error('photo_not_selected');

    let finalUri = asset.uri;
    try {
      const width = asset.width || 1200;
      const height = asset.height || 1200;
      const resizeAction = width >= height
        ? { resize: { width: Math.min(width, 1600) } }
        : { resize: { height: Math.min(height, 1600) } };

      const manipulated = await manipulateAsync(
        asset.uri,
        [resizeAction],
        { format: SaveFormat.JPEG, compress: 0.85 }
      );
      if (manipulated?.uri) {
        finalUri = manipulated.uri;
      }
    } catch (manipulateErr) {
      console.warn('Image manipulation skipped, using raw uri:', manipulateErr);
    }

    if (Platform.OS !== 'web') {
      const fileInfo = await FileSystem.getInfoAsync(finalUri);
      if (fileInfo.exists && fileInfo.size && fileInfo.size > 8 * 1024 * 1024) {
        throw new Error('photo_too_large');
      }
    }

    const value = { requestId: Crypto.randomUUID(), fileUri: finalUri };
    setPending(value);
    await upload(value);
  }

  async function logout(all: boolean) {
    setBusy(true);
    try {
      await manager.logout(all);
    } catch {
      /* SessionManager displays local-only revocation status. */
    } finally {
      setBusy(false);
    }
  }

  if (profile.isPending || choices.isPending) return <Screen title={t('profile')}><ProfileSkeleton /></Screen>;
  if (!profile.data || !choices.data) {
    return (
      <Screen title={t('profile')}>
        <Text>{t('connection_error')}</Text>
      </Screen>
    );
  }

  const data = profile.data;
  return (
    <Screen title={t('profile')}>
      {/* TINDER-STYLE PHOTO GRID (AT THE VERY TOP) */}
      <View style={styles.photosCard}>
        <View style={styles.photosHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
            <Text style={{ fontSize: 18 }}>📸</Text>
            <Text style={styles.photosTitle} numberOfLines={1} ellipsizeMode="tail">
              {t('profile_photos')}
            </Text>
          </View>
          <View style={styles.photoCountBadge}>
            <Text style={styles.photoCountText}>{data.photos.length}/6</Text>
          </View>
        </View>

        <View style={styles.photoGrid}>
          {[0, 1, 2, 3, 4, 5].map(index => {
            const photo = data.photos[index];
            if (photo) {
              return (
                <View key={photo.id} style={styles.photoSlot}>
                  <PrivatePhoto photo={photo} avatar={true} />

                  {/* Main / Primary Photo Badge */}
                  {index === 0 && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>★ {t('photo_primary')}</Text>
                    </View>
                  )}

                  {/* Pending Review Badge */}
                  {photo.state === 'pending' && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>⏳</Text>
                    </View>
                  )}

                  {/* Move Up Button (for non-primary photos) */}
                  {index > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('photo_move_up')}
                      hitSlop={8}
                      onPress={() => {
                        void action(async () => {
                          const ids = data.photos.map(p => p.id);
                          const previous = ids[index - 1];
                          if (!previous) throw new Error('invalid_photo_order');
                          ids[index - 1] = photo.id;
                          ids[index] = previous;
                          cache.setQueryData(key, await api.reorder(data.revision, ids));
                        });
                      }}
                      style={styles.slotMoveBtn}
                    >
                      <Text style={styles.slotMoveText}>◀</Text>
                    </Pressable>
                  )}

                  {/* Red ✕ Delete Button */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('photo_remove')}
                    hitSlop={8}
                    onPress={() => Alert.alert(t('photo_remove'), t('photo_remove_confirm'), [
                      { text: t('cancel'), style: 'cancel' },
                      { text: t('photo_remove'), style: 'destructive', onPress: () => { void action(() => api.remove(photo.id)); } }
                    ])}
                    style={styles.slotDeleteBtn}
                  >
                    <Text style={styles.slotDeleteText}>✕</Text>
                  </Pressable>
                </View>
              );
            }

            // Empty Slot with "+" Button
            return (
              <Pressable
                key={'empty-' + index}
                accessibilityRole="button"
                accessibilityLabel={t('photo_add')}
                disabled={busy || !!pending || data.photos.length >= 6}
                onPress={() => { void action(pick); }}
                style={({ pressed }) => [
                  styles.emptyPhotoSlot,
                  pressed && { opacity: 0.7, transform: [{ scale: 0.96 }] },
                ]}
              >
                <View style={styles.plusCircle}>
                  <Text style={styles.plusIcon}>+</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.photosCaption}>
          {t('profile_photos_caption')}
        </Text>

        {pending && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Button title={t('photo_retry')} disabled={busy} onPress={() => { void action(() => upload(pending)); }} />
            <Button title={t('cancel')} disabled={busy} onPress={() => { setPending(null); setMessage('photo_cancelled'); }} />
          </View>
        )}
      </View>

      {/* ARENA BLACK MEMBERSHIP STATUS CARD */}
      {hasPremium ? (
        <Pressable
          style={styles.premiumVipCard}
          onPress={() => setPremiumModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('profile_vip_badge', 'VIP წევრი ✓')}
          testID="profile-premium-vip-card"
        >
          <View style={styles.premiumVipHeaderRow}>
            <View style={styles.premiumVipIconBox}>
              <Text style={{ fontSize: 24 }}>🖤</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text style={styles.premiumVipTitle}>ARENA BLACK</Text>
                <View style={styles.vipActiveBadge} testID="profile-vip-active-badge">
                  <Text style={styles.vipActiveBadgeText}>{t('profile_vip_badge', 'VIP წევრი ✓')}</Text>
                </View>
              </View>
              <Text style={styles.premiumVipSubtitle}>
                {premiumStatus.data?.isLifetime
                  ? t('profile_vip_unlimited', '👑 ულიმიტო VIP წევრობა გააქტიურებულია')
                  : premiumStatus.data?.expiresAtUtc
                    ? t('profile_vip_expires', {
                        date: new Date(premiumStatus.data.expiresAtUtc).toLocaleDateString(),
                        defaultValue: `📅 ვადა: ${new Date(premiumStatus.data.expiresAtUtc).toLocaleDateString()}`,
                      })
                    : t('profile_vip_active', '⭐ VIP სტატუსი გააქტიურებულია')}
              </Text>
            </View>
            <Text style={styles.vipArrow}>›</Text>
          </View>
        </Pressable>
      ) : (
        <Pressable
          style={styles.premiumPromoCard}
          onPress={() => setPremiumModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('profile_vip_promo_title', 'ARENA BLACK- VIP სტატუსი')}
          testID="profile-premium-promo-card"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.premiumPromoIconBox}>
              <Text style={{ fontSize: 22 }}>🖤</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumPromoTitle}>{t('profile_vip_promo_title', 'ARENA BLACK- VIP სტატუსი')}</Text>
              <Text style={styles.premiumPromoDesc}>
                {t('profile_vip_promo_sub', 'ყოველთვის ყურადღების ცენტრში')}
              </Text>
            </View>
            <View style={styles.premiumPromoBtn}>
              <Text style={styles.premiumPromoBtnText}>{t('profile_vip_promo_btn', 'ჩართვა')}</Text>
            </View>
          </View>
        </Pressable>
      )}

      {/* Main Profile Editor with Structured Sections */}
      <ProfileEditor
        profile={data}
        choices={choices.data}
        api={api}
        saved={value => {
          cache.setQueryData(key, value);
        }}
      />

      {/* Global Status Feedback */}
      {message && <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{t(message)}</Text>}
      {(message === 'photo_permission_denied' || message === 'photo_permission_limited') && (
        <Button title={t('open_settings')} onPress={() => { void Linking.openSettings().catch(() => setMessage('profile_action_failed')); }} />
      )}

      {/* SECTION: ⚙️ Account Management (Clean, without Pause Discovery or Logout All) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderIcon}>⚙️</Text>
          <Text style={styles.sectionHeaderTitle}>{t('section_account_security')}</Text>
        </View>

        <Button
          testID="profile-logout"
          title={t('logout')}
          disabled={busy}
          onPress={() => { void logout(false); }}
        />

        {!showDelete ? (
          <Button
            testID="delete-account-button"
            title={t('account_delete')}
            disabled={busy}
            onPress={() => setShowDelete(true)}
          />
        ) : (
          <View style={styles.deleteBox}>
            <Text style={{ fontWeight: 'bold', color: theme.colors.danger }}>{t('account_delete_confirm_title')}</Text>
            <Text style={{ color: theme.colors.text }}>{t('account_delete_confirm_desc')}</Text>
            <TextInput
              testID="delete-account-password"
              accessibilityLabel={t('account_delete_password')}
              placeholder={t('account_delete_password')}
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              style={{ borderWidth: 1, borderColor: theme.colors.danger, padding: 10, color: theme.colors.text, backgroundColor: theme.colors.background, borderRadius: 8 }}
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
      </View>

      <PremiumModal
        visible={premiumModalOpen}
        onClose={() => setPremiumModalOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  navLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  photosCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.22)',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 8,
  },
  photosHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  photosTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  photoCountBadge: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  photoCountText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
  photoSlot: {
    width: '31%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyPhotoSlot: {
    width: '31%',
    aspectRatio: 3 / 4,
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.45)',
    backgroundColor: 'rgba(33, 26, 48, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  plusIcon: {
    color: theme.colors.primary,
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  primaryBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 10,
  },
  primaryBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  pendingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 10,
  },
  pendingBadgeText: {
    fontSize: 10,
  },
  slotMoveBtn: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(33, 26, 48, 0.85)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  slotMoveText: {
    color: theme.colors.text,
    fontSize: 10,
  },
  slotDeleteBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(251, 113, 133, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  slotDeleteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 14,
  },
  photosCaption: {
    fontSize: 12,
    color: theme.colors.muted,
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.22)',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionHeaderIcon: {
    fontSize: 18,
  },
  sectionHeaderTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  deleteBox: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    borderRadius: 10,
    backgroundColor: 'rgba(251, 113, 133, 0.08)',
    marginTop: 4,
  },
  premiumVipCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 12,
    marginBottom: 8,
  },
  premiumVipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  premiumVipIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumVipTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  vipActiveBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vipActiveBadgeText: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '800',
  },
  premiumVipSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  vipArrow: {
    fontSize: 22,
    color: '#38BDF8',
    fontWeight: 'bold',
  },
  premiumPromoCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#334155',
    marginTop: 12,
    marginBottom: 8,
  },
  premiumPromoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumPromoTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#F8FAFC',
  },
  premiumPromoDesc: {
    fontSize: 12,
    color: theme.colors.muted,
    marginTop: 2,
  },
  premiumPromoBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  premiumPromoBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
});
