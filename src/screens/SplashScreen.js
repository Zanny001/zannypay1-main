import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../theme/colors';
import { fonts } from '../theme/fonts';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.85)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(10)).current;
  const dotAnims = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(taglineY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1.15, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 0.85, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Staggered loading-dot bounce, like a heartbeat trailing the logo.
    dotAnims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(anim, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 420, useNativeDriver: true }),
          Animated.delay((2 - i) * 180),
        ])
      ).start();
    });
  }, []);

  return (
    <LinearGradient colors={gradients.dark} style={styles.container}>
      <View style={styles.center}>
        <Animated.View style={[styles.glow, { transform: [{ scale: glowPulse }] }]} />

        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <LinearGradient colors={gradients.primary} style={styles.logoBadge}>
            <Text style={styles.logoLetter}>Z</Text>
          </LinearGradient>
        </Animated.View>

        <Animated.Text
          style={[
            styles.brandName,
            {
              opacity: logoOpacity,
              transform: [
                { translateY: logoOpacity.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
              ],
            },
          ]}
        >
          Zannypay
        </Animated.Text>

        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity, transform: [{ translateY: taglineY }] }]}>
          Money, moved beautifully.
        </Animated.Text>
      </View>

      <View style={styles.dotsRow}>
        {dotAnims.map((anim, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: anim, transform: [{ scale: anim }] }]} />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: width * 0.55,
    height: width * 0.55,
    borderRadius: width * 0.28,
    backgroundColor: 'rgba(124, 58, 237, 0.35)',
  },
  logoBadge: {
    width: 92,
    height: 92,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C3AED',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  logoLetter: { color: '#fff', fontSize: 42, fontFamily: fonts.extraBold },
  brandName: { color: '#fff', fontSize: 26, fontFamily: fonts.extraBold, marginTop: 22, letterSpacing: 0.5 },
  tagline: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontFamily: fonts.medium, marginTop: 8 },
  dotsRow: { position: 'absolute', bottom: 60, flexDirection: 'row', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
});
