import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import FadeInView from './FadeInView';

export default function Card({ children, style, index, animate = true, delay = 0 }) {
  // Defaults to a light surface: most screens using this component
  // (Support, Beneficiaries, Notifications, Analytics rows) render dark
  // text on top of it. Screens that want the dark-mode surface pass their
  // own `backgroundColor: theme.surface` in `style`, which overrides this.
  //
  // Cards now lift into place on mount (and stagger when given an `index`).
  // Pass `animate={false}` to opt out.
  const content = <View style={[styles.card, style]}>{children}</View>;

  if (!animate) return content;

  return (
    <FadeInView index={index} delay={delay} distance={14} scaleFrom={0.985}>
      {content}
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
});
