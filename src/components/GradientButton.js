import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { duration, easing, spring, haptic, useReduceMotion } from '../theme/motion';

// The app's primary CTA — used across nearly every screen with a
// money-moving or account-changing action, so this is the single highest-
// leverage place to spend motion polish: a press-spring + haptic tick on
// every tap, a slow idle shimmer sweep so primary buttons read as "the
// important one" even at rest, and a cross-fade into the loading spinner
// instead of an abrupt swap. Respects Reduce Motion — press feedback stays
// functional but shrinks to a simple opacity change, no spring/shimmer.
export default function GradientButton({ title, onPress, loading, disabled, variant = 'primary', style }) {
  const reduceMotion = useReduceMotion();
  const colorsSet = variant === 'gold' ? gradients.gold : gradients.primary;
  const textColor = variant === 'gold' ? '#1A1523' : '#FFFFFF';

  const pressScale = useRef(new Animated.Value(1)).current;
  const shimmerX = useRef(new Animated.Value(-1)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion || disabled) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, { toValue: 1, duration: 1800, easing: easing.loop, useNativeDriver: true }),
        Animated.timing(shimmerX, { toValue: -1, duration: 0, useNativeDriver: true }),
        Animated.delay(1200),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, disabled, shimmerX]);

  useEffect(() => {
    Animated.timing(contentOpacity, { toValue: 1, duration: duration.fast, useNativeDriver: true }).start();
  }, [loading, contentOpacity]);

  const handlePressIn = () => {
    if (reduceMotion) return;
    Animated.spring(pressScale, { toValue: 0.97, ...spring.press }).start();
  };
  const handlePressOut = () => {
    if (reduceMotion) return;
    Animated.spring(pressScale, { toValue: 1, ...spring.press }).start();
  };
  const handlePress = () => {
    haptic.light();
    onPress?.();
  };

  const shimmerTranslate = shimmerX.interpolate({ inputRange: [-1, 1], outputRange: [-140, 140] });

  return (
    <Animated.View style={[style, { transform: [{ scale: reduceMotion ? 1 : pressScale }] }, disabled && { opacity: 0.5 }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
      >
        <LinearGradient colors={colorsSet} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
          {!reduceMotion && !disabled && (
            <Animated.View
              pointerEvents="none"
              style={[styles.shimmer, { transform: [{ translateX: shimmerTranslate }, { rotate: '20deg' }] }]}
            />
          )}
          <Animated.View style={{ opacity: contentOpacity }}>
            {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.text, { color: textColor }]}>{title}</Text>}
          </Animated.View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
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
  shimmer: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 50,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: fonts.bold,
  },
});
