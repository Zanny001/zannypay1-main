import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { duration, easing, haptic, spring, useReduceMotion } from '../theme/motion';
import { Pressable } from 'react-native';

// Primary CTA. Same props as before (`title`, `onPress`, `loading`,
// `disabled`, `variant`, `style`) — only the feel changed:
//  - springs to 0.965 with a soft shadow drop on press-in
//  - a light haptic tick lands with the finger
//  - a slow specular sheen sweeps the gradient while idle (stops when busy)
//  - the label cross-fades into the spinner instead of snapping
export default function GradientButton({ title, onPress, loading, disabled, variant = 'primary', style }) {
  const reduceMotion = useReduceMotion();
  const colorsSet = variant === 'gold' ? gradients.gold : gradients.primary;
  const textColor = variant === 'gold' ? '#1A1523' : '#FFFFFF';

  const scale = useRef(new Animated.Value(1)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const busy = useRef(new Animated.Value(0)).current;

  const isBusy = !!loading;
  const isInactive = disabled || isBusy;

  useEffect(() => {
    Animated.timing(busy, {
      toValue: isBusy ? 1 : 0,
      duration: duration.fast,
      easing: easing.standard,
      useNativeDriver: true,
    }).start();
  }, [isBusy, busy]);

  useEffect(() => {
    if (reduceMotion || isInactive) {
      sheen.stopAnimation();
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(2200),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sheen, reduceMotion, isInactive]);

  const press = (toValue) =>
    Animated.spring(scale, { ...spring.press, toValue }).start();

  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-160, 420] });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        if (isInactive) return;
        haptic.medium();
        press(reduceMotion ? 1 : 0.965);
      }}
      onPressOut={() => press(1)}
      disabled={isInactive}
      style={style}
    >
      <Animated.View style={[disabled && { opacity: 0.5 }, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={colorsSet}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {!reduceMotion && !isInactive && (
            <Animated.View
              pointerEvents="none"
              style={[styles.sheenWrap, { transform: [{ translateX: sheenX }, { rotate: '18deg' }] }]}
            >
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.28)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.sheen}
              />
            </Animated.View>
          )}

          <Animated.View style={{ opacity: busy.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
            <Text style={[styles.text, { color: textColor }]}>{title}</Text>
          </Animated.View>

          <Animated.View style={[styles.spinnerLayer, { opacity: busy }]} pointerEvents="none">
            <Spinner color={textColor} active={isBusy} />
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// A smoother, brand-coloured spinner: a rotating arc rather than the stock
// platform indicator, so the loading state matches the rest of the motion.
function Spinner({ color, active }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return undefined;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 850,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [active, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={[
        styles.spinner,
        { borderColor: `${color}33`, borderTopColor: color, transform: [{ rotate }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
  sheenWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'flex-start' },
  sheen: { width: 90, height: '260%', marginTop: -20 },
  spinnerLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 22, height: 22, borderRadius: 11, borderWidth: 2.5 },
});
