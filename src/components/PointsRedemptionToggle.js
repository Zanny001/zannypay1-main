import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/format';

// Must match TransactionsService.POINTS_PER_NAIRA on the backend exactly —
// this is a display/UX mirror of the rate that actually governs the
// money, not the source of truth for it. The server re-validates
// everything regardless of what this component computes.
export const POINTS_PER_NAIRA = 10;

// How many points can actually be applied to a purchase of this amount —
// capped by both what the user has and what the purchase is worth, and
// rounded down to a multiple of 10 since the backend rejects anything else.
export function computeMaxRedeemablePoints(amount, availablePoints) {
  const numericAmount = Number(amount) || 0;
  const maxByAmount = Math.floor(numericAmount * POINTS_PER_NAIRA);
  const capped = Math.min(availablePoints || 0, maxByAmount);
  return Math.floor(capped / POINTS_PER_NAIRA) * POINTS_PER_NAIRA;
}

export default function PointsRedemptionToggle({ amount, availablePoints, enabled, onToggle }) {
  const { theme } = useTheme();
  const maxRedeemable = computeMaxRedeemablePoints(amount, availablePoints);
  const savings = maxRedeemable / POINTS_PER_NAIRA;

  if (!availablePoints || maxRedeemable <= 0) return null;

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
      onPress={() => onToggle(!enabled)}
      activeOpacity={0.8}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.background }]}>
        <Ionicons name="sparkles" size={16} color={theme.accent} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.title, { color: theme.text }]}>Use your reward points</Text>
        <Text style={[styles.sub, { color: theme.textMuted }]}>
          {maxRedeemable.toLocaleString()} points available to use — save {formatCurrency(savings)}
        </Text>
      </View>
      <Switch value={enabled} onValueChange={onToggle} trackColor={{ true: theme.primary, false: theme.border }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, padding: 12, marginTop: 16 },
  iconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 11, marginTop: 2 },
});
