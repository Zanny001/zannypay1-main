import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useReduceMotion } from '../theme/motion';

// A shimmering placeholder block used while data is in flight, so screens
// never flash empty. Purely visual — it replaces nothing in the data layer.
export default function Skeleton({ width = '100%', height = 16, radius = 8, style }) {
  const { theme, scheme } = useTheme();
  const reduceMotion = useReduceMotion();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer, reduceMotion]);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-140, 220],
  });

  const highlight =
    scheme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.85)';

  return (
    <View
      style={[
        styles.base,
        { width, height, borderRadius: radius, backgroundColor: theme.border },
        style,
      ]}
    >
      {!reduceMotion && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <LinearGradient
            colors={['transparent', highlight, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.sheen}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  sheen: { width: 140, height: '100%' },
});
