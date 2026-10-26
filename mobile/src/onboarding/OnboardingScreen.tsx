import { Button, Text, TextInput, Card } from '../components/UI';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { theme } from '../components/theme';
import { useAuth } from '../auth/AuthProvider';
import { ProfileApi, uploadPhoto } from '../profile/api';
import { DiscoveryApi } from '../discovery/api';
import { formatCityName } from '../components/cities';
import { detectLocationAndCity } from '../discovery/location';

const TOTAL_STEPS = 8;

const GOAL_OPTIONS = [
  { id: 'long_term', labelKey: 'choice_long_term', emoji: '💍' },
  { id: 'short_term', labelKey: 'choice_short_term', emoji: '☕' },
  { id: 'open_to_either', labelKey: 'choice_open_to_either', emoji: '✨' },
  { id: 'figuring_out', labelKey: 'choice_figuring_out', emoji: '🔍' },
];

const INTEREST_OPTIONS = [
  { id: 'music', labelKey: 'choice_music', emoji: '🎵' },
  { id: 'books', labelKey: 'choice_books', emoji: '📚' },
  { id: 'travel', labelKey: 'choice_travel', emoji: '✈️' },
  { id: 'cooking', labelKey: 'choice_cooking', emoji: '🍳' },
  { id: 'sport', labelKey: 'choice_sport', emoji: '⚽' },
  { id: 'art', labelKey: 'choice_art', emoji: '🎨' },
  { id: 'gaming', labelKey: 'choice_gaming', emoji: '🎮' },
  { id: 'nature', labelKey: 'choice_nature', emoji: '🌿' },
  { id: 'film', labelKey: 'choice_film', emoji: '🎬' },
  { id: 'technology', labelKey: 'choice_technology', emoji: '💻' },
];

export function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const cache = useQueryClient();
  const { state, api: auth, manager } = useAuth();
  const profileApi = new ProfileApi(auth, manager);

  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user already completed onboarding, redirect straight to discover
  const profileQuery = useQuery({
    queryKey: ['account', state.account?.id, 'profile'],
    queryFn: () => profileApi.get(),
    enabled: !!state.account?.id,
    staleTime: 10000,
  });

  const isProfileComplete = Boolean(
    profileQuery.data &&
    profileQuery.data.displayName?.trim()?.length >= 2 &&
    profileQuery.data.gender &&
    profileQuery.data.desiredGenders?.length > 0 &&
    profileQuery.data.photos?.length > 0
  );

  useEffect(() => {
    if (isProfileComplete) {
      router.replace('/(tabs)/discover');
    }
  }, [isProfileComplete, router]);

  // Step 1: Name
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (profileQuery.data) {
      if (profileQuery.data.displayName && !displayName) {
        setDisplayName(profileQuery.data.displayName);
      }
      if (profileQuery.data.gender && (profileQuery.data.gender === 'woman' || profileQuery.data.gender === 'man' || profileQuery.data.gender === 'nonbinary')) {
        setGender(profileQuery.data.gender);
      }
      if (profileQuery.data.city) {
        setSelectedCity(profileQuery.data.city);
      }
      const firstPhoto = profileQuery.data.photos?.[0];
      if (firstPhoto && !uploadedPhotoUri) {
        setUploadedPhotoUri(`/api/media/profile/${firstPhoto.id}`);
      }
    }
  }, [profileQuery.data]);

  // Step 2: Birthday
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');

  // Step 3: Gender & Desired
  const [gender, setGender] = useState<'woman' | 'man' | 'nonbinary'>('woman');
  const [targetPreference, setTargetPreference] = useState<'woman' | 'man' | 'both'>('man');

  // Step 4: City & Location Detection
  const [selectedCity, setSelectedCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [detectedCoords, setDetectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [locationDetected, setLocationDetected] = useState(false);
  const [showManualSelection, setShowManualSelection] = useState(false);

  const handleDetectLocation = useCallback(async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const res = await detectLocationAndCity(true, i18n.language, true);
      const city = res.cityName || 'თბილისი';
      setSelectedCity(city);
      setLocationDetected(true);
      setDetectedCoords({ latitude: res.latitude, longitude: res.longitude });
      setShowManualSelection(false);
    } catch (err: unknown) {
      console.warn('Location detection fallback triggered:', err);
      setSelectedCity('თბილისი');
      setLocationDetected(true);
      setDetectedCoords({ latitude: 41.7151, longitude: 44.8271 });
      setShowManualSelection(false);
    } finally {
      setGpsLoading(false);
    }
  }, [i18n.language]);

  // When reaching Step 4, prompt to turn on location and automatically detect city
  useEffect(() => {
    if (step === 4 && !selectedCity && !locationDetected && !gpsLoading && !gpsError) {
      void handleDetectLocation();
    }
  }, [step, selectedCity, locationDetected, gpsLoading, gpsError, handleDetectLocation]);

  // Step 5: Photo
  const [uploadedPhotoUri, setUploadedPhotoUri] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Step 6: Relationship Goal
  const [relationshipGoal, setRelationshipGoal] = useState<string>('');

  // Step 7: Interests
  const [interests, setInterests] = useState<string[]>([]);

  // Step 8: Bio
  const [bio, setBio] = useState('');

  // Calculate age
  const calculateAge = useCallback(() => {
    const y = parseInt(birthYear, 10);
    const m = parseInt(birthMonth, 10);
    const d = parseInt(birthDay, 10);
    if (!y || !m || !d || y < 1920 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const birthDate = new Date(y, m - 1, d);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const mDiff = today.getMonth() - birthDate.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }, [birthYear, birthMonth, birthDay]);

  const currentAge = calculateAge();
  const isAdult = currentAge !== null && currentAge >= 18;

  // Handle photo pick & upload
  const handlePickPhoto = async () => {
    setError(null);
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setError('photo_permission_denied');
          return;
        }
      }

      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
        exif: false,
      });

      if (selection.canceled || !selection.assets || selection.assets.length === 0) return;
      const asset = selection.assets[0];
      if (!asset?.uri) return;

      setIsUploadingPhoto(true);

      let finalUri = asset.uri;
      try {
        const width = asset.width || 1200;
        const height = asset.height || 1200;
        const resizeAction =
          width >= height
            ? { resize: { width: Math.min(width, 1600) } }
            : { resize: { height: Math.min(height, 1600) } };

        const manipulated = await manipulateAsync(asset.uri, [resizeAction], {
          format: SaveFormat.JPEG,
          compress: 0.85,
        });
        if (manipulated?.uri) {
          finalUri = manipulated.uri;
        }
      } catch (manipulateErr) {
        console.warn('Image manipulation skipped, using raw uri:', manipulateErr);
      }

      const requestId = Crypto.randomUUID();
      await uploadPhoto(profileApi, requestId, finalUri);
      setUploadedPhotoUri(finalUri);
    } catch (err: unknown) {
      console.error('Photo upload failed:', err);
      setError('photo_unavailable');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Toggle Interest
  const toggleInterest = (id: string) => {
    setInterests((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  };

  // Finish Onboarding
  const handleFinish = async () => {
    setBusy(true);
    setError(null);
    try {
      let desiredGenders: string[] = [];
      if (targetPreference === 'both') {
        desiredGenders = ['woman', 'man', 'nonbinary'];
      } else {
        desiredGenders = [targetPreference];
      }

      const finalCity = selectedCity === 'სხვა' ? customCity.trim() || 'თბილისი' : (selectedCity || customCity.trim() || 'თბილისი');

      let formattedDob: string | null = null;
      if (birthYear && birthMonth && birthDay) {
        const y = birthYear.padStart(4, '0');
        const m = birthMonth.padStart(2, '0');
        const d = birthDay.padStart(2, '0');
        formattedDob = `${y}-${m}-${d}`;
      }

      // First fetch current profile to know revision
      const current = await profileApi.get();

      await profileApi.save({
        revision: current.revision,
        displayName: displayName.trim(),
        gender,
        desiredGenders,
        city: finalCity,
        interests: interests.length > 0 ? interests : ['music'],
        relationshipGoal: relationshipGoal || 'open_to_either',
        bio: bio.trim().length >= 10 ? bio.trim() : 'გამარჯობა! მოხარული ვარ გაცნობისთვის ✨',
        visible: true,
        dateOfBirth: formattedDob,
      });

      if (detectedCoords) {
        try {
          const discoveryApi = new DiscoveryApi(auth, manager);
          await discoveryApi.location(detectedCoords.latitude, detectedCoords.longitude);
        } catch (locErr) {
          console.warn('Failed to save discovery location:', locErr);
        }
      }

      await cache.invalidateQueries({ queryKey: ['account', state.account?.id, 'profile'] });
      router.replace('/(tabs)/discover');
    } catch (err: unknown) {
      console.error('Failed to complete onboarding:', err);
      setError('profile_save_failed');
    } finally {
      setBusy(false);
    }
  };

  const nextStep = () => {
    setError(null);
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      void handleFinish();
    }
  };

  const prevStep = () => {
    setError(null);
    if (step > 1) {
      setStep((s) => s - 1);
    }
  };

  if (profileQuery.isLoading || isProfileComplete) {
    return (
      <Screen title={t('brand_name')} hideDrawer>
        <View style={{ flex: 1, minHeight: 300, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title={t('onboarding_title')} hideDrawer>
      <View style={styles.container}>
        {/* Progress Bar & Header */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${(step / TOTAL_STEPS) * 100}%` },
              ]}
            />
          </View>
          <View style={styles.stepInfoRow}>
            {step > 1 ? (
              <Pressable
                accessibilityRole="button"
                onPress={prevStep}
                hitSlop={8}
                style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.backBtnText}>← {t('onboarding_back')}</Text>
              </Pressable>
            ) : (
              <View style={{ width: 60 }} />
            )}
            <Text style={styles.stepCounterText}>
              {t('onboarding_step_of', { current: step, total: TOTAL_STEPS })}
            </Text>
            <View style={{ width: 60 }} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* STEP 1: DISPLAY NAME */}
          {step === 1 && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>{t('onboarding_name_title')}</Text>
              <Text style={styles.stepSubtitle}>{t('onboarding_name_subtitle')}</Text>

              <View style={styles.inputGroup}>
                <TextInput
                  testID="onboarding-name-input"
                  accessibilityLabel={t('profile_displayName')}
                  style={styles.textInput}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder={t('onboarding_name_placeholder', 'მაგ. ალექსანდრე')}
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="words"
                  autoFocus
                  maxLength={50}
                />
              </View>

              <Button
                testID="onboarding-step1-next"
                variant="primary"
                disabled={displayName.trim().length < 2}
                title={t('onboarding_next')}
                onPress={nextStep}
              />
            </Card>
          )}

          {/* STEP 2: BIRTHDAY */}
          {step === 2 && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>{t('onboarding_birthday_title')}</Text>
              <Text style={styles.stepSubtitle}>{t('onboarding_birthday_subtitle')}</Text>

              <View style={styles.dateRow}>
                <View style={styles.dateCol}>
                  <Text style={styles.dateLabel}>{t('onboarding_birthday_day')}</Text>
                  <TextInput
                    testID="onboarding-day-input"
                    accessibilityLabel={t('onboarding_birthday_day')}
                    style={[styles.textInput, styles.dateInput]}
                    value={birthDay}
                    onChangeText={(val) => setBirthDay(val.replace(/\D/g, '').slice(0, 2))}
                    placeholder="15"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>

                <View style={styles.dateCol}>
                  <Text style={styles.dateLabel}>{t('onboarding_birthday_month')}</Text>
                  <TextInput
                    testID="onboarding-month-input"
                    accessibilityLabel={t('onboarding_birthday_month')}
                    style={[styles.textInput, styles.dateInput]}
                    value={birthMonth}
                    onChangeText={(val) => setBirthMonth(val.replace(/\D/g, '').slice(0, 2))}
                    placeholder="05"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>

                <View style={[styles.dateCol, { flex: 1.4 }]}>
                  <Text style={styles.dateLabel}>{t('onboarding_birthday_year')}</Text>
                  <TextInput
                    testID="onboarding-year-input"
                    accessibilityLabel={t('onboarding_birthday_year')}
                    style={[styles.textInput, styles.dateInput]}
                    value={birthYear}
                    onChangeText={(val) => setBirthYear(val.replace(/\D/g, '').slice(0, 4))}
                    placeholder="2000"
                    placeholderTextColor={theme.colors.muted}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>

              {currentAge !== null && (
                <View style={[styles.ageBadge, !isAdult && styles.ageBadgeError]}>
                  <Text style={[styles.ageBadgeText, !isAdult && styles.ageBadgeTextError]}>
                    {isAdult
                      ? `✓ ${t('onboarding_age_display', { age: currentAge })}`
                      : `⚠ ${t('adult_required')}`}
                  </Text>
                </View>
              )}

              <Button
                testID="onboarding-step2-next"
                variant="primary"
                disabled={!isAdult}
                title={t('onboarding_next')}
                onPress={nextStep}
              />
            </Card>
          )}

          {/* STEP 3: GENDER & PREFERENCE */}
          {step === 3 && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>{t('onboarding_gender_title')}</Text>
              <View style={styles.chipRow}>
                {[
                  { id: 'woman', label: t('choice_woman'), icon: '👩' },
                  { id: 'man', label: t('choice_man'), icon: '👨' },
                  { id: 'nonbinary', label: t('choice_nonbinary'), icon: '🌈' },
                ].map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => setGender(item.id as 'woman' | 'man' | 'nonbinary')}
                    style={[
                      styles.choiceCard,
                      gender === item.id && styles.choiceCardActive,
                    ]}
                  >
                    <Text style={styles.choiceIcon}>{item.icon}</Text>
                    <Text
                      style={[
                        styles.choiceText,
                        gender === item.id && styles.choiceTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.stepTitle, { marginTop: 12 }]}>
                {t('onboarding_interested_title')}
              </Text>
              <View style={styles.chipRow}>
                {[
                  { id: 'woman', label: t('onboarding_interested_women'), icon: '👩' },
                  { id: 'man', label: t('onboarding_interested_men'), icon: '👨' },
                  { id: 'both', label: t('onboarding_interested_both'), icon: '✨' },
                ].map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => setTargetPreference(item.id as 'woman' | 'man' | 'both')}
                    style={[
                      styles.choiceCard,
                      targetPreference === item.id && styles.choiceCardActive,
                    ]}
                  >
                    <Text style={styles.choiceIcon}>{item.icon}</Text>
                    <Text
                      style={[
                        styles.choiceText,
                        targetPreference === item.id && styles.choiceTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Button
                testID="onboarding-step3-next"
                variant="primary"
                title={t('onboarding_next')}
                onPress={nextStep}
              />
            </Card>
          )}

          {/* STEP 4: CITY & GPS LOCATION */}
          {step === 4 && (
            <Card style={styles.stepCard}>
              <View style={styles.stepHeaderCenter}>
                <View style={styles.locationIconBadge}>
                  <Text style={{ fontSize: 32 }}>📍</Text>
                </View>
                <Text style={styles.stepTitle}>{t('onboarding_city_title')}</Text>
                <Text style={styles.stepSubtitle}>
                  {t('onboarding_city_gps_subtitle')}
                </Text>
              </View>

              {/* GPS Detection State: Loading */}
              {gpsLoading && (
                <View style={styles.gpsDetectingCard}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.gpsDetectingTitle}>
                    {t('onboarding_city_detecting')}
                  </Text>
                  <Text style={styles.gpsDetectingSub}>
                    {t('onboarding_city_detecting_sub')}
                  </Text>
                </View>
              )}

              {/* GPS Detection State: Successfully Detected */}
              {!gpsLoading && locationDetected && selectedCity && (
                <View style={styles.gpsSuccessCard}>
                  <View style={styles.gpsSuccessHeader}>
                    <View style={styles.gpsPulseDot} />
                    <Text style={styles.gpsSuccessBadge}>
                      {t('onboarding_city_detected_badge')}
                    </Text>
                  </View>

                  <View style={styles.gpsCityDisplay}>
                    <Text style={styles.gpsCityName}>
                      {formatCityName(selectedCity, i18n.language)}
                    </Text>
                    {detectedCoords && (
                      <Text style={styles.gpsCoordsText}>
                        📍 {detectedCoords.latitude.toFixed(2)}°, {detectedCoords.longitude.toFixed(2)}°
                      </Text>
                    )}
                  </View>

                  <View style={[styles.gpsActionRow, { justifyContent: 'center' }]}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void handleDetectLocation()}
                      style={({ pressed }) => [
                        styles.gpsSecondaryBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={styles.gpsSecondaryBtnText}>
                        🔄 {t('onboarding_city_redetect')}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* GPS Detection State: Not detected / Error / Denied */}
              {!gpsLoading && (!locationDetected || !selectedCity || gpsError) && (
                <View style={styles.gpsPromptCard}>
                  {gpsError ? (
                    <View style={styles.gpsErrorBox}>
                      <Text style={styles.gpsErrorIcon}>⚠️</Text>
                      <Text style={styles.gpsErrorText}>
                        {t(gpsError)}
                      </Text>
                    </View>
                  ) : null}

                  <Pressable
                    testID="onboarding-detect-location-btn"
                    accessibilityRole="button"
                    onPress={() => void handleDetectLocation()}
                    style={({ pressed }) => [
                      styles.gpsPrimaryBtn,
                      pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Text style={styles.gpsPrimaryBtnText}>
                      📍 {t('onboarding_city_detect_btn')}
                    </Text>
                  </Pressable>
                </View>
              )}

              <Button
                testID="onboarding-step4-next"
                variant="primary"
                title={t('onboarding_next')}
                disabled={gpsLoading || !selectedCity}
                onPress={nextStep}
              />
            </Card>
          )}

          {/* STEP 5: PHOTO */}
          {step === 5 && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>{t('onboarding_photo_title')}</Text>
              <Text style={styles.stepSubtitle}>{t('onboarding_photo_subtitle')}</Text>

              <View style={styles.photoContainer}>
                {uploadedPhotoUri ? (
                  <View style={styles.photoPreviewWrapper}>
                    <Image source={{ uri: uploadedPhotoUri }} style={styles.photoPreview} />
                    <View style={styles.photoBadge}>
                      <Text style={styles.photoBadgeText}>✓ {t('onboarding_photo_ready')}</Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => void handlePickPhoto()}
                      style={styles.photoChangeBtn}
                    >
                      <Text style={styles.photoChangeBtnText}>{t('change')}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    testID="onboarding-photo-picker"
                    accessibilityRole="button"
                    onPress={() => void handlePickPhoto()}
                    disabled={isUploadingPhoto}
                    style={({ pressed }) => [
                      styles.photoPlaceholder,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    {isUploadingPhoto ? (
                      <View style={{ alignItems: 'center', gap: 8 }}>
                        <ActivityIndicator size="large" color={theme.colors.primary} />
                        <Text style={styles.photoPlaceholderText}>
                          {t('onboarding_photo_uploading')}
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text style={{ fontSize: 44 }}>📸</Text>
                        <Text style={styles.photoPlaceholderText}>
                          {t('onboarding_photo_add')}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>

              <Button
                testID="onboarding-step5-next"
                variant="primary"
                disabled={!uploadedPhotoUri || isUploadingPhoto}
                title={t('onboarding_next')}
                onPress={nextStep}
              />
            </Card>
          )}

          {/* STEP 6: RELATIONSHIP GOAL (OPTIONAL) */}
          {step === 6 && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>{t('onboarding_goal_title')}</Text>
              <Text style={styles.stepSubtitle}>{t('onboarding_goal_subtitle')}</Text>

              <View style={{ gap: 10 }}>
                {GOAL_OPTIONS.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => setRelationshipGoal(item.id)}
                    style={[
                      styles.goalRow,
                      relationshipGoal === item.id && styles.goalRowActive,
                    ]}
                  >
                    <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
                    <Text
                      style={[
                        styles.goalText,
                        relationshipGoal === item.id && styles.goalTextActive,
                      ]}
                    >
                      {t(item.labelKey)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.actionRow}>
                <Button
                  testID="onboarding-step6-skip"
                  variant="secondary"
                  title={t('onboarding_skip')}
                  onPress={nextStep}
                  style={{ flex: 1 }}
                />
                <Button
                  testID="onboarding-step6-next"
                  variant="primary"
                  title={t('onboarding_next')}
                  onPress={nextStep}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          )}

          {/* STEP 7: INTERESTS (OPTIONAL) */}
          {step === 7 && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>{t('onboarding_interests_title')}</Text>
              <Text style={styles.stepSubtitle}>{t('onboarding_interests_subtitle')}</Text>

              <View style={styles.interestWrap}>
                {INTEREST_OPTIONS.map((item) => {
                  const selected = interests.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      onPress={() => toggleInterest(item.id)}
                      style={[styles.interestChip, selected && styles.interestChipActive]}
                    >
                      <Text style={{ fontSize: 16 }}>{item.emoji}</Text>
                      <Text
                        style={[
                          styles.interestChipText,
                          selected && styles.interestChipTextActive,
                        ]}
                      >
                        {t(item.labelKey)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.actionRow}>
                <Button
                  testID="onboarding-step7-skip"
                  variant="secondary"
                  title={t('onboarding_skip')}
                  onPress={nextStep}
                  style={{ flex: 1 }}
                />
                <Button
                  testID="onboarding-step7-next"
                  variant="primary"
                  title={t('onboarding_next')}
                  onPress={nextStep}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          )}

          {/* STEP 8: BIO (OPTIONAL) */}
          {step === 8 && (
            <Card style={styles.stepCard}>
              <Text style={styles.stepTitle}>{t('onboarding_bio_title')}</Text>
              <Text style={styles.stepSubtitle}>{t('onboarding_bio_subtitle')}</Text>

              <View style={styles.inputGroup}>
                <TextInput
                  testID="onboarding-bio-input"
                  style={styles.bioInput}
                  value={bio}
                  onChangeText={setBio}
                  placeholder={t('onboarding_bio_placeholder')}
                  placeholderTextColor={theme.colors.muted}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                />
                <Text style={styles.charCount}>{bio.length} / 500</Text>
              </View>

              {error && (
                <Text style={styles.errorText} accessibilityRole="alert">
                  {t(error)}
                </Text>
              )}

              <View style={styles.actionRow}>
                <Button
                  testID="onboarding-step8-skip"
                  variant="secondary"
                  disabled={busy}
                  title={t('onboarding_skip')}
                  onPress={() => void handleFinish()}
                  style={{ flex: 1 }}
                />
                <Button
                  testID="onboarding-finish-btn"
                  variant="primary"
                  busy={busy}
                  disabled={busy}
                  title={busy ? t('working') : t('onboarding_finish')}
                  onPress={() => void handleFinish()}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: theme.colors.soft,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.match,
    borderRadius: 3,
  },
  stepInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  stepCounterText: {
    fontSize: 13,
    color: theme.colors.muted,
    fontWeight: '600',
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backBtnText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  stepCard: {
    padding: 22,
    gap: 18,
    borderRadius: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
  },
  stepSubtitle: {
    fontSize: 14,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  inputGroup: {
    gap: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    minHeight: 50,
    color: theme.colors.text,
    fontSize: 16,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateCol: {
    flex: 1,
    gap: 6,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.muted,
  },
  dateInput: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  ageBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderColor: 'rgba(52, 211, 153, 0.4)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'center',
  },
  ageBadgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  ageBadgeText: {
    color: '#34D399',
    fontWeight: '600',
    fontSize: 14,
  },
  ageBadgeTextError: {
    color: '#EF4444',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choiceCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
  },
  choiceCardActive: {
    borderColor: theme.colors.match,
    backgroundColor: 'rgba(251, 113, 133, 0.12)',
  },
  choiceIcon: {
    fontSize: 26,
  },
  choiceText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.muted,
    textAlign: 'center',
  },
  choiceTextActive: {
    color: theme.colors.text,
  },
  cityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityChip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  cityChipActive: {
    borderColor: theme.colors.match,
    backgroundColor: theme.colors.match,
  },
  cityChipText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  cityChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  photoContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  photoPlaceholder: {
    width: 200,
    height: 260,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.match,
    borderRadius: 16,
    backgroundColor: 'rgba(251, 113, 133, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  photoPlaceholderText: {
    color: theme.colors.match,
    fontSize: 15,
    fontWeight: '600',
  },
  photoPreviewWrapper: {
    alignItems: 'center',
    gap: 10,
  },
  photoPreview: {
    width: 200,
    height: 260,
    borderRadius: 16,
  },
  photoBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.2)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  photoBadgeText: {
    color: '#34D399',
    fontWeight: '600',
    fontSize: 13,
  },
  photoChangeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  photoChangeBtnText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
  },
  goalRowActive: {
    borderColor: theme.colors.match,
    backgroundColor: 'rgba(251, 113, 133, 0.12)',
  },
  goalText: {
    fontSize: 15,
    color: theme.colors.muted,
  },
  goalTextActive: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  interestWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  interestChipActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  interestChipText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  interestChipTextActive: {
    color: '#C4B5FD',
    fontWeight: '600',
  },
  bioInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 14,
    color: theme.colors.text,
    fontSize: 15,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: theme.colors.muted,
    textAlign: 'right',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
  },
  stepHeaderCenter: {
    alignItems: 'center',
    marginBottom: 8,
  },
  locationIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gpsDetectingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    gap: 10,
    marginVertical: 12,
  },
  gpsDetectingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  gpsDetectingSub: {
    fontSize: 13,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  gpsSuccessCard: {
    padding: 16,
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    marginVertical: 12,
    gap: 12,
  },
  gpsSuccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gpsPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  gpsSuccessBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34D399',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gpsCityDisplay: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  gpsCityName: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  gpsCoordsText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '500',
  },
  gpsActionRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  gpsSecondaryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  gpsSecondaryBtnText: {
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '600',
  },
  gpsPromptCard: {
    marginVertical: 12,
    gap: 10,
  },
  gpsPrimaryBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  gpsErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  gpsErrorIcon: {
    fontSize: 18,
  },
  gpsErrorText: {
    flex: 1,
    fontSize: 13,
    color: '#F87171',
    lineHeight: 18,
  },
  manualSelectionContainer: {
    marginVertical: 10,
    gap: 12,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 6,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: theme.colors.muted,
    fontWeight: '500',
  },
});
