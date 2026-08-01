import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, Platform } from 'react-native';

// ---------------------------------------------------------------------------
// ZannyPay Motion System
// ---------------------------------------------------------------------------
// A single source of truth for every animation in the app so motion feels
// like one designed language instead of per-screen guesswork.
//
// Rules of thumb used across the app:
//  - Entrances are fast and confident (220–420ms), exits are faster (160ms).
//  - Anything the finger touches responds within one frame (press springs).
//  - Money numbers ease out; they never bounce (trust > playfulness).
//  - Everything that can run on the native driver, does.
// ---------------------------------------------------------------------------

export const duration = {
  instant: 120,
  fast: 180,
  base: 260,
  slow: 420,
  slower: 640,
  count: 900, // balance / value count-up
};

export const easing = {
  // Standard product easing — quick out, soft landing.
  standard: Easing.bezier(0.2, 0.9, 0.2, 1),
  // Entering elements (decelerate).
  entrance: Easing.out(Easing.cubic),
  // Leaving elements (accelerate).
  exit: Easing.in(Easing.cubic),
  // Subtle overshoot for badges/icons that should feel "snapped" into place.
  snap: Easing.out(Easing.back(1.5)),
  // Continuous loops (shimmer, pulse).
  loop: Easing.inOut(Easing.sin),
};

export const spring = {
  // Finger-follow press feedback.
  press: { friction: 7, tension: 320, useNativeDriver: true },
  // Card / sheet entrances.
  entrance: { friction: 9, tension: 90, useNativeDriver: true },
  // Playful but controlled (tab pill, success tick).
  bouncy: { friction: 6, tension: 140, useNativeDriver: true },
  // Layout / width driven values (non native driver).
  layout: { friction: 9, tension: 70, useNativeDriver: false },
};

// Consistent stagger for lists and grids. Capped so long lists never feel slow.
export const stagger = (index = 0, step = 55, max = 8) =>
  Math.min(index, max) * step;

// ---------------------------------------------------------------------------
// Haptics — resolved lazily and defensively so a missing native module can
// never crash a screen. Every tap-level interaction uses `haptic.light()`.
// ---------------------------------------------------------------------------
let Haptics = null;
try {
  // eslint-disable-next-line global-require
  Haptics = require('expo-haptics');
} catch (e) {
  Haptics = null;
}

const safeHaptic = (fn) => () => {
  if (!Haptics || Platform.OS === 'web') return;
  try {
    fn();
  } catch (e) {
    /* haptics are a nicety, never a requirement */
  }
};

export const haptic = {
  light: safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  select: safeHaptic(() => Haptics.selectionAsync()),
  success: safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

// ---------------------------------------------------------------------------
// Accessibility: respect "Reduce Motion". Components fall back to a plain
// cross-fade (or no movement at all) when the user asked for less motion.
// ---------------------------------------------------------------------------
export function useReduceMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => {
        if (mounted) setReduced(!!value);
      })
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (value) => setReduced(!!value)
    );

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return reduced;
}

export default { duration, easing, spring, stagger, haptic, useReduceMotion };
