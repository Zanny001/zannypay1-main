import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { duration, easing, haptic, spring, useReduceMotion } from '../theme/motion';

// The "money moved" moment: an expanding ring, a springing badge and a
// checkmark that pops in. Used after transfers, bill payments and funding.
export default function SuccessCheck({ size = 88, color = '#0E9F6E', onDone }) {
  const reduceMotion = useReduceMotion();
  const badge = useRef(new Animated.Value(0)).current;
  const tick = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    haptic.success();
    if (reduceMotion) {
      badge.setValue(1);
      tick.setValue(1);
      onDone?.();
      return;
    }
    Animated.sequence([
      Animated.spring(badge, { ...spring.bouncy, toValue: 1 }),
      Animated.parallel([
        Animated.timing(tick, {
          toValue: 1,
          duration: duration.base,
          easing: easing.snap,
          useNativeDriver: true,
        }),
        Animated.timing(ring, {
          toValue: 1,
          duration: duration.slower,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => onDone?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.75] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={[styles.wrap, { width: size * 1.8, height: size * 1.8 }]}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            transform: [{ scale: badge }],
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: tick }] }}>
          <Ionicons name="checkmark" size={size * 0.5} color="#fff" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
  badge: { alignItems: 'center', justifyContent: 'center' },
});
