import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// Single source of truth for "how do we show this person" across the app —
// Dashboard header, Profile tab, ProfileInfoScreen, ProfileInfoFormScreen.
// Falls back to an initial-letter circle when no profileImage is set.
export default function Avatar({ uri, name, size = 44, fontSize }) {
  const initial = (name || 'Z').trim()[0]?.toUpperCase() || 'Z';
  const resolvedFontSize = fontSize || Math.round(size * 0.4);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.fallbackText, { fontSize: resolvedFontSize }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.border },
  fallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#fff', fontWeight: '800' },
});
