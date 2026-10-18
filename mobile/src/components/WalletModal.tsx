import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { Text, Button } from './UI';
import { GameApi } from '../game/GameApi';
import { StoreBillingService, LocalizedStoreProduct } from '../game/StoreBillingService';

export interface WalletModalProps {
  visible: boolean;
  onClose: () => void;
  gameApi?: GameApi;
}

interface WalletModalContentProps {
  visible: boolean;
  onClose: () => void;
  gameApi: GameApi;
}

function WalletModalContent({ visible, onClose, gameApi }: WalletModalContentProps) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const storeBillingService = useMemo(() => new StoreBillingService(gameApi), [gameApi]);

  const [purchasingProductId, setPurchasingProductId] = useState<string | null>(null);
  const [purchaseStatusMsg, setPurchaseStatusMsg] = useState<string | null>(null);
  const [purchaseStatusType, setPurchaseStatusType] = useState<'pending' | 'success' | 'error' | null>(null);

  const walletQuery = useQuery({
    queryKey: ['game-wallet'],
    queryFn: () => gameApi.getWallet(),
    enabled: visible,
  });

  const storeProductsQuery = useQuery({
    queryKey: ['store-products'],
    queryFn: () => storeBillingService.getProducts(),
    enabled: visible,
  });

  const handlePurchase = async (product: LocalizedStoreProduct) => {
    setPurchasingProductId(product.productId);
    setPurchaseStatusType('pending');
    setPurchaseStatusMsg(t('wallet_processing_purchase', 'მუშავდება შეძენა...'));
    try {
      await storeBillingService.purchaseProduct(product, (state) => {
        if (state.status === 'purchasing') setPurchaseStatusMsg(t('wallet_connecting_store', 'მაღაზიასთან დაკავშირება...'));
        else if (state.status === 'verifying') setPurchaseStatusMsg(t('wallet_verifying_tx', 'ტრანზაქციის ვერიფიკაცია სერვერზე...'));
      });
      await cache.invalidateQueries({ queryKey: ['game-wallet'] });
      setPurchaseStatusType('success');
      setPurchaseStatusMsg(t('wallet_purchase_success', { amount: product.crystalAmount, defaultValue: `✓ წარმატებით შეძენილია ${product.crystalAmount} 💎` }));
      setTimeout(() => {
        setPurchaseStatusMsg(null);
        setPurchaseStatusType(null);
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('wallet_purchase_failed', 'შეძენა ვერ მოხერხდა');
      setPurchaseStatusType('error');
      setPurchaseStatusMsg(t('wallet_error_prefix', { msg, defaultValue: `შეცდომა: ${msg}` }));
    } finally {
      setPurchasingProductId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="wallet-modal"
    >
      <View style={styles.modalOverlay}>
        <View style={styles.walletModalContent}>
          {/* Fixed Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconCircle}>
                <Text style={styles.headerIconEmoji}>💎</Text>
              </View>
              <Text style={styles.modalTitle}>
                {t('wallet_crystals_wallet', 'კრისტალების საფულე')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
              testID="close-wallet-modal-button"
              accessibilityLabel={t('close', 'დახურვა')}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Body */}
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            bounces={true}
          >
            {/* Balance Card */}
            <View style={styles.walletBalanceBox}>
              <Text style={styles.walletBalanceLabel}>
                {t('menu_available_crystals', 'ხელმისაწვდომი ბალანსი')}
              </Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceIcon}>💎</Text>
                <Text style={styles.walletBalanceValue} testID="wallet-balance-amount">
                  {walletQuery.data?.balance ?? 0}
                </Text>
              </View>
              <Text style={styles.balanceSubtext}>
                {t('wallet_usage_desc', 'გამოიყენე არენაზე ბოთლის დასატრიალებლად და ჩატების გასახსნელად')}
              </Text>
              {Number(walletQuery.data?.outstandingDebt ?? 0) > 0 && (
                <View style={styles.debtBox}>
                  <Text style={styles.debtNotice}>
                    {t('wallet_debt_warning', {
                      debt: walletQuery.data?.outstandingDebt,
                      defaultValue: `⚠️ არსებული დავალიანება: 💎 ${walletQuery.data?.outstandingDebt} (დაიფარება შემდეგი შეძენით)`,
                    })}
                  </Text>
                </View>
              )}
            </View>

            {/* Store packages */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.walletStoreHeading}>
                🛍️ {t('menu_buy', 'კრისტალების შეძენა')}
              </Text>
              <Text style={styles.sectionSubHeading}>
                {t('wallet_telegram_stars_note', 'სწრაფი და უსაფრთხო გადახდა Telegram Stars-ით')}
              </Text>
            </View>

            {storeProductsQuery.data?.map((p) => {
              const isPopular = p.crystalAmount === 500;
              const isBestValue = p.crystalAmount === 1200;
              const badge = isPopular
                ? t('wallet_popular_badge', '🔥 პოპულარული')
                : isBestValue
                ? t('wallet_bonus_badge', '⭐ +20% ბონუსი')
                : null;

              return (
                <View
                  key={p.productId}
                  style={[
                    styles.storeOfferCard,
                    isPopular && styles.cardPopular,
                    isBestValue && styles.cardBestValue,
                  ]}
                >
                  {badge && (
                    <View
                      style={[
                        styles.cardBadge,
                        isPopular ? styles.badgePopular : styles.badgeBestValue,
                      ]}
                    >
                      <Text style={styles.cardBadgeText}>{badge}</Text>
                    </View>
                  )}

                  <View style={styles.cardContent}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.storeOfferTitle}>{p.title}</Text>
                      <Text style={styles.storeOfferDesc}>{p.description}</Text>
                    </View>

                    <Button
                      variant="primary"
                      title={purchasingProductId === p.productId ? '...' : p.localizedPrice}
                      onPress={() => handlePurchase(p)}
                      disabled={!!purchasingProductId}
                      style={[
                        styles.storeBuyBtn,
                        isPopular && styles.buyBtnPopular,
                        isBestValue && styles.buyBtnBestValue,
                      ]}
                      textStyle={styles.storeBuyBtnText}
                      testID={`buy-product-${p.productId}`}
                    />
                  </View>
                </View>
              );
            })}

            {/* Purchase Status Banner */}
            {purchaseStatusMsg && (
              <View
                style={[
                  styles.statusBanner,
                  purchaseStatusType === 'success' || purchaseStatusMsg.startsWith('✓')
                    ? styles.statusSuccess
                    : purchaseStatusType === 'error'
                    ? styles.statusError
                    : styles.statusPending,
                ]}
              >
                <Text
                  style={[
                    styles.purchaseStatusText,
                    purchaseStatusType === 'success' || purchaseStatusMsg.startsWith('✓')
                      ? styles.statusTextSuccess
                      : purchaseStatusType === 'error'
                      ? styles.statusTextError
                      : styles.statusTextPending,
                  ]}
                >
                  {purchaseStatusMsg}
                </Text>
              </View>
            )}

            {/* Recent transactions */}
            <Text style={styles.walletTxHeading}>
              {t('wallet_recent_tx', '📜 ბოლო ტრანზაქციები')}
            </Text>
            <View style={styles.walletTxContainer}>
              {walletQuery.data?.recentTransactions && walletQuery.data.recentTransactions.length > 0 ? (
                walletQuery.data.recentTransactions.map((tx) => (
                  <View key={tx.id} style={styles.walletTxItem}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.walletTxDesc}>{tx.description || tx.type}</Text>
                      <Text style={styles.walletTxDate}>
                        {new Date(tx.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.walletTxAmount,
                        Number(tx.amount) > 0 ? styles.txPositive : styles.txNegative,
                      ]}
                    >
                      {Number(tx.amount) > 0 ? `+${tx.amount}` : tx.amount} 💎
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.walletEmptyTx}>
                  {t('wallet_empty_tx', 'ტრანზაქციები ჯერ არ არის')}
                </Text>
              )}
            </View>

            {/* Dev grant */}
            {process.env.NODE_ENV !== 'production' && (
              <Button
                variant="secondary"
                title={t('wallet_dev_grant_title', '+100 კრისტალი (Dev Grant)')}
                onPress={async () => {
                  try {
                    await gameApi.devGrant(100, Crypto.randomUUID());
                    await cache.invalidateQueries({ queryKey: ['game-wallet'] });
                  } catch {
                    // ignore
                  }
                }}
                style={styles.devGrantBtn}
                testID="dev-grant-button"
              />
            )}

            {/* Bottom Close Button */}
            <Button
              variant="secondary"
              title={t('close', 'დახურვა')}
              onPress={onClose}
              style={styles.bottomCloseBtn}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function WalletModalWithAuth({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { api, manager } = useAuth();
  const gameApi = useMemo(() => new GameApi(api, manager), [api, manager]);
  return <WalletModalContent visible={visible} onClose={onClose} gameApi={gameApi} />;
}

export function WalletModal({ visible, onClose, gameApi }: WalletModalProps) {
  if (gameApi) {
    return <WalletModalContent visible={visible} onClose={onClose} gameApi={gameApi} />;
  }
  return <WalletModalWithAuth visible={visible} onClose={onClose} />;
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 18, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  walletModalContent: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '90%',
    backgroundColor: '#131132',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.4)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
    elevation: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
    backgroundColor: '#161339',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIconEmoji: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  modalScrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 26,
  },
  walletBalanceBox: {
    backgroundColor: 'rgba(30, 26, 70, 0.95)',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.45)',
  },
  walletBalanceLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 2,
  },
  balanceIcon: {
    fontSize: 28,
  },
  walletBalanceValue: {
    color: '#38bdf8',
    fontSize: 36,
    fontWeight: '900',
  },
  balanceSubtext: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  debtBox: {
    marginTop: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  debtNotice: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionHeaderRow: {
    marginBottom: 12,
  },
  walletStoreHeading: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionSubHeading: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  storeOfferCard: {
    backgroundColor: 'rgba(26, 22, 64, 0.75)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.28)',
    position: 'relative',
  },
  cardPopular: {
    borderColor: 'rgba(236, 72, 153, 0.6)',
    backgroundColor: 'rgba(35, 25, 75, 0.85)',
  },
  cardBestValue: {
    borderColor: 'rgba(234, 179, 8, 0.6)',
    backgroundColor: 'rgba(40, 30, 75, 0.85)',
  },
  cardBadge: {
    position: 'absolute',
    top: -10,
    left: 14,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 1,
  },
  badgePopular: {
    backgroundColor: '#ec4899',
  },
  badgeBestValue: {
    backgroundColor: '#eab308',
  },
  cardBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  cardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardInfo: {
    flex: 1,
  },
  storeOfferTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  storeOfferDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 3,
  },
  storeBuyBtn: {
    minWidth: 98,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#8b5cf6',
    borderColor: '#a855f7',
  },
  buyBtnPopular: {
    backgroundColor: '#ec4899',
    borderColor: '#f43f5e',
  },
  buyBtnBestValue: {
    backgroundColor: '#d97706',
    borderColor: '#f59e0b',
  },
  storeBuyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  statusBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 8,
    borderWidth: 1,
  },
  statusSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  statusError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  statusPending: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  purchaseStatusText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  statusTextSuccess: {
    color: '#4ade80',
  },
  statusTextError: {
    color: '#f87171',
  },
  statusTextPending: {
    color: '#c084fc',
  },
  walletTxHeading: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 8,
  },
  walletTxContainer: {
    backgroundColor: 'rgba(20, 17, 50, 0.7)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    marginBottom: 14,
  },
  walletTxItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  walletTxDesc: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '500',
  },
  walletTxDate: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  walletTxAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  txPositive: {
    color: '#4ade80',
  },
  txNegative: {
    color: '#f87171',
  },
  walletEmptyTx: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 12,
  },
  devGrantBtn: {
    marginBottom: 8,
  },
  bottomCloseBtn: {
    marginTop: 4,
  },
});
