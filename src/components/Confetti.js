import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, Easing, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PIECE_COLORS = ['#5B21B6', '#F5B700', '#0EA5E9', '#16A34A', '#DC2626', '#7C3AED'];

// A small celebratory burst — no lottie/confetti-cannon dependency, just
// Animated.Value driven by the native driver. `count` scales up for
// milestone streaks so a 7-day streak visibly feels bigger than a normal
// day's check-in.
export default function Confetti({ count = 24, origin = { x: SCREEN_WIDTH / 2, y: 0 } }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map(() => ({
        anim: new Animated.Value(0),
        angle: Math.random() * Math.PI * 2,
        distance: 80 + Math.random() * 140,
        rotation: Math.random() * 360,
        size: 6 + Math.random() * 6,
        color: PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)],
      })),
    [count]
  );

  useEffect(() => {
    Animated.stagger(
      6,
      pieces.map((p) =>
        Animated.timing(p.anim, {
          toValue: 1,
          duration: 900 + Math.random() * 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, [pieces]);

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {pieces.map((p, i) => {
        const translateX = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.distance] });
        const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(p.angle) * p.distance + 60] });
        const opacity = p.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        const rotate = p.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotation}deg`] });
        const scale = p.anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0.8] });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: origin.x,
              top: origin.y,
              width: p.size,
              height: p.size * 1.6,
              backgroundColor: p.color,
              borderRadius: 2,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}
