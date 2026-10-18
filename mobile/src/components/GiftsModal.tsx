import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { Card, Text, Button } from './UI';
import { GameApi, type GiftItemDto } from '../game/GameApi';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import type { Photo } from '../profile/api';

export interface GiftsModalProps {
  visible: boolean;
  onClose: () => void;
  gameApi?: GameApi;
}

export function GiftsModal({ visible, onClose, gameApi: customGameApi }: GiftsModalProps) {
  const { t } = useTranslation();
  const { api, manager } = useAuth();
  const [tab, setTab] = useState<'received' | 'sent'>('received');

  const gameApi = customGameApi ?? new GameApi(api, manager);

  const giftsQuery = useQuery({
    queryKey: ['user-gifts'],
    queryFn: () => gameApi.getUserGifts(),
    enabled: visible,
    refetchOnWindowFocus: true,
  });

  const gifts = giftsQuery.data;
  const list: GiftItemDto[] = tab === 'received' ? (gifts?.receivedGifts ?? []) : (gifts?.sentGifts ?? []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      testID="gifts-modal"
    >
      <View style={styles.modalOverlay}>
        <Card style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleCol}>
              <Text style={styles.modalTitle}>🎁 {t('gifts_title', 'საჩუქრები')}</Text>
              <Text style={styles.modalSubtitle}>
                {t('menu_gifts_sub', 'მიღებული და გაცემული საჩუქრები')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              style={styles.closeIconBtn}
              testID="close-gifts-modal-x"
            >
              <Text style={styles.closeIconText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Overall Stats Banner */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>
                📥 {gifts?.totalReceivedCount ?? 0}
              </Text>
              <Text style={styles.summaryLbl}>
                {t('gifts_total_received', 'სულ მიღებული')}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>
                💎 {gifts?.totalReceivedCrystalsValue ?? 0}
              </Text>
              <Text style={styles.summaryLbl}>{t('gifts_value', 'ღირებულება')}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>
                📤 {gifts?.totalSentCount ?? 0}
              </Text>
              <Text style={styles.summaryLbl}>
                {t('gifts_total_sent', 'სულ გაცემული')}
              </Text>
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'received' && styles.tabBtnActive]}
              onPress={() => setTab('received')}
              activeOpacity={0.7}
              testID="gifts-tab-received"
            >
              <Text style={[styles.tabBtnText, tab === 'received' && styles.tabBtnTextActive]}>
                📥 {t('gifts_received_tab', 'მიღებული')} ({gifts?.totalReceivedCount ?? 0})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'sent' && styles.tabBtnActive]}
              onPress={() => setTab('sent')}
              activeOpacity={0.7}
              testID="gifts-tab-sent"
            >
              <Text style={[styles.tabBtnText, tab === 'sent' && styles.tabBtnTextActive]}>
                📤 {t('gifts_sent_tab', 'გაცემული')} ({gifts?.totalSentCount ?? 0})
              </Text>
            </TouchableOpacity>
          </View>

          {/* List of Gifts */}
          <ScrollView style={styles.giftsList} showsVerticalScrollIndicator={false}>
            {giftsQuery.isLoading ? (
              <View style={styles.emptyBox}>
                <Text style={styles.loadingText}>
                  {t('gifts_loading', 'იტვირთება საჩუქრები...')}
                </Text>
              </View>
            ) : list.length > 0 ? (
              list.map((item) => (
                <View key={item.id} style={styles.giftCard} testID={`gift-card-${item.id}`}>
                  <View style={styles.avatarWrap}>
                    {item.otherPhoto ? (
                      <PrivatePhoto
                        photo={item.otherPhoto as unknown as Photo}
                        avatar={true}
                        style={styles.avatarImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarEmoji}>👤</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.giftInfoCol}>
                    <Text style={styles.giftOtherName} numberOfLines={1}>
                      {item.otherDisplayName}
                    </Text>
                    <Text style={styles.giftDate}>
                      {new Date(item.createdAtUtc).toLocaleDateString()} {new Date(item.createdAtUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>

                  <View style={styles.giftBadgeCol}>
                    <Text style={styles.giftIconEmoji}>{item.giftIcon}</Text>
                    <Text style={styles.giftCostBadge}>💎 {item.crystalCost}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>{tab === 'received' ? '🎁' : '📤'}</Text>
                <Text style={styles.emptyText}>
                  {tab === 'received'
                    ? t('gifts_empty_received', 'მიღებული საჩუქრები ჯერ არ გაქვს')
                    : t('gifts_empty_sent', 'საჩუქრები ჯერ არ გაგიგზავნია')}
                </Text>
                <Text style={styles.emptySubtext}>
                  {t('gifts_how_to_send', 'საჩუქრის ჩუქება შეგიძლია ARENA-ს ბოთლის თამაშის მაგიდაზე ნებისმიერი მოთამაშისთვის!')}
                </Text>
              </View>
            )}
          </ScrollView>

          <Button
            variant="secondary"
            title={t('close', 'დახურვა')}
            onPress={onClose}
            style={styles.closeBtn}
            testID="close-gifts-modal-button"
          />
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    backgroundColor: '#1e1b2e',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.25)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleCol: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeIconBtn: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    marginLeft: 10,
  },
  closeIconText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: 'bold',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(147, 51, 234, 0.15)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(147, 51, 234, 0.3)',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryVal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#f472b6',
  },
  summaryLbl: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#db2777',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabBtnTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  giftsList: {
    maxHeight: 320,
    marginBottom: 12,
  },
  giftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#334155',
    marginRight: 12,
  },
  avatarImg: {
    width: 44,
    height: 44,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 20,
  },
  giftInfoCol: {
    flex: 1,
  },
  giftOtherName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  giftDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  giftBadgeCol: {
    alignItems: 'center',
    marginLeft: 8,
  },
  giftIconEmoji: {
    fontSize: 24,
  },
  giftCostBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a855f7',
    marginTop: 2,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  closeBtn: {
    marginTop: 4,
  },
});
