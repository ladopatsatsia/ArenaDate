import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { ProfileApi } from '../profile/api';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import { Text } from './UI';
import { formatCityName } from './cities';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { GiftsModal } from './GiftsModal';

interface BurgerMenuDrawerProps {
  visible: boolean;
  onClose: () => void;
  onOpenWallet: () => void;
  onOpenPremium?: () => void;
  crystalBalance?: number;
  hasPremium?: boolean;
}

const DRAWER_WIDTH = Math.min(340, Dimensions.get('window').width * 0.85);

export function BurgerMenuDrawer({
  visible,
  onClose,
  onOpenWallet,
  onOpenPremium,
  crystalBalance = 0,
  hasPremium = false,
}: BurgerMenuDrawerProps) {
  const { t, i18n } = useTranslation();
  const { state, api: auth, manager } = useAuth();
  const router = useRouter();
  const [showGiftsModal, setShowGiftsModal] = useState(false);

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(anim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, anim]);

  const profileApi = new ProfileApi(auth, manager);
  const accountId = state.account?.id;
  const profileQuery = useQuery({
    queryKey: ['account', accountId, 'profile'],
    queryFn: () => profileApi.get(),
    enabled: visible && !!accountId,
    staleTime: 60000,
  });

  const profile = profileQuery.data;
  const primaryPhoto =
    profile?.photos?.find((p) => Number(p.position) === 1) ?? profile?.photos?.[0];

  const navigateTo = (path: Parameters<typeof router.push>[0]) => {
    onClose();
    setTimeout(() => {
      router.push(path);
    }, 150);
  };

  const handleOpenWallet = () => {
    onClose();
    setTimeout(() => {
      onOpenWallet();
    }, 150);
  };

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-DRAWER_WIDTH, 0],
  });

  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.65],
  });

  return (
    <>
      <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      testID="burger-menu-drawer-modal"
    >
      <View style={styles.container}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('close', 'დახურვა')}
            testID="burger-backdrop-dismiss"
          />
        </Animated.View>

        {/* Sliding drawer panel */}
        <Animated.View
          style={[
            styles.drawerPanel,
            {
              width: DRAWER_WIDTH,
              transform: [{ translateX }],
            },
          ]}
          testID="burger-menu-panel"
        >
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.drawerScroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Top Close & Brand Row */}
            <View style={styles.topBar}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandTitle}>ARENA</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={10}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={t('close', 'დახურვა')}
                testID="burger-close-btn"
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* User Profile Card */}
            <Pressable
              onPress={() => navigateTo('/(tabs)/profile')}
              style={({ pressed }) => [styles.userCard, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={t('menu_view_profile', 'პროფილის ნახვა')}
              testID="drawer-profile-card"
            >
              <View style={[styles.avatarBorder, hasPremium && styles.avatarBorderPremium]}>
                {primaryPhoto ? (
                  <PrivatePhoto photo={primaryPhoto} avatar />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderEmoji}>👤</Text>
                  </View>
                )}
                {hasPremium && (
                  <View style={styles.avatarCrownBadge} testID="drawer-avatar-crown">
                    <Text style={{ fontSize: 10 }}>👑</Text>
                  </View>
                )}
              </View>
              <View style={styles.userInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {profile?.displayName ?? 'Arena User'}
                    {profile?.age ? `, ${profile.age}` : ''}
                  </Text>
                  {hasPremium && (
                    <View style={styles.drawerBlackPill} testID="drawer-vip-pill">
                      <Text style={styles.drawerBlackPillText}>🖤 BLACK</Text>
                    </View>
                  )}
                </View>
                {hasPremium && (
                  <Text style={styles.vipMemberText} testID="drawer-vip-member-label">
                    {t('drawer_vip_member_label', '👑 VIP წევრი • აქტიურია')}
                  </Text>
                )}
                {!!profile?.city && (
                  <Text style={styles.userLocation} numberOfLines={1}>
                    📍 {formatCityName(profile.city, i18n.language)}
                  </Text>
                )}
                <Text style={styles.profileLink}>
                  {t('menu_view_profile', 'პროფილის ნახვა')} ›
                </Text>
              </View>
            </Pressable>

            {/* Crystals Showcase Card */}
            <View style={styles.crystalCard} testID="drawer-crystals-card">
              <View style={styles.crystalCardGlow} />
              <View style={styles.crystalHeaderRow}>
                <View style={styles.crystalIconCircle}>
                  <Text style={styles.crystalIconEmoji}>💎</Text>
                </View>
                <View style={styles.crystalInfoCol}>
                  <Text style={styles.crystalCardLabel} numberOfLines={1}>
                    {t('menu_crystals_title', 'კრისტალები')}
                  </Text>
                  <Text style={styles.crystalBalanceText} testID="drawer-crystal-balance" numberOfLines={1}>
                    {crystalBalance} <Text style={styles.crystalSuffix}>💎</Text>
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleOpenWallet}
                  style={styles.buyCrystalBtn}
                  activeOpacity={0.8}
                  testID="drawer-buy-crystals-btn"
                >
                  <Text style={styles.buyCrystalBtnText}>
                    + {t('menu_get_crystals', 'შეძენა')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Crystal Usage Hints */}
              <View style={styles.crystalPerksContainer}>
                <View style={styles.crystalPerkPill}>
                  <Text style={styles.crystalPerkText}>
                    💬 {t('menu_perk_chat', 'ჩატი (25 💎)')}
                  </Text>
                </View>
                <View style={styles.crystalPerkPill}>
                  <Text style={styles.crystalPerkText}>
                    🍾 {t('menu_perk_arena', 'ბოთლის არენა')}
                  </Text>
                </View>
                <View style={styles.crystalPerkPill}>
                  <Text style={styles.crystalPerkText}>
                    👁️ {t('menu_perk_views', 'ნახვები')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Menu Items Section */}
            <View style={styles.menuItemsList}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleOpenWallet}
                activeOpacity={0.7}
                testID="drawer-nav-wallet"
              >
                <View style={[styles.menuItemIconBg, { backgroundColor: 'rgba(147, 51, 234, 0.15)' }]}>
                  <Text style={styles.menuItemIcon}>💎</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>
                    {t('menu_wallet_nav', 'კრისტალები & საფულე')}
                  </Text>
                  <Text style={styles.menuItemSub}>
                    {crystalBalance} 💎 {t('menu_available_crystals', 'ხელმისაწვდომი')}
                  </Text>
                </View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.menuItem, hasPremium && styles.menuItemPremiumActive]}
                onPress={() => {
                  onClose();
                  setTimeout(() => {
                    onOpenPremium?.();
                  }, 150);
                }}
                activeOpacity={0.7}
                testID="drawer-nav-premium"
              >
                <View style={[styles.menuItemIconBg, hasPremium ? styles.menuItemIconBgPremium : { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#475569' }]}>
                  <Text style={styles.menuItemIcon}>🖤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.menuItemTitle, { color: '#F8FAFC', fontWeight: '800' }]}>
                      {t('menu_premium_nav', 'Arena Black')}
                    </Text>
                    {hasPremium && (
                      <View style={styles.activeCheckBadge} testID="drawer-active-check-badge">
                        <Text style={styles.activeCheckBadgeText}>
                          {t('drawer_vip_active_check', 'აქტიურია ✓')}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.menuItemSub, hasPremium && { color: '#38BDF8', fontWeight: '600' }]}>
                    {hasPremium
                      ? t('drawer_vip_privileges_active', 'VIP პრივილეგიები გააქტიურებულია')
                      : t('menu_premium_sub', 'ექსკლუზიური წვდომა & VIP სტატუსი')}
                  </Text>
                </View>
                <Text style={[styles.menuItemArrow, hasPremium && { color: '#38BDF8' }]}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setShowGiftsModal(true)}
                activeOpacity={0.7}
                testID="drawer-nav-gifts"
              >
                <View style={[styles.menuItemIconBg, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
                  <Text style={styles.menuItemIcon}>🎁</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>
                    {t('menu_gifts', 'საჩუქრები')}
                  </Text>
                  <Text style={styles.menuItemSub}>
                    {t('menu_gifts_sub', 'მიღებული და გაცემული საჩუქრები')}
                  </Text>
                </View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateTo('/(tabs)/discover')}
                activeOpacity={0.7}
                testID="drawer-nav-discover"
              >
                <View style={[styles.menuItemIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Text style={styles.menuItemIcon}>🔥</Text>
                </View>
                <Text style={styles.menuItemTitle}>{t('discover', 'აღმოჩენა')}</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateTo('/(tabs)/matches')}
                activeOpacity={0.7}
                testID="drawer-nav-matches"
              >
                <View style={[styles.menuItemIconBg, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                  <Text style={styles.menuItemIcon}>💖</Text>
                </View>
                <Text style={styles.menuItemTitle}>{t('matches', 'კავშირები & ნახვები')}</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateTo('/(tabs)/messages')}
                activeOpacity={0.7}
                testID="drawer-nav-messages"
              >
                <View style={[styles.menuItemIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Text style={styles.menuItemIcon}>💬</Text>
                </View>
                <Text style={styles.menuItemTitle}>{t('messages', 'შეტყობინებები')}</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateTo('/(tabs)/game')}
                activeOpacity={0.7}
                testID="drawer-nav-game"
              >
                <View style={[styles.menuItemIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Text style={styles.menuItemIcon}>🍾</Text>
                </View>
                <Text style={styles.menuItemTitle}>{t('arena', 'ბოთლის არენა')}</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateTo('/(tabs)/today-plans')}
                activeOpacity={0.7}
                testID="drawer-nav-today-plans"
              >
                <View style={[styles.menuItemIconBg, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                  <Text style={styles.menuItemIcon}>✨</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>{t('today_plans_title', 'დღეს მინდა…')}</Text>
                  <Text style={styles.menuItemSub}>{t('today_plans_subtitle', 'სპონტანური შეხვედრები & გეგმები')}</Text>
                </View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateTo('/(tabs)/profile')}
                activeOpacity={0.7}
                testID="drawer-nav-profile"
              >
                <View style={[styles.menuItemIconBg, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                  <Text style={styles.menuItemIcon}>👤</Text>
                </View>
                <Text style={styles.menuItemTitle}>{t('profile', 'ჩემი პროფილი')}</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateTo('/(tabs)/safety')}
                activeOpacity={0.7}
                testID="drawer-nav-safety"
              >
                <View style={[styles.menuItemIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Text style={styles.menuItemIcon}>🚫</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>
                    {t('blocked_accounts', 'დაბლოკილი ანგარიშები')}
                  </Text>
                  <Text style={styles.menuItemSub}>
                    {t('blocked_accounts_sub', 'დაბლოკილი მომხმარებლები და საუბრები')}
                  </Text>
                </View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateTo('/(tabs)/terms')}
                activeOpacity={0.7}
                testID="drawer-nav-terms"
              >
                <View style={[styles.menuItemIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Text style={styles.menuItemIcon}>📜</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemTitle}>
                    {t('terms_and_conditions', 'წესები და პირობები')}
                  </Text>
                  <Text style={styles.menuItemSub}>
                    {t('terms_and_conditions_sub', 'საზოგადოების წესები & უსაფრთხოება')}
                  </Text>
                </View>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => navigateTo('/(tabs)/notifications')}
                activeOpacity={0.7}
                testID="drawer-nav-notifications"
              >
                <View style={[styles.menuItemIconBg, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                  <Text style={styles.menuItemIcon}>🔔</Text>
                </View>
                <Text style={styles.menuItemTitle}>{t('push_title', 'შეტყობინებები')}</Text>
                <Text style={styles.menuItemArrow}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Actions */}
            <View style={styles.bottomSection}>
              {/* Language selection section */}
              <View style={styles.langSelectorBox} testID="drawer-language-toggle">
                <View style={styles.langSelectorHeader}>
                  <Text style={styles.langSelectorTitle}>🌐 {t('language', 'ენა')}</Text>
                </View>
                <View style={styles.langPillsRow}>
                  {SUPPORTED_LANGUAGES.map(lang => {
                    const isActive = (i18n.language ?? 'ka').startsWith(lang.code);
                    return (
                      <TouchableOpacity
                        key={lang.code}
                        onPress={() => {
                          void i18n.changeLanguage(lang.code);
                        }}
                        style={[
                          styles.langPill,
                          isActive && styles.langPillActive,
                        ]}
                        activeOpacity={0.7}
                        testID={`drawer-lang-${lang.code}`}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                      >
                        <Text style={styles.langPillFlag}>{lang.flag}</Text>
                        <Text style={[styles.langPillText, isActive && styles.langPillTextActive]}>
                          {lang.native}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Logout button */}
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  void manager.clear('user_logout');
                }}
                style={styles.logoutButton}
                activeOpacity={0.7}
                testID="drawer-logout-btn"
              >
                <Text style={styles.logoutIcon}>🚪</Text>
                <Text style={styles.logoutText}>{t('logout', 'გასვლა')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
    <GiftsModal
      visible={showGiftsModal}
      onClose={() => setShowGiftsModal(false)}
    />
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  drawerPanel: {
    height: '100%',
    backgroundColor: '#0c0f1d',
    borderRightWidth: 1,
    borderRightColor: '#1e293b',
    paddingTop: 48,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  drawerScroll: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#a855f7',
    letterSpacing: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: 'bold',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#131b2e',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  avatarBorder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#8b5cf6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1b4b',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderEmoji: {
    fontSize: 26,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f8fafc',
  },
  userLocation: {
    fontSize: 12,
    color: '#94a3b8',
  },
  profileLink: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a855f7',
    marginTop: 2,
  },

  /* Crystal Showcase Card (Boo Style) */
  crystalCard: {
    backgroundColor: '#151336',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    padding: 14,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  crystalCardGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
  },
  crystalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  crystalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crystalIconEmoji: {
    fontSize: 18,
  },
  crystalInfoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
  },
  crystalCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#a5b4fc',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  crystalBalanceText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  crystalSuffix: {
    fontSize: 14,
  },
  buyCrystalBtn: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  buyCrystalBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
  },
  crystalPerksContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  crystalPerkPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  crystalPerkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
  },

  /* Menu Items */
  menuItemsList: {
    gap: 4,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  menuItemIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemIcon: {
    fontSize: 18,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
    flex: 1,
  },
  menuItemSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1,
  },
  menuItemArrow: {
    fontSize: 18,
    color: '#64748b',
    fontWeight: '700',
  },
  avatarBorderPremium: {
    borderColor: '#38BDF8',
    borderWidth: 2.5,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  avatarCrownBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#0F172A',
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  drawerBlackPill: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  drawerBlackPillText: {
    color: '#F8FAFC',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  vipMemberText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  menuItemPremiumActive: {
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
    borderWidth: 1,
  },
  menuItemIconBgPremium: {
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  activeCheckBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  activeCheckBadgeText: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '800',
  },

  /* Bottom Section */
  bottomSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 12,
  },
  langSelectorBox: {
    backgroundColor: '#131b2e',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 8,
  },
  langSelectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langSelectorTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  langPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  langPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  langPillActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
    borderColor: '#8b5cf6',
  },
  langPillFlag: {
    fontSize: 14,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  langPillTextActive: {
    color: '#F3E8FF',
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  logoutIcon: {
    fontSize: 16,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
});
