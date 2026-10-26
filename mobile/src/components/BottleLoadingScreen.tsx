import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

interface BottleLoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export function BottleLoadingScreen({
  message = 'loading....',
  subMessage,
}: BottleLoadingScreenProps) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.85)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Continuous 360-degree smooth spin
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Pulsing glow for the emerald/gold halo
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.9,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Gentle scale pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.96,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    spinLoop.start();
    glowLoop.start();
    pulseLoop.start();

    return () => {
      spinLoop.stop();
      glowLoop.stop();
      pulseLoop.stop();
    };
  }, [spinAnim, glowAnim, pulseAnim]);

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container} testID="bottle-loading-screen">
      {/* Background Ambient Glow */}
      <Animated.View
        style={[
          styles.ambientGlow,
          {
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      {/* Rotating Bottle Container */}
      <View style={styles.bottleWrapper}>
        <Animated.View
          style={[
            styles.bottleTransform,
            {
              transform: [{ rotate: spinInterpolation }],
            },
          ]}
        >
          {/* Realistic Luxury Bottle Geometry */}
          <View style={styles.bottleVisual}>
            {/* Directional Gold Pointer Gem at Tip */}
            <View style={styles.bottlePointerGem}>
              <View style={styles.pointerArrowTip} />
            </View>

            {/* Gold Foiled Cork / Capsule */}
            <View style={styles.bottleFoilCap}>
              <View style={styles.bottleFoilRing} />
            </View>

            {/* Bottle Neck (Tapered Emerald Glass) */}
            <View style={styles.bottleNeck} />

            {/* Bottle Shoulders */}
            <View style={styles.bottleShoulders} />

            {/* Bottle Body with Glass Highlight Sheen & Luxury Arena Label */}
            <View style={styles.bottleBody}>
              {/* 3D Glass Specular Reflection Highlight */}
              <View style={styles.glassSpecularSheen} />
              <View style={styles.glassSecondarySheen} />

              {/* Luxury Label with ARENA branding */}
              <View style={styles.bottleLabel}>
                <Text style={styles.bottleLabelText}>ARENA</Text>
              </View>

              {/* Base Rim */}
              <View style={styles.bottleBaseRim} />
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Clean Centered Loading Status Info */}
      <View style={styles.textContainer}>
        <Text style={styles.statusMessage}>{message}</Text>
        {subMessage && <Text style={styles.subMessage}>{subMessage}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0716',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  ambientGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  bottleWrapper: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  bottleTransform: {
    width: 70,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottleVisual: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bottlePointerGem: {
    alignItems: 'center',
    marginBottom: 2,
  },
  pointerArrowTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#F59E0B',
  },
  bottleFoilCap: {
    width: 14,
    height: 16,
    backgroundColor: '#D97706',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: '#F59E0B',
    alignItems: 'center',
  },
  bottleFoilRing: {
    width: 14,
    height: 3,
    backgroundColor: '#FEF08A',
    marginTop: 4,
  },
  bottleNeck: {
    width: 13,
    height: 18,
    backgroundColor: '#064e3b',
    borderWidth: 0.8,
    borderColor: 'rgba(16, 185, 129, 0.45)',
  },
  bottleShoulders: {
    width: 36,
    height: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#04382a',
    borderWidth: 0.8,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  bottleBody: {
    width: 42,
    height: 56,
    backgroundColor: '#022c22',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    position: 'relative',
  },
  glassSpecularSheen: {
    position: 'absolute',
    left: 4,
    top: 0,
    bottom: 0,
    width: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 2,
  },
  glassSecondarySheen: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 1.5,
  },
  bottleLabel: {
    width: 32,
    height: 15,
    backgroundColor: '#18181b',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottleLabelText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#F59E0B',
    letterSpacing: 1,
  },
  bottleBaseRim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 18,
  },
  statusMessage: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
    letterSpacing: 2.5,
    textAlign: 'center',
  },
  subMessage: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
