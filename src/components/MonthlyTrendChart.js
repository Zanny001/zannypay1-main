import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

const CHART_HEIGHT = 140;
const PADDING_X = 24;

// A minimal two-line trend chart (income vs expense over time) — no new
// dependency, since react-native-svg is already pulled in for QR code
// rendering elsewhere in the app. Deliberately simple: straight-line
// segments between monthly points, not a full charting library's worth of
// curve-fitting/zoom/tooltip — this is meant to answer "is spend trending
// up or down", not replace a dedicated analytics tool.
export default function MonthlyTrendChart({ data, width = 320 }) {
  const { theme } = useTheme();
  if (!data || data.length < 2) return null;

  const chartWidth = width - PADDING_X * 2;
  const maxValue = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  const stepX = chartWidth / (data.length - 1);

  const toY = (value) => CHART_HEIGHT - (value / maxValue) * (CHART_HEIGHT - 20) - 10;
  const toX = (index) => PADDING_X + index * stepX;

  const incomePoints = data.map((d, i) => `${toX(i)},${toY(d.income)}`).join(' ');
  const expensePoints = data.map((d, i) => `${toX(i)},${toY(d.expense)}`).join(' ');

  return (
    <View>
      <Svg width={width} height={CHART_HEIGHT + 24}>
        <Line x1={PADDING_X} y1={CHART_HEIGHT - 10} x2={width - PADDING_X} y2={CHART_HEIGHT - 10} stroke={theme.border} strokeWidth={1} />

        <Polyline points={expensePoints} fill="none" stroke={theme.danger} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <Polyline points={incomePoints} fill="none" stroke={theme.success} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => (
          <React.Fragment key={i}>
            <Circle cx={toX(i)} cy={toY(d.income)} r={3} fill={theme.success} />
            <Circle cx={toX(i)} cy={toY(d.expense)} r={3} fill={theme.danger} />
            <SvgText x={toX(i)} y={CHART_HEIGHT + 16} fontSize={10} fill={theme.textMuted} textAnchor="middle">
              {d.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
          <Text style={[styles.legendText, { color: theme.textMuted }]}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.danger }]} />
          <Text style={[styles.legendText, { color: theme.textMuted }]}>Expense</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legendRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4, gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '600' },
});
