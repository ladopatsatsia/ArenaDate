import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { COUNTRIES, POPULAR_COUNTRIES, findCountry, type CountryItem } from './countries';
import { theme } from './theme';
import { triggerHaptic } from '../telegram/telegramSdk';

interface CountryPickerProps {
  value: string; // country label or key
  onChange: (countryLabel: string, countryKey: string) => void;
  disabled?: boolean;
  testID?: string;
}

export function CountryPicker({
  value,
  onChange,
  disabled = false,
  testID,
}: CountryPickerProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language || 'ka';
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentCountry = useMemo(() => {
    return findCountry(value) || COUNTRIES[0];
  }, [value]);

  const currentLabel = useMemo(() => {
    if (!currentCountry) return value || 'საქართველო';
    return currentLang === 'en'
      ? currentCountry.labelEn
      : currentLang === 'ru'
      ? currentCountry.labelRu
      : currentCountry.labelKa;
  }, [currentCountry, currentLang, value]);

  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.labelKa.toLowerCase().includes(q) ||
      c.labelEn.toLowerCase().includes(q) ||
      c.labelRu.toLowerCase().includes(q) ||
      c.key.toLowerCase().includes(q) ||
      c.aliases?.some(a => a.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const handleSelect = (c: CountryItem) => {
    triggerHaptic('light');
    const label = currentLang === 'en' ? c.labelEn : currentLang === 'ru' ? c.labelRu : c.labelKa;
    onChange(label, c.key);
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <View style={styles.container}>
      {/* Selected Country Card / Trigger */}
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={() => {
          if (!disabled) {
            triggerHaptic('light');
            setModalVisible(true);
          }
        }}
        style={({ pressed }) => [
          styles.countryCard,
          pressed && !disabled && styles.countryCardPressed,
        ]}
      >
        <View style={styles.countryInfo}>
          <Text style={styles.countryFlag}>{currentCountry?.flag || '🌐'}</Text>
          <View>
            <Text style={styles.countrySubLabel}>{t('discovery_country_selected', 'არჩეული ქვეყანა')}</Text>
            <Text style={styles.countryName}>{currentLabel}</Text>
          </View>
        </View>

        <View style={styles.changeBtn}>
          <Text style={styles.changeBtnText}>{t('change', 'შეცვლა')} ›</Text>
        </View>
      </Pressable>

      {/* Country Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                🌍 {t('select_country_title', 'აირჩიეთ ქვეყანა')}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('cancel')}
                onPress={() => {
                  setModalVisible(false);
                  setSearchQuery('');
                }}
                hitSlop={8}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* Search Input */}
            <TextInput
              placeholder={t('search_country', 'ქვეყნის ძიება...')}
              placeholderTextColor={theme.colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.modalSearchInput}
              autoFocus={Platform.OS !== 'web'}
            />

            {/* Popular Countries Pills */}
            {!searchQuery && (
              <View style={styles.popularWrap}>
                <Text style={styles.popularTitle}>{t('popular_countries', 'პოპულარული:')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularRow}>
                  {POPULAR_COUNTRIES.map(p => {
                    const label = currentLang === 'en' ? p.labelEn : currentLang === 'ru' ? p.labelRu : p.labelKa;
                    const isSelected = currentCountry?.key === p.key;
                    return (
                      <Pressable
                        key={p.key}
                        onPress={() => handleSelect(p)}
                        style={[styles.popularPill, isSelected && styles.popularPillSelected]}
                      >
                        <Text style={styles.popularPillFlag}>{p.flag}</Text>
                        <Text style={[styles.popularPillText, isSelected && styles.popularPillTextSelected]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Country List */}
            <ScrollView style={styles.countryListScroll} keyboardShouldPersistTaps="handled">
              {filteredCountries.map(c => {
                const label = currentLang === 'en' ? c.labelEn : currentLang === 'ru' ? c.labelRu : c.labelKa;
                const isSelected = currentCountry?.key === c.key;

                return (
                  <Pressable
                    key={c.key}
                    onPress={() => handleSelect(c)}
                    style={({ pressed }) => [
                      styles.countryItemRow,
                      isSelected && styles.countryItemRowSelected,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={styles.countryItemLeft}>
                      <Text style={styles.countryItemFlag}>{c.flag}</Text>
                      <Text style={[styles.countryItemText, isSelected && styles.countryItemTextSelected]}>
                        {label}
                      </Text>
                    </View>

                    {isSelected && <Text style={styles.countryItemCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  countryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(251, 113, 133, 0.35)',
    borderRadius: 16,
    padding: 14,
  },
  countryCardPressed: {
    opacity: 0.8,
  },
  countryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countryFlag: {
    fontSize: 26,
  },
  countrySubLabel: {
    fontSize: 11,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  countryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  changeBtn: {
    backgroundColor: 'rgba(251, 113, 133, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeBtnText: {
    color: '#FB7185',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1E172E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  modalSearchInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  popularWrap: {
    marginBottom: 12,
    gap: 6,
  },
  popularTitle: {
    fontSize: 11,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  popularRow: {
    flexDirection: 'row',
    gap: 8,
  },
  popularPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  popularPillSelected: {
    backgroundColor: 'rgba(251, 113, 133, 0.2)',
    borderColor: '#FB7185',
  },
  popularPillFlag: {
    fontSize: 16,
  },
  popularPillText: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '600',
  },
  popularPillTextSelected: {
    color: '#FB7185',
    fontWeight: '700',
  },
  countryListScroll: {
    maxHeight: 380,
  },
  countryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
  },
  countryItemRowSelected: {
    backgroundColor: 'rgba(251, 113, 133, 0.15)',
  },
  countryItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countryItemFlag: {
    fontSize: 22,
  },
  countryItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  countryItemTextSelected: {
    color: '#FB7185',
    fontWeight: '700',
  },
  countryItemCheck: {
    color: '#FB7185',
    fontSize: 16,
    fontWeight: '900',
  },
});
