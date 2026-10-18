import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../components/theme';
import { Text, Button } from '../components/UI';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import type { TodayPlanApplicant } from './api';
import { formatCityName } from '../components/cities';

interface ApplicantProfileModalProps {
  visible: boolean;
  applicant: TodayPlanApplicant | null;
  onClose: () => void;
}

export function ApplicantProfileModal({
  visible,
  applicant,
  onClose,
}: ApplicantProfileModalProps) {
  const { t, i18n } = useTranslation();

  if (!applicant) return null;

  const cityFormatted = formatCityName(applicant.city, i18n.language);
  const photos = applicant.photos?.length
    ? applicant.photos
    : applicant.photo
    ? [applicant.photo]
    : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>{applicant.displayName}, {applicant.age}</Text>
              <Text style={styles.headerLocation}>📍 {cityFormatted}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('today_plans_close')}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.contentScroll}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Photos */}
            {photos.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.photosScroll}
              >
                {photos.map(p => (
                  <View key={p.id} style={styles.photoWrapper}>
                    <PrivatePhoto photo={p} style={styles.profilePhoto} />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.noPhotoBox}>
                <Text style={styles.noPhotoText}>👤</Text>
              </View>
            )}

            {/* Bio Section */}
            {applicant.bio ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('profile_about_you', 'ბიო')}</Text>
                <Text style={styles.bioText}>{applicant.bio}</Text>
              </View>
            ) : null}

            {/* Application Note */}
            {applicant.message ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('today_plans_apply_title')}</Text>
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>"{applicant.message}"</Text>
                </View>
              </View>
            ) : null}

            {/* Close Button */}
            <Button
              variant="secondary"
              title={t('today_plans_close')}
              onPress={onClose}
              style={styles.closeActionBtn}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.card,
    borderTopRightRadius: theme.radius.card,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.space.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerLocation: {
    fontSize: 13,
    color: theme.colors.muted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  closeBtnText: {
    fontSize: 18,
    color: theme.colors.muted,
  },
  contentScroll: {
    padding: theme.space.lg,
  },
  scrollContent: {
    gap: theme.space.lg,
    paddingBottom: 40,
  },
  photosScroll: {
    borderRadius: theme.radius.card,
    overflow: 'hidden',
    height: 320,
  },
  photoWrapper: {
    width: 320,
    height: 320,
    backgroundColor: theme.colors.surface,
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
  },
  noPhotoBox: {
    height: 180,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoText: {
    fontSize: 60,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.muted,
    textTransform: 'uppercase',
  },
  bioText: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
  },
  messageBox: {
    backgroundColor: theme.colors.soft,
    padding: theme.space.md,
    borderRadius: theme.radius.control,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  messageText: {
    fontSize: 14,
    color: theme.colors.text,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  closeActionBtn: {
    marginTop: theme.space.md,
  },
});
