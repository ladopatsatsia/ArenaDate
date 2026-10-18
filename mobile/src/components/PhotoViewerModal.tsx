import { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PrivatePhoto } from '../profile/PrivatePhoto';
import type { Photo } from '../profile/api';

function useSafeInsets() {
  try {
    return useSafeAreaInsets();
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
}

export interface PhotoViewerModalProps {
  photos: Photo[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export function PhotoViewerModal({
  photos,
  initialIndex = 0,
  visible,
  onClose,
}: PhotoViewerModalProps) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList<Photo>>(null);

  useEffect(() => {
    if (visible) {
      const idx = Math.min(Math.max(0, initialIndex), Math.max(0, photos.length - 1));
      setCurrentIndex(idx);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: false });
      }, 50);
    }
  }, [visible, initialIndex, photos.length]);

  if (!visible || photos.length === 0) return null;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / width);
    if (nextIndex >= 0 && nextIndex < photos.length && nextIndex !== currentIndex) {
      setCurrentIndex(nextIndex);
    }
  };

  const goTo = (targetIndex: number) => {
    if (targetIndex >= 0 && targetIndex < photos.length) {
      setCurrentIndex(targetIndex);
      flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { width, height }]}>
        {/* Top Header */}
        <View style={[styles.header, { top: Math.max(insets.top, 16) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            onPress={onClose}
            hitSlop={14}
            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>

          {photos.length > 1 && (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {photos.length}
              </Text>
            </View>
          )}

          <View style={styles.headerPlaceholder} />
        </View>

        {/* Photos Carousel */}
        <FlatList
          ref={flatListRef}
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          initialScrollIndex={Math.min(initialIndex, Math.max(0, photos.length - 1))}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onMomentumScrollEnd={handleScroll}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={{ width, flex: 1 }}
          contentContainerStyle={{ alignItems: 'center' }}
          renderItem={({ item }) => (
            <View style={{ width, height, justifyContent: 'center', alignItems: 'center', padding: 12 }}>
              <PrivatePhoto photo={item} fullscreen />
            </View>
          )}
        />

        {/* Left Arrow */}
        {photos.length > 1 && currentIndex > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('previous')}
            onPress={() => goTo(currentIndex - 1)}
            hitSlop={12}
            style={[styles.navArrow, styles.navArrowLeft]}
          >
            <Text style={styles.navArrowText}>‹</Text>
          </Pressable>
        )}

        {/* Right Arrow */}
        {photos.length > 1 && currentIndex < photos.length - 1 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('next')}
            onPress={() => goTo(currentIndex + 1)}
            hitSlop={12}
            style={[styles.navArrow, styles.navArrowRight]}
          >
            <Text style={styles.navArrowText}>›</Text>
          </Pressable>
        )}

        {/* Bottom Dots Indicator */}
        {photos.length > 1 && (
          <View style={[styles.bottomDots, { bottom: Math.max(insets.bottom, 24) }]}>
            {photos.map((_, i) => (
              <Pressable
                key={i}
                onPress={() => goTo(i)}
                hitSlop={8}
                style={[styles.dot, i === currentIndex && styles.dotActive]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07040B',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(28, 22, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  counterBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(28, 22, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  headerPlaceholder: {
    width: 44,
    height: 44,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -28,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(28, 22, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  navArrowLeft: {
    left: 14,
  },
  navArrowRight: {
    right: 14,
  },
  navArrowText: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '300',
  },
  bottomDots: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  dotActive: {
    width: 22,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF2E74',
  },
});
