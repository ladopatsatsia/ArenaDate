import { Button } from '../components/UI';
import { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, runOnJS } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '../components/useReducedMotion';
export function SwipeCard({ children, disabled, decide }: PropsWithChildren<{ disabled: boolean; decide: (kind: 'like' | 'pass') => void }>) {
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
 return <View style={{ gap: 12, opacity: disabled ? 0.45 : 1 }}>
  <GestureDetector gesture={gesture}><Animated.View style={animated}>{children}</Animated.View></GestureDetector>
  <View style={{ flexDirection: 'row',flexWrap:'wrap',gap:12, justifyContent: 'space-evenly', minHeight: 48 }}>
   <Button testID="swipe-pass" accessibilityLabel={t('swipe_pass')} title={t('swipe_pass')} disabled={disabled} onPress={() => decide('pass')} />
   <Button testID="swipe-like" variant="primary" accessibilityLabel={t('swipe_like')} title={t('swipe_like')} disabled={disabled} onPress={() => decide('like')} />
  </View>
 </View>;
}
