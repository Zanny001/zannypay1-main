import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/fonts';
import PressableScale from './PressableScale';
import { duration, easing as motionEasing, haptic, spring, useReduceMotion } from '../theme/motion';

const TYPE_META = {
  success: { icon: 'checkmark-circle', gradient: ['#0E9F6E', '#34D399'] },
  error: { icon: 'close-circle', gradient: ['#DC2626', '#F87171'] },
  warning: { icon: 'warning', gradient: ['#F59E0B', '#FBBF24'] },
  info: { icon: 'information-circle', gradient: ['#0EA5E9', '#38BDF8'] },
  confirm: { icon: 'help-circle', gradient: ['#6236FF', '#8B5CF6'] },
};

export default function CustomAlert({ visible, title, message, buttons, type = 'info', onRequestClose }) {
  const { theme, scheme } = useTheme();
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const iconPulse = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  const meta = TYPE_META[type] || TYPE_META.info;
  const resolvedButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

  useEffect(() => {
    if (!visible) return;

    // Feedback matched to intent: success chimes, errors thud, the rest ticks.
    if (type === 'success') haptic.success();
    else if (type === 'error') haptic.error();
    else if (type === 'warning') haptic.warning();
    else haptic.light();

    scale.setValue(reduceMotion ? 1 : 0.9);
    opacity.setValue(0);
    iconPulse.setValue(reduceMotion ? 1 : 0);
    ring.setValue(0);

    Animated.parallel([
      Animated.spring(scale, { ...spring.entrance, toValue: 1 }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: duration.base,
        easing: motionEasing.standard,
        useNativeDriver: true,
      }),
      Animated.timing(iconPulse, {
        toValue: 1,
        duration: duration.slow,
        delay: 90,
        easing: motionEasing.snap,
        useNativeDriver: true,
      }),
      Animated.timing(ring, {
        toValue: 1,
        duration: 900,
        delay: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, type, iconPulse, opacity, scale, ring, reduceMotion]);

  const handlePress = (btn) => {
    onRequestClose?.();
    // Slight delay so the modal closing animation isn't fighting the
    // caller's own follow-up UI change (e.g. another modal opening).
    setTimeout(() => btn.onPress?.(), 80);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onRequestClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.overlayFill, { opacity, backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.75)' : 'rgba(10,10,20,0.55)' }]} />
        <Animated.View style={[styles.card, { backgroundColor: theme.surface, opacity, transform: [{ scale }] }]}>
          <View style={styles.iconOuter}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.iconRing,
                {
                  borderColor: meta.gradient[0],
                  opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
                  transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.7] }) }],
                },
              ]}
            />
            <Animated.View style={{ transform: [{ scale: iconPulse }] }}>
              <LinearGradient colors={meta.gradient} style={styles.iconBadge}>
                <Ionicons name={meta.icon} size={32} color="#fff" />
              </LinearGradient>
            </Animated.View>
          </View>

          {!!title && <Text style={[styles.title, { color: theme.text }]}>{title}</Text>}
          {!!message && <Text style={[styles.message, { color: theme.textMuted }]}>{message}</Text>}

          <View style={[styles.buttonRow, resolvedButtons.length > 2 && styles.buttonColumn]}>
            {resolvedButtons.map((btn, idx) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const isPrimary = !isDestructive && !isCancel;
              return (
                <PressableScale
                  key={idx}
                  onPress={() => handlePress(btn)}
                  activeScale={0.95}
                  style={[
                    styles.button,
                    resolvedButtons.length > 2 && styles.buttonFullWidth,
                    isPrimary && { backgroundColor: theme.primary },
                    isDestructive && styles.buttonDestructive,
                    isCancel && { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isPrimary && { color: '#fff' },
                      isDestructive && { color: '#fff' },
                      isCancel && { color: theme.textMuted },
                    ]}
                  >
                    {btn.text}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  overlayFill: { ...StyleSheet.absoluteFillObject },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 15 },
    elevation: 20,
  },
  iconOuter: { marginBottom: 18, alignItems: 'center', justifyContent: 'center' },
  iconRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 2 },
  iconBadge: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  title: { fontSize: 19, fontWeight: '800', fontFamily: fonts.extraBold, textAlign: 'center', marginBottom: 8 },
  message: { fontSize: 14, fontFamily: fonts.regular, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  buttonRow: { flexDirection: 'row', width: '100%', gap: 10 },
  buttonColumn: { flexDirection: 'column-reverse' },
  button: { flex: 1, paddingVertical: 15, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  buttonFullWidth: { flex: undefined, width: '100%' },
  buttonDestructive: { backgroundColor: '#DC2626' },
  buttonText: { fontSize: 15, fontWeight: '700', fontFamily: fonts.bold },
});
