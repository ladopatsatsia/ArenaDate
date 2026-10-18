import React, { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './UI';
import { theme } from './theme';
import { CITIES, formatCityName } from './cities';
import { detectLocationAndCity } from '../discovery/location';

export interface CityPickerProps {
  value: string;
  onChange: (city: string) => void;
  onLocationDetected?: (coords: { latitude: number; longitude: number; city: string }) => void;
  showGpsButton?: boolean;
  label?: string;
  error?: string;
  testID?: string;
}

export function CityPicker({
  value,
  onChange,
  onLocationDetected,
  label,
  error,
  testID = 'city-picker',
}: CityPickerProps) {
  const { t, i18n } = useTranslation();
  const [gpsBusy, setGpsBusy] = useState(false);
  const [listModalVisible, setListModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentLang = i18n.language || 'ka';
  const displayedLocation = value ? formatCityName(value, currentLang) : '';

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return CITIES;
    const q = searchQuery.trim().toLowerCase();
    return CITIES.filter(c =>
      c.labelKa.toLowerCase().includes(q) ||
      c.labelEn.toLowerCase().includes(q) ||
      c.labelRu.toLowerCase().includes(q) ||
      c.key.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleDetectGps = async () => {
    setGpsBusy(true);
    // Hard safety timeout of 7.5 seconds so gpsBusy ALWAYS resets and never hangs
    const safetyTimer = setTimeout(() => {
      setGpsBusy(false);
    }, 7500);

    try {
      const result = await detectLocationAndCity(true, currentLang === 'en' ? 'en' : 'ka');
      if (result.cityName) {
        onChange(result.cityName);
        if (onLocationDetected) {
          onLocationDetected({
            latitude: result.latitude,
            longitude: result.longitude,
            city: result.cityName,
          });
        }
      } else if (onLocationDetected) {
        onLocationDetected({
          latitude: result.latitude,
          longitude: result.longitude,
          city: value || (currentLang === 'en' ? 'Tbilisi' : currentLang === 'ru' ? 'Тбилиси' : 'თბილისი'),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error && err.message === 'location_denied'
        ? t('location_denied')
        : t('location_unavailable');
      Alert.alert(t('error'), msg);
    } finally {
      clearTimeout(safetyTimer);
      setGpsBusy(false);
    }
  };

  return (
    <View testID={testID} style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      {value ? (
        /* Detected Location Display Card */
        <View style={[styles.card, !!error && styles.cardError]}>
          <View style={styles.infoRow}>
            <View style={styles.pinCircle}>
              <Text style={styles.pinIcon}>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subText}>{t('detected_location')}</Text>
              <Text style={styles.locationText} numberOfLines={1}>
                {displayedLocation}
              </Text>
            </View>

            {/* Red X Clear Button right next to location */}
            <Pressable
              testID={`${testID}-clear-btn`}
              accessibilityRole="button"
              accessibilityLabel={t('clear')}
              disabled={gpsBusy}
              onPress={() => onChange('')}
              hitSlop={10}
              style={({ pressed }) => [
                styles.redCloseBtn,
                pressed && { opacity: 0.7, transform: [{ scale: 0.94 }] },
              ]}
            >
              <Text style={styles.redCloseText}>✕</Text>
            </Pressable>
          </View>

          {/* Full-width Update Button */}
          <Pressable
            testID={`${testID}-detect-btn`}
            accessibilityRole="button"
            accessibilityLabel={t('update_location')}
            disabled={gpsBusy}
            onPress={() => { void handleDetectGps(); }}
            style={({ pressed }) => [
              styles.updateBtnFull,
              pressed && { opacity: 0.8 },
              gpsBusy && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.updateBtnText}>
              {gpsBusy ? `⏳ ${t('working')}` : `🔄 ${t('update_location')}`}
            </Text>
          </Pressable>

          {/* Manual Select from List Button */}
          <Pressable
            testID={`${testID}-select-list-btn`}
            accessibilityRole="button"
            accessibilityLabel={t('select_city_from_list', 'ქალაქის არჩევა სიიდან')}
            disabled={gpsBusy}
            onPress={() => setListModalVisible(true)}
            style={({ pressed }) => [
              styles.manualListBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.manualListBtnText}>
              📋 {t('select_city_from_list', 'ქალაქის არჩევა სიიდან')}
            </Text>
          </Pressable>
        </View>
      ) : (
        /* Location Not Set State */
        <View style={[styles.card, styles.emptyCard, !!error && styles.cardError]}>
          <View style={styles.infoRow}>
            <View style={[styles.pinCircle, styles.pinCircleEmpty]}>
              <Text style={styles.pinIconEmpty}>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.subText}>{t('select_city')}</Text>
              <Text style={styles.emptyText}>{t('location_not_set')}</Text>
            </View>
          </View>

          {/* Full-width Detect Button */}
          <Pressable
            testID={`${testID}-detect-btn`}
            accessibilityRole="button"
            accessibilityLabel={t('detect_location')}
            disabled={gpsBusy}
            onPress={() => { void handleDetectGps(); }}
            style={({ pressed }) => [
              styles.detectBtnFull,
              pressed && { opacity: 0.85 },
              gpsBusy && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.detectBtnText}>
              {gpsBusy ? `⏳ ${t('working')}` : `📍 ${t('detect_location')}`}
            </Text>
          </Pressable>

          {/* Manual Select from List Button */}
          <Pressable
            testID={`${testID}-select-list-btn`}
            accessibilityRole="button"
            accessibilityLabel={t('select_city_from_list', 'ქალაქის არჩევა სიიდან')}
            disabled={gpsBusy}
            onPress={() => setListModalVisible(true)}
            style={({ pressed }) => [
              styles.manualListBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.manualListBtnText}>
              📋 {t('select_city_from_list', 'ქალაქის არჩევა სიიდან')}
            </Text>
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Manual City Selection Modal */}
      <Modal
        visible={listModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setListModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('city_select_title', 'აირჩიეთ ქალაქი')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('cancel')}
                onPress={() => setListModalVisible(false)}
                hitSlop={8}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </Pressable>
            </View>

            <TextInput
              placeholder={t('search', 'ძიება...')}
              placeholderTextColor={theme.colors.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.modalSearchInput}
            />

            <ScrollView style={styles.cityListScroll} keyboardShouldPersistTaps="handled">
              {filteredCities.map(city => {
                const label = currentLang === 'en' ? city.labelEn : currentLang === 'ru' ? city.labelRu : city.labelKa;
                const isSelected = value.toLowerCase() === city.key || value.toLowerCase() === label.toLowerCase();
                return (
                  <Pressable
                    key={city.key}
                    onPress={() => {
                      onChange(label);
                      if (onLocationDetected) {
                        onLocationDetected({
                          latitude: 41.7151,
                          longitude: 44.8271,
                          city: label,
                        });
                      }
                      setListModalVisible(false);
                    }}
                    style={({ pressed }) => [
                      styles.cityItemRow,
                      isSelected && styles.cityItemRowSelected,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Text style={[styles.cityItemText, isSelected && styles.cityItemTextSelected]}>
                      📍 {label}
                    </Text>
                    {isSelected && <Text style={styles.cityItemCheck}>✓</Text>}
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
  label: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  emptyCard: {
    borderStyle: 'dashed',
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  cardError: {
    borderColor: theme.colors.danger,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pinCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinCircleEmpty: {
    backgroundColor: 'rgba(185, 175, 203, 0.1)',
  },
  pinIcon: {
    fontSize: 20,
  },
  pinIconEmpty: {
    fontSize: 20,
    opacity: 0.6,
  },
  subText: {
    fontSize: 12,
    color: theme.colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  locationText: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.muted,
    marginTop: 2,
  },
  redCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(251, 113, 133, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  redCloseText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  updateBtnFull: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 46,
  },
  updateBtnText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  detectBtnFull: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  detectBtnText: {
    color: theme.colors.onPrimary,
    fontWeight: '700',
    fontSize: 15,
  },
  manualListBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 42,
  },
  manualListBtnText: {
    color: theme.colors.text,
    fontWeight: '600',
    fontSize: 13,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
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
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  cityListScroll: {
    maxHeight: 360,
  },
  cityItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
  },
  cityItemRowSelected: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
  },
  cityItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  cityItemTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  cityItemCheck: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
});
