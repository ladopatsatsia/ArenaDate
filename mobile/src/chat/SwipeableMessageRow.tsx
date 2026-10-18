import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

interface SwipeableMessageRowProps {
  children: React.ReactNode;
  onReply: () => void;
  isOwn: boolean;
  disabled?: boolean;
}

export function SwipeableMessageRow({ children, onReply, isOwn, disabled }: SwipeableMessageRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const replyTriggered = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (disabled) return false;
        // Only capture horizontal movements that clearly dominate vertical scrolling
        return Math.abs(gestureState.dx) > 18 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
      },
      onPanResponderGrant: () => {
        replyTriggered.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        // Drag limit with damping
        const maxDrag = 65;
        const drag = Math.sign(gestureState.dx) * Math.min(Math.abs(gestureState.dx), maxDrag);
        translateX.setValue(drag);

        if (Math.abs(gestureState.dx) >= 38 && !replyTriggered.current) {
          replyTriggered.current = true;
        }
      },
      onPanResponderRelease: () => {
        if (replyTriggered.current) {
          onReply();
        }
        Animated.spring(translateX, {
          toValue: 0,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          friction: 6,
          tension: 50,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.replyIconContainer,
          isOwn ? styles.replyIconLeft : styles.replyIconRight,
          {
            opacity: translateX.interpolate({
              inputRange: [-40, -15, 0, 15, 40],
              outputRange: [1, 0.4, 0, 0.4, 1],
            }),
            transform: [
              {
                scale: translateX.interpolate({
                  inputRange: [-40, -15, 0, 15, 40],
                  outputRange: [1.1, 0.8, 0.4, 0.8, 1.1],
                }),
              },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.replyIcon}>↩️</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },
  replyIconContainer: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  replyIconLeft: {
    left: 8,
  },
  replyIconRight: {
    right: 8,
  },
  replyIcon: {
    fontSize: 16,
    color: '#ffffff',
  },
});
