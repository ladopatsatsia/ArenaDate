import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface ChatEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_GROUPS = [
  {
    titleKey: 'emoji_group_romance',
    titleDefault: '💖 რომანტიკა & ფლირტი',
    emojis: ['❤️', '🔥', '😍', '💋', '😘', '🥂', '🌹', '✨', '💖', '🥰', '😻', '🍾'],
  },
  {
    titleKey: 'emoji_group_faces',
    titleDefault: '😄 ემოციები',
    emojis: ['😂', '🤣', '😎', '😜', '🥳', '🥺', '🤤', '🙈', '😇', '😏', '🤔', '🤫'],
  },
  {
    titleKey: 'emoji_group_gestures',
    titleDefault: '👍 ჟესტები',
    emojis: ['👍', '👏', '🙌', '🫶', '🤝', '✌️', '👋', '🤞', '☕', '🍷', '🎉', '💃'],
  },
];

export function ChatEmojiPicker({ onSelectEmoji, onClose }: ChatEmojiPickerProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.container} testID="chat-emoji-picker">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('emoji_picker_title', 'ემოჯები')}</Text>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityLabel={t('close', 'დახურვა')}
          accessibilityRole="button"
          testID="close-emoji-picker"
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
        {EMOJI_GROUPS.map((group) => (
          <View key={group.titleKey} style={styles.groupSection}>
            <Text style={styles.groupTitle}>{t(group.titleKey, group.titleDefault)}</Text>
            <View style={styles.emojiGrid}>
              {group.emojis.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiButton}
                  onPress={() => onSelectEmoji(emoji)}
                  accessibilityRole="button"
                  accessibilityLabel={emoji}
                  testID={`emoji-${emoji}`}
                >
                  <Text style={styles.emojiChar}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e1b2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: '#3730a3',
    maxHeight: 250,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e0e7ff',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scrollList: {
    marginTop: 6,
  },
  groupSection: {
    marginBottom: 10,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#a5b4fc',
    marginBottom: 6,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChar: {
    fontSize: 22,
  },
});
