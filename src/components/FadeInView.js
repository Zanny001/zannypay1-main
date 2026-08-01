import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { duration, easing, spring, stagger as staggerFor, useReduceMotion } from '../theme/motion';

// Consistent entrance for every surface in the app.
//
// Backwards compatible with the original API (`delay`, `style`) and adds:
//  - `index`      → automatic stagger for lists/grids
//  - `from`       → 'bottom' | 'top' | 'left' | 'right' | 'none'
//  - `distance`   → travel distance
//  - `scaleFrom`  → subtle scale-up for cards/hero surfaces
//  - respects the OS "Reduce Motion" setting (fades only, no travel)
export default function FadeInView({
  children,
  delay = 0,
  index,
  stagger = 55,
  from = 'bottom',
  distance = 16,
  scaleFrom = 1,
  style,
}) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const travel = useRef(new Animated.Value(1)).current; // 1 = offset, 0 = settled
  const scale = useRef(new Animated.Value(scaleFrom)).current;

  const totalDelay = delay + (typeof index === 'number' ? staggerFor(index, stagger) : 0);

  useEffect(() => {
    if (reduceMotion) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: duration.fast,
        delay: totalDelay,
        useNativeDriver: true,
      }).start();
      travel.setValue(0);
      scale.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: duration.slow,
        delay: totalDelay,
        easing: easing.standard,
        useNativeDriver: true,
      }),
      Animated.spring(travel, { ...spring.entrance, toValue: 0, delay: totalDelay }),
      Animated.spring(scale, { ...spring.entrance, toValue: 1, delay: totalDelay }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalDelay, reduceMotion]);

  const offset = travel.interpolate({
    inputRange: [0, 1],
    outputRange: [0, distance],
  });

  const transform = [{ scale }];
  if (from === 'bottom') transform.push({ translateY: offset });
  if (from === 'top') transform.push({ translateY: Animated.multiply(offset, -1) });
  if (from === 'right') transform.push({ translateX: offset });
  if (from === 'left') transform.push({ translateX: Animated.multiply(offset, -1) });

  return (
    <Animated.View style={[style, { opacity, transform }]}>{children}</Animated.View>
  );
}
