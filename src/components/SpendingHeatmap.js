import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency } from '../utils/format';

const WEEKS_SHOWN = 12;
const DAYS_PER_WEEK = 7;
const CELL_SIZE = 14;
const CELL_GAP = 4;

// Master audit / continuation request: a calendar heatmap of daily
// spending — the same GitHub-contributions-graph pattern, applied to
// outflow instead of commits. Built entirely from transaction history
// already in memory (same data AnalyticsScreen's category breakdown and
// trend chart already use), no new fetch.
function buildDailyTotals(transactions) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalDays = WEEKS_SHOWN * DAYS_PER_WEEK;

  // Align the grid so the LAST column ends on the current week (Sunday-
  // start, matching the rest of this app's date conventions) — the same
  // visual convention GitHub's own graph uses.
  const todayDayOfWeek = startOfToday.getDay(); // 0 = Sunday
  const gridEnd = new Date(startOfToday);
  gridEnd.setDate(gridEnd.getDate() + (6 - todayDayOfWeek));
  const gridStart = new Date(gridEnd);
  gridStart.setDate(gridStart.getDate() - totalDays + 1);

  const totalsByDateKey = {};
  for (const txn of transactions || []) {
    if (txn.type !== 'debit') continue;
    const date = new Date(txn.createdAt || txn.date || Date.now());
    if (date < gridStart || date > startOfToday) continue;
    const key = date.toDateString();
    totalsByDateKey[key] = (totalsByDateKey[key] || 0) + (Math.abs(parseFloat(txn.amount)) || 0);
  }

  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(gridStart);
    date.setDate(date.getDate() + i);
    const isFuture = date > startOfToday;
    days.push({ date, key: date.toDateString(), amount: isFuture ? null : totalsByDateKey[date.toDateString()] || 0 });
  }

  // Reshape into columns-of-weeks (7 rows each) for rendering — matches
  // how the grid is actually laid out on screen (horizontal scroll of
  // week-columns), rather than one flat list the render function would
  // have to re-chunk itself.
  const weeks = [];
  for (let i = 0; i < days.length; i += DAYS_PER_WEEK) {
    weeks.push(days.slice(i, i + DAYS_PER_WEEK));
  }
  return weeks;
}

function intensityColor(amount, max, theme) {
  if (amount === null) return 'transparent'; // future day — not rendered
  if (amount === 0 || max === 0) return theme.surfaceAlt;
  const ratio = amount / max;
  // Four buckets rather than a continuous gradient — easier to
  // distinguish at a 14px cell size than a smooth interpolation would be.
  if (ratio > 0.75) return theme.primary;
  if (ratio > 0.45) return `${theme.primary}CC`;
  if (ratio > 0.15) return `${theme.primary}80`;
  return `${theme.primary}40`;
}

export default function SpendingHeatmap({ transactions }) {
  const { theme } = useTheme();
  const [selectedDay, setSelectedDay] = useState(null);

  const weeks = useMemo(() => buildDailyTotals(transactions), [transactions]);
  const maxDay = useMemo(() => {
    let max = 0;
    for (const week of weeks) for (const day of week) if (day.amount !== null) max = Math.max(max, day.amount);
    return max;
  }, [weeks]);

  const monthLabels = useMemo(() => {
    // One label per week-column, shown only on the first week a new
    // month appears in — same convention GitHub's graph uses so labels
    // don't repeat every single column.
    let lastMonth = null;
    return weeks.map((week) => {
      const firstDay = week[0].date;
      const month = firstDay.toLocaleDateString('en-US', { month: 'short' });
      const show = month !== lastMonth;
      lastMonth = month;
      return show ? month : '';
    });
  }, [weeks]);

  const hasAnySpend = maxDay > 0;

  return (
    <View>
      {selectedDay ? (
        <Text style={[styles.selectedLabel, { color: theme.text }]}>
          {selectedDay.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} ·{' '}
          <Text style={{ fontWeight: '700' }}>{formatCurrency(selectedDay.amount || 0)}</Text>
        </Text>
      ) : (
        <Text style={[styles.selectedLabel, { color: theme.textMuted }]}>Tap a day to see what you spent</Text>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekColumn}>
            <Text style={[styles.monthLabel, { color: theme.textMuted }]}>{monthLabels[weekIndex]}</Text>
            {week.map((day) => (
              <TouchableOpacity
                key={day.key}
                disabled={day.amount === null}
                onPress={() => setSelectedDay(day)}
                style={[
                  styles.cell,
                  {
                    backgroundColor: intensityColor(day.amount, maxDay, theme),
                    borderColor: selectedDay?.key === day.key ? theme.text : 'transparent',
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </ScrollView>

      {!hasAnySpend && (
        <Text style={[styles.emptyText, { color: theme.textMuted }]}>No spending recorded in the last {WEEKS_SHOWN} weeks yet.</Text>
      )}

      <View style={styles.legendRow}>
        <Text style={[styles.legendText, { color: theme.textMuted }]}>Less</Text>
        {[theme.surfaceAlt, `${theme.primary}40`, `${theme.primary}80`, `${theme.primary}CC`, theme.primary].map((c, i) => (
          <View key={i} style={[styles.legendCell, { backgroundColor: c }]} />
        ))}
        <Text style={[styles.legendText, { color: theme.textMuted }]}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  selectedLabel: { fontSize: 13, marginBottom: 12, minHeight: 18 },
  scrollContent: { paddingBottom: 4 },
  weekColumn: { marginRight: CELL_GAP },
  monthLabel: { fontSize: 9, fontWeight: '600', marginBottom: 4, height: 12 },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 3,
    marginBottom: CELL_GAP,
    borderWidth: 1.5,
  },
  emptyText: { fontSize: 12, textAlign: 'center', marginTop: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 12 },
  legendText: { fontSize: 10, marginHorizontal: 2 },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
});
