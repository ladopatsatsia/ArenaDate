import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text, Button } from './UI';
import { theme } from './theme';
import {
  LANGUAGES,
  POPULAR_LANGUAGES,
  searchLanguages,
  type LanguageItem,
} from './languages';

export interface LanguagePickerModalProps {
  visible: boolean;
  selected: string[];
  onSave: (languages: string[]) => void;
  onClose: () => void;
  maxCount?: number;
}

export function LanguagePickerModal({
  visible,
  selected: initialSelected,
  onSave,
  onClose,
  maxCount = 8,
}: LanguagePickerModalProps) {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language === 'en' ? 'en' : 'ka';

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(initialSelected ?? []);

  // Sync initialSelected when modal opens
  React.useEffect(() => {
    if (visible) {
      setSelected(initialSelected ?? []);
      setQuery('');
    }
  }, [visible, initialSelected]);

  const filtered = useMemo(() => {
    return searchLanguages(query, currentLang);
  }, [query, currentLang]);

  const handleToggle = (langName: string) => {
    if (selected.includes(langName)) {
      setSelected(selected.filter(s => s !== langName));
    } else {
      if (selected.length >= maxCount) {
        return;
      }
      setSelected([...selected, langName]);
    }
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
  };

  const renderItem = ({ item }: { item: LanguageItem }) => {
    const isSelected = selected.includes(item.name);
    const isLimitReached = selected.length >= maxCount && !isSelected;

    const label = currentLang === 'en' ? item.labelEn : item.labelKa;
    const subLabel = item.native !== label ? item.native : (currentLang === 'ka' ? item.labelEn : item.labelKa);

    return (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected, disabled: isLimitReached }}
        disabled={isLimitReached}
        onPress={() => handleToggle(item.name)}
        style={({ pressed }) => [
          styles.rowItem,
          isSelected && styles.rowItemSelected,
          pressed && !isLimitReached && styles.rowItemPressed,
          isLimitReached && styles.rowItemDisabled,
        ]}
      >
        <View style={styles.flagBadge}>
          <Text style={styles.flagEmoji}>{item.flag}</Text>
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.mainLabel, isSelected && styles.mainLabelSelected]}>
            {label}
          </Text>
          {!!subLabel && (
            <Text style={styles.subLabel}>
              {subLabel}
            </Text>
          )}
        </View>

        <View
          style={[
            styles.checkCircle,
            isSelected && styles.checkCircleActive,
            isLimitReached && styles.checkCircleDisabled,
          ]}
        >
          {isSelected && <Text style={styles.checkCheckText}>✓</Text>}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={styles.headerTitle}>
              🗣️ {t('profile_languages', { defaultValue: 'სალაპარაკო ენები' })}
            </Text>
            <Text style={styles.headerSubtitle}>
              {t('lang_picker_sub', {
                count: maxCount,
                selected: selected.length,
                defaultValue: `აირჩიე მაქსიმუმ ${maxCount} ენა (${selected.length}/${maxCount})`,
              })}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('cancel')}
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('lang_picker_search_placeholder', 'მოძებნე ენა (მაგ. ინგლისური, Deutsch...)')}
            placeholderTextColor={theme.colors.muted}
            style={styles.searchInput}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {!!query && (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={8}
              style={styles.searchClearBtn}
            >
              <Text style={styles.searchClearText}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Selected Chips Preview */}
        {selected.length > 0 && (
          <View style={styles.selectedSection}>
            <Text style={styles.sectionHeader}>
              {t('lang_picker_selected_header', 'არჩეული ენები:')}
            </Text>
            <View style={styles.selectedChipsWrap}>
              {selected.map(langName => {
                const item = LANGUAGES.find(l => l.name === langName);
                const flag = item?.flag ?? '🌐';
                const label = item ? (currentLang === 'en' ? item.labelEn : item.labelKa) : langName;
                return (
                  <Pressable
                    key={langName}
                    onPress={() => handleToggle(langName)}
                    style={styles.selectedChip}
                  >
                    <Text style={styles.selectedChipText}>{flag} {label}</Text>
                    <Text style={styles.selectedChipRemove}>✕</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Popular Quick Suggestions (if no search query) */}
        {!query && (
          <View style={styles.popularSection}>
            <Text style={styles.sectionHeader}>
              {t('lang_picker_popular_header', 'პოპულარული ენები:')}
            </Text>
            <View style={styles.popularPillsWrap}>
              {POPULAR_LANGUAGES.map(item => {
                const isSelected = selected.includes(item.name);
                const isLimitReached = selected.length >= maxCount && !isSelected;
                const label = currentLang === 'en' ? item.labelEn : item.labelKa;
                return (
                  <Pressable
                    key={item.code}
                    disabled={isLimitReached}
                    onPress={() => handleToggle(item.name)}
                    style={[
                      styles.popularPill,
                      isSelected && styles.popularPillActive,
                      isLimitReached && styles.popularPillDisabled,
                    ]}
                  >
                    <Text style={[styles.popularPillText, isSelected && styles.popularPillTextActive]}>
                      {item.flag} {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* All Languages List */}
        <FlatList
          data={filtered}
          keyExtractor={item => item.code + '-' + item.name}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {t('lang_picker_not_found', 'ენა ვერ მოიძებნა')}
              </Text>
            </View>
          }
        />

        {/* Bottom Save Bar */}
        <View style={styles.bottomBar}>
          <Button
            variant="primary"
            title={`${t('profile_save', { defaultValue: 'შენახვა' })} (${selected.length}/${maxCount})`}
            onPress={handleSave}
            style={styles.saveBtn}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  closeBtnText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 48,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.text,
    paddingVertical: 10,
  },
  searchClearBtn: {
    padding: 6,
  },
  searchClearText: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  selectedChipText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  selectedChipRemove: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  popularSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  popularPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  popularPill: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  popularPillActive: {
    backgroundColor: '#3B2064',
    borderColor: theme.colors.primary,
  },
  popularPillDisabled: {
    opacity: 0.4,
  },
  popularPillText: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  popularPillTextActive: {
    color: '#E9D5FF',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowItemSelected: {
    backgroundColor: '#261B3D',
    borderColor: theme.colors.primary,
  },
  rowItemPressed: {
    opacity: 0.8,
  },
  rowItemDisabled: {
    opacity: 0.35,
  },
  flagBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  flagEmoji: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
    gap: 2,
  },
  mainLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  mainLabelSelected: {
    color: '#F3E8FF',
    fontWeight: '700',
  },
  subLabel: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkCircleDisabled: {
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  checkCheckText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.muted,
    fontSize: 15,
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: theme.colors.background,
  },
  saveBtn: {
    borderRadius: 16,
  },
});
