import React, { createContext, useContext, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { theme } from './theme';

// Shared animation context so all skeleton items on the screen pulse in perfect unison
const ShimmerContext = createContext<Animated.Value | null>(null);

export function ShimmerProvider({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return <ShimmerContext.Provider value={anim}>{children}</ShimmerContext.Provider>;
}

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Base glowing skeleton element that pulses with ARENA's purple-tinted shine.
 */
export function Skeleton({
  width,
  height,
  borderRadius = 10,
  style,
}: SkeletonProps) {
  const contextAnim = useContext(ShimmerContext);
  const fallbackAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (contextAnim || process.env.NODE_ENV === 'test') return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(fallbackAnim, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(fallbackAnim, {
          toValue: 0,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [contextAnim, fallbackAnim]);

  const anim = contextAnim || fallbackAnim;

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.05)', 'rgba(139, 92, 246, 0.22)'],
  });

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(54, 43, 78, 0.35)', 'rgba(139, 92, 246, 0.45)'],
  });

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="იტვირთება..."
      style={[
        styles.skeletonBase,
        {
          width: width as DimensionValue,
          height: height as DimensionValue,
          borderRadius,
          backgroundColor,
          borderColor,
        },
        style,
      ]}
    />
  );
}

export function SkeletonAvatar({ size = 48, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;
}

export function SkeletonText({
  width = '100%',
  height = 14,
  borderRadius = 6,
  style,
}: {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <Skeleton width={width} height={height} borderRadius={borderRadius} style={style} />;
}

/**
 * Generic list skeleton with avatar and multiple text lines.
 */
export function ListSkeleton({ count = 3, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <ShimmerProvider>
      <View style={[styles.listContainer, style]}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.cardContainer}>
            <View style={styles.row}>
              <SkeletonAvatar size={48} />
              <View style={styles.columnFill}>
                <SkeletonText width="55%" height={16} />
                <SkeletonText width="85%" height={12} style={{ marginTop: 8 }} />
              </View>
            </View>
          </View>
        ))}
      </View>
    </ShimmerProvider>
  );
}

/**
 * Discovery / Dating swipe card skeleton.
 * Mimics a full dating profile card loading with glowing photo area, bio pills, and action buttons.
 */
export function DiscoveryCardSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <ShimmerProvider>
      <View style={[styles.discoveryWrapper, style]}>
        {/* Main swipe card skeleton */}
        <View style={styles.swipeCardPlaceholder}>
          <Skeleton width="100%" height="100%" borderRadius={24} style={styles.swipeCardPhoto} />

          {/* Floating badge top-right */}
          <View style={styles.discoveryTopBadge}>
            <Skeleton width={70} height={26} borderRadius={13} />
          </View>

          {/* Bottom details overlay */}
          <View style={styles.discoveryBottomOverlay}>
            <View style={styles.row}>
              <Skeleton width={140} height={26} borderRadius={8} />
              <Skeleton width={50} height={26} borderRadius={8} style={{ marginLeft: 8 }} />
            </View>
            <Skeleton width={110} height={16} borderRadius={6} style={{ marginTop: 8 }} />

            {/* Interest chips */}
            <View style={[styles.row, { marginTop: 12, gap: 8 }]}>
              <Skeleton width={68} height={24} borderRadius={12} />
              <Skeleton width={80} height={24} borderRadius={12} />
              <Skeleton width={72} height={24} borderRadius={12} />
            </View>

            <Skeleton width="90%" height={12} borderRadius={6} style={{ marginTop: 12 }} />
            <Skeleton width="70%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
          </View>
        </View>

        {/* Bottom swipe action buttons (Pass, Like, Superlike) */}
        <View style={styles.discoveryButtonsRow}>
          <Skeleton width={56} height={56} borderRadius={28} />
          <Skeleton width={68} height={68} borderRadius={34} />
          <Skeleton width={56} height={56} borderRadius={28} />
        </View>
      </View>
    </ShimmerProvider>
  );
}

/**
 * Matches & Requests card list skeleton.
 * Displays glowing chat/match cards with circular avatar, name, message preview and action pill.
 */
export function MatchListSkeleton({ count = 4, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <ShimmerProvider>
      <View style={[styles.listContainer, style]}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.matchCardContainer}>
            <View style={styles.row}>
              <SkeletonAvatar size={54} />
              <View style={[styles.columnFill, { marginLeft: 14 }]}>
                <View style={styles.rowBetween}>
                  <Skeleton width={130} height={16} borderRadius={6} />
                  <Skeleton width={44} height={12} borderRadius={6} />
                </View>
                <Skeleton width="80%" height={13} borderRadius={6} style={{ marginTop: 8 }} />
                <View style={[styles.row, { marginTop: 8, gap: 6 }]}>
                  <Skeleton width={60} height={18} borderRadius={9} />
                  <Skeleton width={50} height={18} borderRadius={9} />
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ShimmerProvider>
  );
}

/**
 * Today Plans feed card list skeleton.
 * Displays glowing cards with author avatar, time chip, plan title, description lines, city/people pills.
 */
export function TodayPlansSkeleton({ count = 3, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <ShimmerProvider>
      <View style={[styles.listContainer, style]}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.planCardContainer}>
            {/* Header: avatar + author + time */}
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                <SkeletonAvatar size={42} />
                <View style={{ marginLeft: 10 }}>
                  <Skeleton width={90} height={15} borderRadius={6} />
                  <Skeleton width={60} height={11} borderRadius={5} style={{ marginTop: 5 }} />
                </View>
              </View>
              <Skeleton width={80} height={24} borderRadius={12} />
            </View>

            {/* Title & description */}
            <Skeleton width="75%" height={18} borderRadius={6} style={{ marginTop: 14 }} />
            <Skeleton width="92%" height={13} borderRadius={5} style={{ marginTop: 8 }} />
            <Skeleton width="60%" height={13} borderRadius={5} style={{ marginTop: 6 }} />

            {/* Footer row: city, participants, join button */}
            <View style={[styles.rowBetween, { marginTop: 14 }]}>
              <View style={[styles.row, { gap: 8 }]}>
                <Skeleton width={70} height={24} borderRadius={12} />
                <Skeleton width={50} height={24} borderRadius={12} />
              </View>
              <Skeleton width={100} height={32} borderRadius={12} />
            </View>
          </View>
        ))}
      </View>
    </ShimmerProvider>
  );
}

/**
 * Bottle Game table lobby skeleton.
 * Displays glowing table cards with player seat slots, title, and join button.
 */
export function GameLobbySkeleton({ count = 3, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <ShimmerProvider>
      <View style={[styles.listContainer, style]}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.tableCardContainer}>
            {/* Header: table title + capacity badge */}
            <View style={styles.rowBetween}>
              <Skeleton width={130} height={18} borderRadius={6} />
              <Skeleton width={75} height={22} borderRadius={11} />
            </View>

            {/* Player seat slots (6 circles) */}
            <View style={styles.seatsRow}>
              {Array.from({ length: 6 }).map((_, sIdx) => (
                <Skeleton key={sIdx} width={38} height={38} borderRadius={19} />
              ))}
            </View>

            {/* Balance info line */}
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <Skeleton width={140} height={13} borderRadius={6} />
            </View>

            {/* Bottom join button skeleton */}
            <Skeleton width="100%" height={44} borderRadius={12} style={{ marginTop: 12 }} />
          </View>
        ))}
      </View>
    </ShimmerProvider>
  );
}

/**
 * Profile screen skeleton.
 * Displays glowing avatar, photo grid, bio lines, and preference chips.
 */
export function ProfileSkeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <ShimmerProvider>
      <View style={[styles.listContainer, style]}>
        {/* Profile Header */}
        <View style={styles.profileHeaderCard}>
          <SkeletonAvatar size={90} style={{ alignSelf: 'center' }} />
          <Skeleton width={150} height={22} borderRadius={6} style={{ alignSelf: 'center', marginTop: 14 }} />
          <Skeleton width={100} height={14} borderRadius={5} style={{ alignSelf: 'center', marginTop: 8 }} />
        </View>

        {/* 6 Photo slots */}
        <View style={styles.photosGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="31%" height={110} borderRadius={14} style={{ marginBottom: 10 }} />
          ))}
        </View>

        {/* Bio Card */}
        <View style={styles.cardContainer}>
          <Skeleton width={120} height={16} borderRadius={6} />
          <Skeleton width="95%" height={13} borderRadius={5} style={{ marginTop: 10 }} />
          <Skeleton width="85%" height={13} borderRadius={5} style={{ marginTop: 6 }} />
          <Skeleton width="65%" height={13} borderRadius={5} style={{ marginTop: 6 }} />
        </View>
      </View>
    </ShimmerProvider>
  );
}

const styles = StyleSheet.create({
  skeletonBase: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  listContainer: {
    padding: theme.space.md,
    gap: theme.space.md,
  },
  cardContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.space.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  matchCardContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  planCardContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tableCardContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  seatsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  profileHeaderCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.space.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  discoveryWrapper: {
    width: '100%',
    padding: theme.space.md,
    alignItems: 'center',
    gap: 16,
  },
  swipeCardPlaceholder: {
    width: '100%',
    height: 460,
    backgroundColor: theme.colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  swipeCardPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  discoveryTopBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  discoveryBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(18, 14, 28, 0.75)',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  discoveryButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  columnFill: {
    flex: 1,
  },
});
