import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';
import { duration, easing, useReduceMotion } from '../theme/motion';

// Counts a numeric value up (or down) to its new target with a decelerating
// ease, so a balance change reads as *movement of money* rather than a
// number silently swapping out.
//
// Purely presentational: the value still comes from WalletContext/the API.
export default function AnimatedNumber({
  value = 0,
  format = (n) => String(Math.round(n)),
  style,
  hidden = false,
  hiddenPlaceholder = '••••••',
  animateOnMount = true,
  numberOfLines,
}) {
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(animateOnMount ? 0 : Number(value) || 0)).current;
  const [display, setDisplay] = useState(() => format(animateOnMount ? 0 : Number(value) || 0));

  // Fade/slide the whole number when toggling between hidden and visible.
  const revealAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(format(v)));
    return () => anim.removeListener(id);
    // `format` is intentionally read fresh on each tick via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim, format]);

  useEffect(() => {
    const target = Number(value) || 0;
    if (reduceMotion) {
      anim.setValue(target);
      setDisplay(format(target));
      return;
    }
    Animated.timing(anim, {
      toValue: target,
      duration: duration.count,
      easing: easing.entrance,
      useNativeDriver: false, // drives a text string, not a transform
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduceMotion]);

  useEffect(() => {
    revealAnim.setValue(0);
    Animated.timing(revealAnim, {
      toValue: 1,
      duration: reduceMotion ? 0 : duration.base,
      easing: easing.standard,
      useNativeDriver: true,
    }).start();
  }, [hidden, revealAnim, reduceMotion]);

  const translateY = revealAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <Animated.View style={{ opacity: revealAnim, transform: [{ translateY }] }}>
      <Text style={style} numberOfLines={numberOfLines}>
        {hidden ? hiddenPlaceholder : display}
      </Text>
    </Animated.View>
  );
}
