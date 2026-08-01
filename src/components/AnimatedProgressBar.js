import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { spring, useReduceMotion } from '../theme/motion';

// A smooth, flicker-free progress bar.
//
// The fill is driven by a native-driver scaleX transform (rather than an
// animated width), which keeps it perfectly smooth on the UI thread, and a
// slow travelling highlight makes active goals feel alive.
export default function AnimatedProgressBar({
  percentage = 0,
  color = colors.primary,
  height = 8,
  trackColor = '#EFEFEF',
  glow = true,
}) {
  const reduceMotion = useReduceMotion();
  const anim = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(0)).current;
  const clamped = Math.max(0, Math.min(100, percentage));

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(clamped / 100);
      return;
    }
    Animated.spring(anim, {
      ...spring.entrance,
      toValue: clamped / 100,
    }).start();
  }, [anim, clamped, reduceMotion]);

  useEffect(() => {
    if (!glow || reduceMotion || clamped <= 0) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(900),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sheen, glow, reduceMotion, clamped]);

  const sheenX = sheen.interpolate({ inputRange: [0, 1], outputRange: [-80, 260] });

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color,
            borderRadius: height / 2,
            transform: [{ scaleX: anim }],
          },
        ]}
      >
        {glow && !reduceMotion && (
          <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ translateX: sheenX }] }]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.5)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ width: 70, height: '100%' }}
            />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  // scaleX grows from the left edge, matching how a progress bar should fill.
  fill: { height: '100%', width: '100%', transformOrigin: 'left', overflow: 'hidden' },
});
