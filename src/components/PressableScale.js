import React, { useCallback, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { haptic, spring, useReduceMotion } from '../theme/motion';

// The single touch primitive for the whole app.
// - Springs down to `activeScale` the instant the finger lands (native driver).
// - Optionally dims slightly, so it works on both light and dark surfaces.
// - Fires a light haptic tick on press-in for tactile confirmation.
//
// Drop-in replacement for TouchableOpacity: same `onPress`, `disabled`,
// `style` and `children` contract, so wiring to existing handlers (and the
// backend calls behind them) is unchanged.
export default function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  activeScale = 0.96,
  dim = true,
  hapticFeedback = true,
  hitSlop = 6,
  ...rest
}) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback(
    (toScale, toOpacity) => {
      Animated.parallel([
        Animated.spring(scale, { ...spring.press, toValue: toScale }),
        Animated.spring(opacity, { ...spring.press, toValue: toOpacity }),
      ]).start();
    },
    [opacity, scale]
  );

  const handlePressIn = () => {
    if (disabled) return;
    if (hapticFeedback) haptic.light();
    animateTo(reduceMotion ? 1 : activeScale, dim ? 0.88 : 1);
  };

  const handlePressOut = () => animateTo(1, 1);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
      {...rest}
    >
      <Animated.View style={[style, { opacity, transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
