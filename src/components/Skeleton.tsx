import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';

/** Quiet pulsing placeholder block; compose into card-shaped skeletons. */
export function SkeletonBlock({ width, height, radius = 10, style }: {
  width: number | `${number}%`; height: number; radius?: number; style?: ViewStyle;
}) {
  const [pulse] = useState(() => new Animated.Value(0.45));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.9, duration: 800, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.45, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.block, { width: width as string | number, height, borderRadius: radius, opacity: pulse }, style]} />;
}

/** Mirrors a class card while the list loads. */
export function ClassCardSkeleton() {
  return <View accessibilityElementsHidden style={styles.card}>
    <View style={styles.cardTop}>
      <SkeletonBlock width={64} height={18} radius={6} />
      <SkeletonBlock width={54} height={12} radius={6} />
    </View>
    <SkeletonBlock width="62%" height={15} />
    <SkeletonBlock width="40%" height={11} />
    <View style={styles.cardFoot}>
      <SkeletonBlock width={110} height={11} radius={6} />
      <SkeletonBlock width={84} height={28} radius={14} />
    </View>
  </View>;
}

/** Mirrors the attendance stat pair plus history cards. */
export function AttendanceSkeleton() {
  return <>
    <View style={styles.stats}>
      {[0, 1].map(i => <View key={i} style={styles.stat}><SkeletonBlock width={44} height={24} /><SkeletonBlock width={92} height={11} /></View>)}
    </View>
    {[0, 1, 2].map(i => <ClassCardSkeleton key={i} />)}
  </>;
}

const styles = StyleSheet.create({
  block: { backgroundColor: '#1b3049' },
  card: {
    backgroundColor: '#112033',
    borderWidth: 1,
    borderColor: '#263c55',
    borderRadius: 18,
    padding: 17,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  stats: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 18 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#263c55',
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#112033',
    alignItems: 'flex-start',
    gap: 8,
  },
});
