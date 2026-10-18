import { Button, Text } from '../components/UI';
import { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '../components/useReducedMotion';
import { theme } from '../components/theme';

export function SwipeCard({
  children,
  disabled,
  decide,
  onSuperLike,
}: PropsWithChildren<{
  disabled: boolean;
  decide: (kind: 'like' | 'pass') => void;
  onSuperLike?: () => void;
}>) {
 const { t } = useTranslation(); const reduced=useReducedMotion();const x = useSharedValue(0); const committed = useSharedValue(false);
 const gesture = Gesture.Pan().withTestId('discovery-swipe').enabled(!disabled).activeOffsetX([-20,20]).failOffsetY([-18,18])
  .onBegin(() => { committed.value = false; })
  .onUpdate(event => { x.value = event.translationX; })
  .onEnd((event, success) => {
   if (success && !committed.value && Math.abs(event.translationX) >= 100) {
    committed.value = true; runOnJS(decide)(event.translationX > 0 ? 'like' : 'pass');
   }
   x.value = reduced?0:withSpring(0);
  }).onFinalize(() => { x.value = reduced?0:withSpring(0); });
 const animated = useAnimatedStyle(() => ({ transform: [{ translateX: reduced?0:x.value }, { rotate: `${reduced?0:x.value / 28}deg` }] }));

 const likeBgStyle = useAnimatedStyle(() => {
  const progress = reduced ? 0 : x.value > 0 ? Math.min(1, x.value / 80) : 0;
  return {
   opacity: progress,
   transform: [{ scale: 0.8 + progress * 0.25 }],
  };
 });

 const passBgStyle = useAnimatedStyle(() => {
  const progress = reduced ? 0 : x.value < 0 ? Math.min(1, -x.value / 80) : 0;
  return {
   opacity: progress,
   transform: [{ scale: 0.8 + progress * 0.25 }],
  };
 });

 const likeStampStyle = useAnimatedStyle(() => {
  const progress = reduced ? 0 : x.value > 0 ? Math.min(1, x.value / 60) : 0;
  return {
   opacity: progress,
   transform: [{ rotate: '-16deg' }, { scale: 0.75 + progress * 0.25 }],
  };
 });

 const passStampStyle = useAnimatedStyle(() => {
  const progress = reduced ? 0 : x.value < 0 ? Math.min(1, -x.value / 60) : 0;
  return {
   opacity: progress,
   transform: [{ rotate: '16deg' }, { scale: 0.75 + progress * 0.25 }],
  };
 });

 return <View style={{ opacity: disabled ? 0.45 : 1 }}>
  <View style={styles.cardContainer}>
   {/* Background Action Indicators (revealed as card moves) */}
   <View style={styles.backgroundIndicators}>
    <Animated.View style={[styles.backgroundIndicator, styles.passIndicator, passBgStyle]}>
     <Text style={styles.indicatorTextPass}>✕</Text>
     <Text style={styles.indicatorLabelPass}>{t('swipe_pass')}</Text>
    </Animated.View>
    <Animated.View style={[styles.backgroundIndicator, styles.likeIndicator, likeBgStyle]}>
     <Text style={styles.indicatorTextLike}>❤️</Text>
     <Text style={styles.indicatorLabelLike}>{t('swipe_like')}</Text>
    </Animated.View>
   </View>

   {/* Drag-sensitive Card with Overlay Badges */}
   <GestureDetector gesture={gesture}>
    <Animated.View style={animated}>
     {children}
     <Animated.View style={[styles.stampOverlay, styles.stampLike, likeStampStyle]} pointerEvents="none">
      <Text style={styles.stampLikeText}>❤️ {t('swipe_like').toUpperCase()}</Text>
     </Animated.View>
     <Animated.View style={[styles.stampOverlay, styles.stampPass, passStampStyle]} pointerEvents="none">
      <Text style={styles.stampPassText}>✕ {t('swipe_pass').toUpperCase()}</Text>
     </Animated.View>
    </Animated.View>
   </GestureDetector>

   {/* Floating Action Buttons Overlay directly on card bottom */}
   <View style={styles.actionsRow} pointerEvents="box-none">
    <Button
     testID="swipe-pass"
     accessibilityLabel={t('swipe_pass')}
     title="✕"
     disabled={disabled}
     onPress={() => decide('pass')}
     style={styles.passButton}
     textStyle={styles.passText}
    />
    <Pressable
     testID="swipe-superlike"
     accessibilityLabel={t('swipe_superlike', 'სუპერ ლაიქი')}
     accessibilityRole="button"
     disabled={disabled || !onSuperLike}
     onPress={onSuperLike}
     style={({ pressed }) => [
       styles.superLikeButton,
       pressed && styles.superLikeButtonPressed,
       (disabled || !onSuperLike) && { opacity: 0.5 },
     ]}
    >
     <View style={styles.superLikeStarContainer}>
       <Text style={styles.superLikeStarEmoji}>⭐</Text>
     </View>
    </Pressable>
    <Button
     testID="swipe-like"
     accessibilityLabel={t('swipe_like')}
     title="❤️"
     disabled={disabled}
     onPress={() => decide('like')}
     style={styles.likeButton}
     textStyle={styles.likeText}
    />
   </View>
  </View>
 </View>;
}

const styles = StyleSheet.create({
  cardContainer: {
    position: 'relative',
    borderRadius: theme.radius.card,
  },
  backgroundIndicators: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderRadius: theme.radius.card,
  },
  backgroundIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 18,
    minWidth: 84,
  },
  passIndicator: {
    backgroundColor: '#1E172B',
    borderWidth: 2,
    borderColor: '#43345E',
  },
  likeIndicator: {
    backgroundColor: '#2A1728',
    borderWidth: 2,
    borderColor: theme.colors.match,
  },
  indicatorTextPass: {
    fontSize: 36,
    fontWeight: '900',
    color: theme.colors.muted,
    lineHeight: 42,
  },
  indicatorLabelPass: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  indicatorTextLike: {
    fontSize: 36,
    lineHeight: 42,
  },
  indicatorLabelLike: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.match,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  stampOverlay: {
    position: 'absolute',
    top: 24,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 3,
    backgroundColor: theme.colors.surface,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  stampLike: {
    left: 20,
    borderColor: theme.colors.match,
  },
  stampLikeText: {
    color: theme.colors.match,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  stampPass: {
    right: 20,
    borderColor: '#544275',
  },
  stampPassText: {
    color: theme.colors.muted,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  actionsRow: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    zIndex: 40,
    paddingHorizontal: 16,
  },
  passButton: {
    width: 66,
    height: 66,
    minHeight: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(22, 10, 30, 0.94)',
    borderColor: '#EF4444',
    borderWidth: 2.5,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 8,
  },
  passText: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    color: '#EF4444',
    textAlign: 'center',
  },
  superLikeButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(8, 20, 44, 0.95)',
    borderWidth: 2.5,
    borderColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 8,
  },
  superLikeButtonPressed: {
    transform: [{ scale: 0.92 }],
    borderColor: '#7DF9FF',
    backgroundColor: '#0F326A',
  },
  superLikeStarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  superLikeStarEmoji: {
    fontSize: 26,
    lineHeight: 30,
    textAlign: 'center',
  },
  likeButton: {
    width: 66,
    height: 66,
    minHeight: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(38, 10, 26, 0.94)',
    borderColor: '#FF2A6D',
    borderWidth: 2.5,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF2A6D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.65,
    shadowRadius: 10,
    elevation: 8,
  },
  likeText: {
    fontSize: 30,
    lineHeight: 34,
    textAlign: 'center',
  },
});
