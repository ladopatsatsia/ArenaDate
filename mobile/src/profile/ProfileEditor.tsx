import { Button, Text, TextInput } from '../components/UI';
import { theme } from '../components/theme';
import { CityPicker } from '../components/CityPicker';
import { LanguagePickerModal } from '../components/LanguagePickerModal';
import { formatLanguageDisplay } from '../components/languages';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { Choices, OwnProfile, ProfileApi } from './api';

export const CHOICE_EMOJIS: Record<string, string> = {
  // Genders
  woman: '👩',
  man: '👨',
  female: '👩',
  male: '👨',
  nonbinary: '🧑',
  // Relationship Goals
  long_term: '💍',
  short_term: '☕',
  open_to_either: '🥂',
  figuring_out: '🤔',
  // Interests
  music: '🎵',
  books: '📚',
  travel: '✈️',
  cooking: '🍳',
  sport: '⚽',
  art: '🎨',
  gaming: '🎮',
  nature: '🌿',
  film: '🎬',
  technology: '💻',
  // Languages
  'ქართული': '🇬🇪',
  'English': '🇬🇧',
  'Русский': '🇷🇺',
  'Deutsch': '🇩🇪',
  'Français': '🇫🇷',
  'Español': '🇪🇸',
  'Italiano': '🇮🇹',
  'Türkçe': '🇹🇷',
};

interface SelectableChipProps {
  value: string;
  label: string;
  isSelected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

function SelectableChip({ value, label, isSelected, onPress, disabled }: SelectableChipProps) {
  const emoji = CHOICE_EMOJIS[value] ?? '✨';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${isSelected ? 'selected' : ''}`}
      accessibilityState={{ selected: isSelected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.chip,
        isSelected && styles.chipActive,
        pressed && !disabled && styles.chipPressed,
        disabled && styles.chipDisabled,
      ]}
    >
      <Text style={styles.chipEmoji}>{emoji}</Text>
      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
        {label}
      </Text>
      {isSelected && (
        <View style={styles.chipCheckCircle}>
          <Text style={styles.chipCheckText}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

const createSchema = (t: TFunction) => z.object({
  displayName: z
    .string()
    .trim()
    .min(2, { message: t('val_name_min') })
    .max(50, { message: t('val_name_max') }),
  gender: z
    .string()
    .min(1, { message: t('val_gender_required') }),
  bio: z.string().max(500, { message: t('val_bio_max') }).default(''),
  city: z.string().max(80, { message: t('val_city_max') }).default(''),
  desiredGenders: z.array(z.string()).max(3, { message: t('val_desired_genders_max') }).default([]),
  interests: z.array(z.string()).max(5, { message: t('val_interests_max') }).default([]),
  languages: z.array(z.string()).max(8, { message: t('val_languages_max') }).default([]),
  relationshipGoal: z.string().default(''),
  visible: z.boolean().default(true),
});

export function ProfileEditor({ profile, choices, api, saved }: { profile: OwnProfile; choices: Choices; api: ProfileApi; saved: (p: OwnProfile) => void }) {
  const { t, i18n } = useTranslation();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [languageModalOpen, setLanguageModalOpen] = useState(false);

  const schema = useMemo(() => createSchema(t), [t]);

  const { control, watch, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      displayName: profile.displayName ?? '',
      bio: profile.bio ?? '',
      gender: profile.gender ?? '',
      desiredGenders: Array.isArray(profile.desiredGenders) ? profile.desiredGenders : [],
      city: profile.city ?? '',
      interests: Array.isArray(profile.interests) ? profile.interests : [],
      languages: Array.isArray(profile.languages) ? profile.languages : [],
      relationshipGoal: profile.relationshipGoal ?? '',
      visible: profile.visible ?? true,
    },
  });

  const currentRevisionRef = useRef(profile.revision);
  useEffect(() => {
    currentRevisionRef.current = profile.revision;
  }, [profile.revision]);

  const inFlightRef = useRef(false);
  const pendingSaveRef = useRef<Record<string, unknown> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastSavedJsonRef = useRef(JSON.stringify({
    displayName: (profile.displayName ?? '').trim(),
    gender: profile.gender ?? '',
    bio: (profile.bio ?? '').trim(),
    city: (profile.city ?? '').trim(),
    desiredGenders: Array.isArray(profile.desiredGenders) ? profile.desiredGenders : [],
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    languages: Array.isArray(profile.languages) ? profile.languages : [],
    relationshipGoal: profile.relationshipGoal ?? '',
    visible: profile.visible ?? true,
  }));

  const executeSave = useCallback(async (valuesToSave: unknown) => {
    const parseResult = schema.safeParse(valuesToSave);
    if (!parseResult.success) {
      return;
    }

    const payload = {
      displayName: parseResult.data.displayName.trim(),
      gender: parseResult.data.gender,
      bio: parseResult.data.bio?.trim() ?? '',
      city: parseResult.data.city?.trim() ?? '',
      desiredGenders: parseResult.data.desiredGenders ?? [],
      interests: parseResult.data.interests ?? [],
      languages: parseResult.data.languages ?? [],
      relationshipGoal: parseResult.data.relationshipGoal ?? '',
      visible: parseResult.data.visible,
    };

    const payloadJson = JSON.stringify(payload);
    if (payloadJson === lastSavedJsonRef.current) {
      return;
    }

    if (inFlightRef.current) {
      pendingSaveRef.current = payload;
      return;
    }

    inFlightRef.current = true;
    setSaveStatus('saving');

    try {
      const updated = await api.save({
        ...payload,
        revision: currentRevisionRef.current,
      });
      currentRevisionRef.current = updated.revision;
      lastSavedJsonRef.current = payloadJson;
      saved(updated);
      setSaveStatus('saved');
      if (savedResetTimerRef.current) clearTimeout(savedResetTimerRef.current);
      savedResetTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2500);
    } catch {
      setSaveStatus('error');
    } finally {
      inFlightRef.current = false;
      if (pendingSaveRef.current) {
        const next = pendingSaveRef.current;
        pendingSaveRef.current = null;
        void executeSave(next);
      }
    }
  }, [api, saved, schema]);

  const scheduleSave = useCallback((values: unknown, isText = false) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const delay = isText ? 700 : 150;
    debounceTimerRef.current = setTimeout(() => {
      void executeSave(values);
    }, delay);
  }, [executeSave]);

  const flushSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const currentValues = getValues();
    void executeSave(currentValues);
  }, [executeSave, getValues]);

  useEffect(() => {
    const subscription = watch((values, { name }) => {
      const isText = name === 'displayName' || name === 'bio';
      scheduleSave(values, isText);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (savedResetTimerRef.current) clearTimeout(savedResetTimerRef.current);
      const vals = getValues();
      void executeSave(vals);
    };
  }, [watch, scheduleSave, executeSave, getValues]);

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <View style={styles.container}>
      {/* Auto-save status feedback */}
      <View style={styles.autoSaveBar}>
        {saveStatus === 'saving' && (
          <View style={styles.statusPillSaving}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={styles.statusTextSaving}>
              {t('profile_auto_saving', { defaultValue: 'ინახება…' })}
            </Text>
          </View>
        )}
        {saveStatus === 'saved' && (
          <View style={styles.statusPillSaved}>
            <Text style={styles.statusCheckIcon}>✓</Text>
            <Text style={styles.statusTextSaved}>
              {t('profile_auto_saved', { defaultValue: 'შენახულია' })}
            </Text>
          </View>
        )}
        {saveStatus === 'error' && (
          <View style={styles.statusPillError}>
            <Text style={styles.statusErrorIcon}>⚠️</Text>
            <Text style={styles.statusTextError}>
              {t('profile_auto_error', { defaultValue: 'ვერ შეინახა' })}
            </Text>
          </View>
        )}
      </View>
      {/* SECTION 1: 👤 პირადი მონაცემები */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderIcon}>👤</Text>
          <Text style={styles.sectionHeaderTitle}>{t('section_personal')}</Text>
        </View>

        {/* Age & Date of birth informational banner */}
        <View style={styles.ageBanner}>
          <Text style={styles.ageBannerTitle}>
            🎂 {t('profile_age')}: {t('profile_age_years', { age: profile.age })}
          </Text>
          <Text style={styles.ageBannerDesc}>
            {t('profile_age_banner_desc')}
          </Text>
        </View>

        {/* Display Name (Required) */}
        <Controller
          control={control}
          name="displayName"
          render={({ field }) => (
            <View style={{ gap: 4 }}>
              <Text style={styles.fieldLabel}>
                {t('profile_displayName')} <Text style={{ color: theme.colors.danger }}>*</Text>
              </Text>
              <TextInput
                testID="profile-displayName"
                accessibilityLabel={t('profile_displayName')}
                value={field.value ?? ''}
                placeholder={t('profile_name_placeholder')}
                placeholderTextColor={theme.colors.muted}
                onChangeText={field.onChange}
                onBlur={() => {
                  field.onBlur();
                  flushSave();
                }}
                maxLength={50}
                style={[
                  styles.input,
                  errors.displayName ? styles.inputError : null,
                ]}
              />
              {errors.displayName && (
                <Text style={styles.fieldError}>
                  {errors.displayName.message || t('invalid_field')}
                </Text>
              )}
            </View>
          )}
        />

        {/* Gender (Required) */}
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>
                {t('profile_gender')} <Text style={{ color: theme.colors.danger }}>*</Text>
              </Text>
              <View style={styles.pillsRow}>
                {choices.genders.map(value => (
                  <SelectableChip
                    key={value}
                    value={value}
                    label={t('choice_' + value)}
                    isSelected={field.value === value}
                    onPress={() => field.onChange(value)}
                  />
                ))}
              </View>
              {errors.gender && (
                <Text style={styles.fieldError}>
                  {errors.gender.message || t('invalid_field')}
                </Text>
              )}
            </View>
          )}
        />
      </View>

      {/* SECTION 2: 📍 მდებარეობა */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderIcon}>📍</Text>
          <Text style={styles.sectionHeaderTitle}>{t('section_location')}</Text>
        </View>

        <Controller
          control={control}
          name="city"
          render={({ field }) => (
            <CityPicker
              testID="profile-city"
              value={field.value ?? ''}
              onChange={field.onChange}
              error={errors.city?.message}
            />
          )}
        />
      </View>

      {/* SECTION 3: 💬 ჩემ შესახებ */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderIcon}>💬</Text>
          <Text style={styles.sectionHeaderTitle}>{t('section_about')}</Text>
        </View>

        {/* Bio (Optional) */}
        <Controller
          control={control}
          name="bio"
          render={({ field }) => (
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>
                {t('profile_bio')} <Text style={styles.optionalText}>{t('optional')}</Text>
              </Text>
              <View style={[styles.textAreaBox, errors.bio ? styles.inputError : null]}>
                <TextInput
                  testID="profile-bio"
                  accessibilityLabel={t('profile_bio')}
                  value={field.value ?? ''}
                  placeholder={t('profile_bio_editor_placeholder')}
                  placeholderTextColor={theme.colors.muted}
                  onChangeText={field.onChange}
                  onBlur={() => {
                    field.onBlur();
                    flushSave();
                  }}
                  multiline
                  maxLength={500}
                  style={styles.textAreaInput}
                />
                <View style={styles.counterRow}>
                  <Text style={styles.counterText}>
                    {(field.value ?? '').length} / 500
                  </Text>
                </View>
              </View>
              {errors.bio && (
                <Text style={styles.fieldError}>
                  {errors.bio.message || t('invalid_field')}
                </Text>
              )}
            </View>
          )}
        />

        {/* Interests (Optional) */}
        <Controller
          control={control}
          name="interests"
          render={({ field }) => {
            const arr = Array.isArray(field.value) ? field.value : [];
            return (
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.fieldLabel}>
                    {t('profile_interests')} <Text style={styles.optionalText}>{t('optional')}</Text>
                  </Text>
                  <Text style={styles.counterText}>{arr.length}/5</Text>
                </View>
                <View style={styles.pillsRow}>
                  {choices.interests.map(value => {
                    const isSelected = arr.includes(value);
                    return (
                      <SelectableChip
                        key={value}
                        value={value}
                        label={t('choice_' + value)}
                        isSelected={isSelected}
                        onPress={() => {
                          if (isSelected) {
                            field.onChange(arr.filter(x => x !== value));
                          } else if (arr.length < 5) {
                            field.onChange([...arr, value]);
                          }
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      </View>

      {/* SECTION: 🗣️ სალაპარაკო ენები */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderIcon}>🗣️</Text>
          <Text style={styles.sectionHeaderTitle}>{t('section_languages')}</Text>
        </View>

        <Controller
          control={control}
          name="languages"
          render={({ field }) => {
            const arr = Array.isArray(field.value) ? field.value : [];
            const isKa = i18n.language !== 'en';
            return (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.fieldLabel}>
                    {t('profile_languages')} <Text style={styles.optionalText}>{t('optional')}</Text>
                  </Text>
                  <Text style={{ fontSize: 13, color: theme.colors.muted, fontWeight: '600' }}>
                    {arr.length}/8
                  </Text>
                </View>

                {/* Selected Languages Chips with Direct Remove (✕) Button */}
                {arr.length > 0 ? (
                  <View style={styles.pillsRow}>
                    {arr.map(value => (
                      <Pressable
                        key={value}
                        onPress={() => field.onChange(arr.filter(x => x !== value))}
                        style={styles.selectedLangChip}
                      >
                        <Text style={styles.selectedLangText}>
                          {formatLanguageDisplay(value, isKa ? 'ka' : 'en')}
                        </Text>
                        <View style={styles.removeChipBadge}>
                          <Text style={styles.removeChipText}>✕</Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={{ fontSize: 13, color: theme.colors.muted }}>
                    {t('profile_no_languages_selected', 'ენები ჯერ არ არის არჩეული')}
                  </Text>
                )}

                {/* Open Language Search & Select Modal Button */}
                <Button
                  title={arr.length > 0
                    ? t('profile_edit_languages', '✏️ ენების რედაქტირება / დამატება')
                    : t('profile_add_languages', '🔍 + ენის მოძებნა და დამატება')}
                  onPress={() => setLanguageModalOpen(true)}
                  style={styles.openPickerBtn}
                />

                <LanguagePickerModal
                  visible={languageModalOpen}
                  selected={arr}
                  maxCount={8}
                  onSave={langs => field.onChange(langs)}
                  onClose={() => setLanguageModalOpen(false)}
                />
              </View>
            );
          }}
        />
      </View>

      {/* SECTION 4: 🎯 გაცნობის მიზნები */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderIcon}>🎯</Text>
          <Text style={styles.sectionHeaderTitle}>{t('section_dating_goals')}</Text>
        </View>

        {/* Desired Genders (Optional) */}
        <Controller
          control={control}
          name="desiredGenders"
          render={({ field }) => (
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>
                {t('profile_desiredGenders')} <Text style={styles.optionalText}>{t('optional')}</Text>
              </Text>
              <View style={styles.pillsRow}>
                {choices.genders.map(value => {
                  const arr = Array.isArray(field.value) ? field.value : [];
                  const isSelected = arr.includes(value);
                  return (
                    <SelectableChip
                      key={value}
                      value={value}
                      label={t('choice_' + value)}
                      isSelected={isSelected}
                      onPress={() => field.onChange(isSelected ? arr.filter(x => x !== value) : [...arr, value])}
                    />
                  );
                })}
              </View>
            </View>
          )}
        />

        {/* Relationship Goal (Optional) */}
        <Controller
          control={control}
          name="relationshipGoal"
          render={({ field }) => (
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>
                {t('profile_relationshipGoal')} <Text style={styles.optionalText}>{t('optional')}</Text>
              </Text>
              <View style={styles.pillsRow}>
                {choices.relationshipGoals.map(value => {
                  const isSelected = field.value === value;
                  return (
                    <SelectableChip
                      key={value}
                      value={value}
                      label={t('choice_' + value)}
                      isSelected={isSelected}
                      onPress={() => field.onChange(isSelected ? '' : value)}
                    />
                  );
                })}
              </View>
            </View>
          )}
        />
      </View>

      {/* SECTION 5: 👁️ პროფილის ხილვადობა */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderIcon}>👁️</Text>
          <Text style={styles.sectionHeaderTitle}>{t('section_visibility')}</Text>
        </View>

        <Controller
          control={control}
          name="visible"
          render={({ field }) => (
            <View style={styles.visibilityRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontWeight: '600', color: theme.colors.text, fontSize: 15 }}>
                  {t('profile_visible')}
                </Text>
                <Text style={{ fontSize: 12, color: theme.colors.muted }}>
                  {field.value ? t('profile_visible_active') : t('profile_visible_hidden')}
                </Text>
              </View>
              <Switch
                accessibilityLabel={t('profile_visible')}
                value={field.value}
                onValueChange={field.onChange}
                trackColor={{ false: '#3B2D54', true: theme.colors.primary }}
              />
            </View>
          )}
        />
      </View>

      {/* Error alert summary box */}
      {hasErrors && (
        <View style={styles.errorBox}>
          <Text accessibilityRole="alert" style={styles.errorBoxTitle}>
            {t('profile_invalid')}
          </Text>
          {errors.displayName && (
            <Text style={styles.errorBoxItem}>• {t('profile_displayName')}: {errors.displayName.message}</Text>
          )}
          {errors.gender && (
            <Text style={styles.errorBoxItem}>• {t('profile_gender')}: {errors.gender.message}</Text>
          )}
          {errors.bio && (
            <Text style={styles.errorBoxItem}>• {t('profile_bio')}: {errors.bio.message}</Text>
          )}
          {errors.city && (
            <Text style={styles.errorBoxItem}>• {t('profile_city')}: {errors.city.message}</Text>
          )}
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.22)',
    borderRadius: 16,
    padding: 16,
    gap: 14,
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
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  ageBanner: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    gap: 4,
  },
  ageBannerTitle: {
    fontWeight: '700',
    color: theme.colors.text,
    fontSize: 15,
  },
  ageBannerDesc: {
    fontSize: 12,
    color: theme.colors.muted,
    lineHeight: 17,
  },
  fieldLabel: {
    fontWeight: '600',
    color: theme.colors.text,
    fontSize: 14,
  },
  optionalText: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: 'normal',
  },
  counterText: {
    fontSize: 12,
    color: theme.colors.muted,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    fontSize: 15,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  textAreaBox: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    overflow: 'hidden',
  },
  textAreaInput: {
    minHeight: 80,
    color: theme.colors.text,
    fontSize: 15,
    textAlignVertical: 'top',
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldError: {
    color: theme.colors.danger,
    fontSize: 12,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 6,
  },
  chipActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
  },
  chipPressed: {
    opacity: 0.75,
  },
  chipDisabled: {
    opacity: 0.4,
  },
  chipEmoji: {
    fontSize: 14,
    lineHeight: 18,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.muted,
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  chipCheckCircle: {
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  chipCheckText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    lineHeight: 12,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  errorBox: {
    backgroundColor: 'rgba(251, 113, 133, 0.12)',
    borderColor: theme.colors.danger,
    borderWidth: 1,
    padding: 14,
    borderRadius: 12,
    gap: 4,
  },
  errorBoxTitle: {
    color: theme.colors.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  errorBoxItem: {
    color: theme.colors.danger,
    fontSize: 13,
  },
  selectedLangChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3B2064',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  selectedLangText: {
    color: '#F3E8FF',
    fontWeight: '600',
    fontSize: 13,
  },
  removeChipBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  removeChipText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  openPickerBtn: {
    marginTop: 4,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
  },
  autoSaveBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    minHeight: 28,
  },
  statusPillSaving: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  statusTextSaving: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  statusPillSaved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusCheckIcon: {
    fontSize: 12,
    fontWeight: '800',
    color: '#10B981',
  },
  statusTextSaved: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  statusPillError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  statusErrorIcon: {
    fontSize: 12,
  },
  statusTextError: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
});
