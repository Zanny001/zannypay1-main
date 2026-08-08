import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { duration, easing, spring, stagger, useReduceMotion } from '../theme/motion';

// Wraps any content with an entrance animation, driven by the shared motion
// tokens so every screen using this — 13+ across the app — moves in one
// consistent, designed language rather than each screen guessing its own
// timing. Backward-compatible with the original `{ children, delay, style }`
// API; the new props below are opt-in.
//
//   index      - pass a list index instead of computing `delay` yourself;
//                staggers automatically and caps out on long lists.
//   from       - 'up' (default), 'down', 'left', 'right', or 'scale'.
//   duration   - override the entrance duration for this instance.
//
// Respects the OS "Reduce Motion" setting: falls back to a plain, fast
// cross-fade with no translation/scale when it's on.
export default function FadeInView({ children, delay, index, from = 'up', duration: durationOverride, style }) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(from === 'scale' ? 0.94 : 1)).current;

  const resolvedDelay = delay !== undefined ? delay : index !== undefined ? stagger(index) : 0;

  useEffect(() => {
    if (reduceMotion) {
      Animated.timing(opacity, { toValue: 1, duration: duration.fast, useNativeDriver: true }).start();
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: durationOverride || duration.slow,
        delay: resolvedDelay,
        easing: easing.entrance,
        useNativeDriver: true,
      }),
      Animated.spring(translate, { toValue: 0, delay: resolvedDelay, ...spring.entrance }),
      ...(from === 'scale' ? [Animated.spring(scale, { toValue: 1, delay: resolvedDelay, ...spring.entrance })] : []),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const offset = 16;
  const translateStyle =
    from === 'left'
      ? { translateX: translate.interpolate({ inputRange: [0, 1], outputRange: [0, -offset] }) }
      : from === 'right'
      ? { translateX: translate.interpolate({ inputRange: [0, 1], outputRange: [0, offset] }) }
      : from === 'down'
      ? { translateY: translate.interpolate({ inputRange: [0, 1], outputRange: [0, -offset] }) }
      : { translateY: translate.interpolate({ inputRange: [0, 1], outputRange: [0, offset] }) }; // 'up' (default) and 'scale' share a gentle rise

  return (
    <Animated.View style={[style, { opacity, transform: [translateStyle, { scale }] }]}>
      {children}
    </Animated.View>
  );
}
