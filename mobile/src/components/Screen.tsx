import { Children, PropsWithChildren, ReactNode, useContext, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, Button } from './UI';
import { theme } from './theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { QueryClientContext, useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { GameApi } from '../game/GameApi';
import { BurgerMenuDrawer } from './BurgerMenuDrawer';
import { WalletModal } from './WalletModal';
import { PremiumModal } from '../premium/PremiumModal';
import { PremiumApi } from '../premium/PremiumApi';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const logoMarkSource = require('../../assets/logo-mark.png');

interface ScreenBaseProps {
  title: string;
  scroll?: boolean;
  headerRight?: ReactNode;
  hideBottomLanguage?: boolean;
  burgerButton?: ReactNode;
  crystalPill?: ReactNode;
  blackBadge?: ReactNode;
  arenaBrand?: ReactNode;
  modals?: ReactNode;
  showBrandSubHeader?: boolean;
  hideHeaderTitle?: boolean;
}

function ScreenBase({
  title,
  children,
  scroll = true,
  headerRight,
  hideBottomLanguage = true,
  burgerButton,
  crystalPill,
  blackBadge,
  arenaBrand,
  modals,
  showBrandSubHeader = false,
  hideHeaderTitle = false,
}: PropsWithChildren<ScreenBaseProps>) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language ?? 'ka';
  const nextLang = currentLang.startsWith('ka') ? 'ru' : currentLang.startsWith('ru') ? 'en' : 'ka';
  const flagEmoji = currentLang.startsWith('ka') ? '🇬🇪' : currentLang.startsWith('ru') ? '🇷🇺' : '🇬🇧';
  const flagLabel = currentLang.startsWith('ka') ? 'GE' : currentLang.startsWith('ru') ? 'RU' : 'EN';

  const flagToggle = (
    <Pressable
      testID="language-toggle"
      accessibilityRole="button"
      accessibilityLabel={`${t('language')}: ${flagLabel}`}
      onPress={() => {
        void i18n.changeLanguage(nextLang);
      }}
      hitSlop={8}
      style={({ pressed }) => [styles.flagButton, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.flagEmoji}>{flagEmoji}</Text>
      <Text style={styles.flagLabel}>{flagLabel}</Text>
    </Pressable>
  );

  const showCenterTitle = !hideHeaderTitle && !showBrandSubHeader && !burgerButton && !blackBadge && !arenaBrand;

  const header = (
    <View style={styles.headerRow}>
      <View style={styles.headerLeftCluster}>
        {burgerButton ?? null}
        {blackBadge ?? null}
        {arenaBrand ?? null}
        {crystalPill ?? null}
      </View>
      {showCenterTitle ? (
        <View style={styles.headerCenterCluster}>
          <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={styles.headerRightCluster}>
        {flagToggle}
        {headerRight ?? null}
      </View>
    </View>
  );

  const bottomLanguage = !hideBottomLanguage ? (
    <Button
      title={`${t('language')}: ${flagEmoji} ${flagLabel}`}
      onPress={() => {
        void i18n.changeLanguage(nextLang);
      }}
    />
  ) : null;

  const safeChildren = useMemo(() => {
    return Children.map(children, (child) => {
      if (child === null || child === undefined || typeof child === 'boolean') {
        return null;
      }
      if (typeof child === 'string') {
        const trimmed = child.trim();
        if (!trimmed) return null;
        return <Text>{child}</Text>;
      }
      if (typeof child === 'number') {
        return <Text>{child}</Text>;
      }
      return child;
    });
  }, [children]);

  const brandSubHeader = showBrandSubHeader ? (
    <View style={styles.brandSubHeader} testID="screen-brand-sub-header">
      <View style={styles.brandSubHeaderPill}>
        <Image
          source={logoMarkSource}
          style={styles.brandSubHeaderLogo}
          resizeMode="contain"
        />
        <Text style={styles.brandSubHeaderTitle}>ARENA</Text>
      </View>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <View style={styles.stickyHeaderBlock}>
          {header}
          {brandSubHeader}
        </View>

        {scroll ? (
          <ScrollView
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.content}
          >
            <View style={styles.body}>{safeChildren}</View>
            {bottomLanguage ? <View style={{ padding: 12 }}>{bottomLanguage}</View> : null}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>{safeChildren}</View>
            {bottomLanguage ? <View style={{ padding: 12 }}>{bottomLanguage}</View> : null}
          </View>
        )}
      </KeyboardAvoidingView>
      {modals ?? null}
    </SafeAreaView>
  );
}

export function AuthenticatedScreenFeatures({
  children,
  showCrystalInHeader = false,
}: {
  children: (nav: {
    burgerButton: ReactNode;
    crystalPill: ReactNode;
    blackBadge: ReactNode;
    arenaBrand: ReactNode;
    modals: ReactNode;
    showBrandSubHeader: boolean;
  }) => ReactNode;
  showCrystalInHeader?: boolean;
}) {
  const { t } = useTranslation();
  const { api, manager, state } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);

  const isSignedIn = state.status === 'signedIn' || !!state.account;

  const gameApi = useMemo(() => {
    if (!api || !manager || !isSignedIn) return null;
    return new GameApi(api, manager);
  }, [api, manager, isSignedIn]);

  const premiumApi = useMemo(() => {
    if (!api || !manager || !isSignedIn) return null;
    return new PremiumApi(api, manager);
  }, [api, manager, isSignedIn]);

  const walletQuery = useQuery({
    queryKey: ['game-wallet'],
    queryFn: async () => {
      try {
        if (!gameApi) return { balance: 0, outstandingDebt: 0 };
        const res = await gameApi.getWallet();
        return res ?? { balance: 0, outstandingDebt: 0 };
      } catch {
        return { balance: 0, outstandingDebt: 0 };
      }
    },
    enabled: isSignedIn && !!gameApi,
    staleTime: 30000,
  });

  const premiumQuery = useQuery({
    queryKey: ['account', state.account?.id, 'premium-status'],
    queryFn: async () => {
      try {
        if (!premiumApi) return { hasPremium: false };
        const res = await premiumApi.status();
        return res ?? { hasPremium: false };
      } catch {
        return { hasPremium: false };
      }
    },
    enabled: isSignedIn && !!premiumApi,
    staleTime: 30000,
  });

  const crystalBalance = Number(walletQuery.data?.balance ?? 0);
  const hasPremium = !!premiumQuery.data?.hasPremium;

  const arenaBrand = (
    <View style={styles.headerArenaBrand} testID="header-arena-brand">
      <Image
        source={logoMarkSource}
        style={styles.headerArenaLogo}
        resizeMode="contain"
      />
      <Text style={styles.headerArenaTitle}>ARENA</Text>
    </View>
  );

  if (!isSignedIn) {
    return children({
      burgerButton: null,
      crystalPill: null,
      blackBadge: null,
      arenaBrand,
      modals: null,
      showBrandSubHeader: false,
    });
  }

  const burgerButton = (
    <TouchableOpacity
      testID="burger-menu-button"
      accessibilityRole="button"
      accessibilityLabel={t('menu_drawer_title', 'მენიუ')}
      onPress={() => setDrawerOpen(true)}
      hitSlop={8}
      style={styles.burgerButton}
    >
      <Text style={styles.burgerIcon}>☰</Text>
    </TouchableOpacity>
  );

  const crystalPill = showCrystalInHeader ? (
    <TouchableOpacity
      testID="header-crystal-badge"
      accessibilityRole="button"
      accessibilityLabel={`${t('menu_crystals_title', 'კრისტალები')}: ${crystalBalance}`}
      onPress={() => setWalletOpen(true)}
      hitSlop={8}
      style={styles.crystalPill}
    >
      <Text style={styles.crystalEmoji}>💎</Text>
      <Text style={styles.crystalCount}>{crystalBalance}</Text>
      <Text style={styles.crystalPlus}>+</Text>
    </TouchableOpacity>
  ) : null;

  const blackBadge = hasPremium ? (
    <TouchableOpacity
      testID="header-black-badge"
      accessibilityRole="button"
      accessibilityLabel="Arena Black VIP"
      onPress={() => setPremiumOpen(true)}
      style={styles.headerBlackBadge}
    >
      <Text style={styles.headerBlackBadgeText}>👑 BLACK</Text>
    </TouchableOpacity>
  ) : null;

  const modals = (
    <>
      <BurgerMenuDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOpenWallet={() => setWalletOpen(true)}
        onOpenPremium={() => setPremiumOpen(true)}
        crystalBalance={crystalBalance}
        hasPremium={hasPremium}
      />
      <WalletModal
        visible={walletOpen}
        onClose={() => setWalletOpen(false)}
      />
      <PremiumModal
        visible={premiumOpen}
        onClose={() => setPremiumOpen(false)}
      />
    </>
  );

  return children({
    burgerButton,
    crystalPill,
    blackBadge,
    arenaBrand,
    modals,
    showBrandSubHeader: false,
  });
}

export function Screen({
  title,
  children,
  scroll = true,
  headerRight,
  hideBottomLanguage = true,
  hideDrawer = false,
  hideHeaderTitle,
  showBrandSubHeader,
  showCrystalInHeader = false,
}: PropsWithChildren<{
  title: string;
  scroll?: boolean;
  headerRight?: ReactNode;
  hideBottomLanguage?: boolean;
  hideDrawer?: boolean;
  hideHeaderTitle?: boolean;
  showBrandSubHeader?: boolean;
  showCrystalInHeader?: boolean;
}>) {
  const queryClient = useContext(QueryClientContext);

  if (queryClient && !hideDrawer) {
    return (
      <AuthenticatedScreenFeatures showCrystalInHeader={showCrystalInHeader}>
        {({ burgerButton, crystalPill, blackBadge, arenaBrand, modals, showBrandSubHeader: authBrandSubHeader }) => (
          <ScreenBase
            title={title}
            scroll={scroll}
            headerRight={headerRight}
            hideBottomLanguage={hideBottomLanguage}
            burgerButton={burgerButton}
            crystalPill={crystalPill}
            blackBadge={blackBadge}
            arenaBrand={arenaBrand}
            modals={modals}
            showBrandSubHeader={showBrandSubHeader !== undefined ? showBrandSubHeader : authBrandSubHeader}
            hideHeaderTitle={hideHeaderTitle ?? true}
          >
            {children}
          </ScreenBase>
        )}
      </AuthenticatedScreenFeatures>
    );
  }

  const fallbackArenaBrand = (
    <View style={styles.headerArenaBrand} testID="header-arena-brand">
      <Image
        source={logoMarkSource}
        style={styles.headerArenaLogo}
        resizeMode="contain"
      />
      <Text style={styles.headerArenaTitle}>ARENA</Text>
    </View>
  );

  return (
    <ScreenBase
      title={title}
      scroll={scroll}
      headerRight={headerRight}
      hideBottomLanguage={hideBottomLanguage}
      burgerButton={null}
      crystalPill={null}
      blackBadge={null}
      arenaBrand={fallbackArenaBrand}
      modals={null}
      showBrandSubHeader={showBrandSubHeader ?? false}
      hideHeaderTitle={hideHeaderTitle ?? false}
    >
      {children}
    </ScreenBase>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 20, flexGrow: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 42,
    gap: 8,
  },
  headerLeftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    minWidth: 70,
  },
  headerCenterCluster: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    flexShrink: 0,
    minWidth: 70,
  },
  heading: { gap: 6, flex: 1 },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  burgerButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burgerIcon: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: '800',
    lineHeight: 22,
  },
  crystalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(147, 51, 234, 0.16)',
    borderWidth: 1,
    borderColor: '#a855f7',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  crystalEmoji: {
    fontSize: 13,
  },
  crystalCount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f1f5f9',
  },
  crystalPlus: {
    fontSize: 12,
    fontWeight: '900',
    color: '#c084fc',
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 4 },
  flagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  flagEmoji: { fontSize: 16, lineHeight: 20 },
  flagLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  headerBlackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1.2,
    borderColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  headerBlackBadgeText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  headerArenaBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 6,
  },
  headerArenaLogo: {
    width: 20,
    height: 20,
  },
  headerArenaTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2.2,
    color: '#F8FAFC',
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: theme.colors.text,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  body: { gap: 20 },
  stickyHeaderBlock: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 12 : 8,
    paddingBottom: 8,
    width: '100%',
    backgroundColor: theme.colors.background,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    ...(Platform.OS === 'web' ? { position: 'sticky' as any, top: 0 } : {}),
  },
  headerBlock: {
    gap: 8,
    width: '100%',
  },
  nonScrollHeaderBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
    gap: 8,
    width: '100%',
  },
  brandSubHeader: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandSubHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(147, 51, 234, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 18,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  brandSubHeaderLogo: {
    width: 20,
    height: 20,
  },
  brandSubHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#F8FAFC',
  },
});
