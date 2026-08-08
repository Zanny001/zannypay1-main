import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { formatCurrency } from '../utils/format';
import Card from '../components/Card';
import MonthlyTrendChart from '../components/MonthlyTrendChart';

const TREND_MONTHS = 6;

export default function AnalyticsScreen({ navigation }) {
  const { theme } = useTheme();
  const { transactions, balance } = useWallet();

  // BillsScreen submits specific labels (Airtime, Data, Electricity, TV
  // Subscription, Water, Internet) rather than a generic "Bills" tag, so we
  // group anything that isn't a Transfer or Invoice under Bills & Utilities.
  const BILL_LABELS = ['Airtime', 'Data', 'Electricity', 'TV Subscription', 'Water', 'Internet', 'Bill Payment'];

  const categories = (transactions || []).reduce((acc, txn) => {
    if (txn.type !== 'debit') return acc; // only outflows count as "spend"
    const cat = txn.category || 'Other';
    const amt = Math.abs(parseFloat(txn.amount)) || 0;

    // The backend records transfers with a lowercase category ("transfer"),
    // while everything else (Bills, Savings, Flexi Credit) uses the
    // human-readable label as-is, so this comparison is case-insensitive.
    if (cat.toLowerCase() === 'transfer') acc.Transfer += amt;
    else if (BILL_LABELS.includes(cat)) acc.Bills += amt;
    else acc.Other += amt;

    return acc;
  }, { Transfer: 0, Bills: 0, Other: 0 });

  const invoicesIssued = (transactions || [])
    .filter((t) => t.category === 'Invoices')
    .reduce((sum, t) => sum + (Math.abs(parseFloat(t.amount)) || 0), 0);

  const totalSpent = categories.Transfer + categories.Bills + categories.Other;

  const spendData = [
    { name: 'Transfers', amount: categories.Transfer, color: theme.primary, icon: 'swap-horizontal' },
    { name: 'Bills & Utilities', amount: categories.Bills, color: '#FF7A00', icon: 'receipt-outline' },
    { name: 'Other', amount: categories.Other, color: theme.textMuted, icon: 'ellipsis-horizontal-outline' },
  ];

  // Last 6 calendar months of income vs. expense, oldest first — the same
  // shape PalmPay's Monthly Overview trend chart uses. Built from
  // transaction history already in memory, no extra fetch.
  const trendData = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = TREND_MONTHS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString('en-US', { month: 'short' }), income: 0, expense: 0 });
    }
    for (const txn of transactions || []) {
      const date = new Date(txn.createdAt || txn.date || Date.now());
      const bucket = months.find((m) => m.year === date.getFullYear() && m.month === date.getMonth());
      if (!bucket) continue;
      const amt = Math.abs(parseFloat(txn.amount)) || 0;
      if (txn.type === 'credit') bucket.income += amt;
      else if (txn.type === 'debit') bucket.expense += amt;
    }
    return months;
  }, [transactions]);

  const hasTrendData = trendData.some((m) => m.income > 0 || m.expense > 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Financial Insights</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>Smart automatic spend tracking</Text>
        </View>

        <Card style={[styles.summaryCard, { backgroundColor: theme.text }]}>
          <Text style={styles.summaryLabel}>Total Outflow This Month</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalSpent)}</Text>
          <Text style={[styles.summarySub, { color: theme.info }]}>Net Wallet Balance: {formatCurrency(balance)}</Text>
          {invoicesIssued > 0 && (
            <Text style={[styles.summarySub, { color: theme.info }]}>Invoices Issued: {formatCurrency(invoicesIssued)}</Text>
          )}
        </Card>

        {hasTrendData && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>6-Month Trend</Text>
            <Card style={styles.trendCard}>
              <MonthlyTrendChart data={trendData} width={320} />
            </Card>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Breakdown by Category</Text>

        {spendData.map((item, idx) => {
          const percentage = totalSpent > 0 ? (item.amount / totalSpent) * 100 : 0;
          return (
            <Card key={idx} style={styles.categoryCard}>
              <View style={styles.categoryHeader}>
                <Text style={[styles.categoryName, { color: theme.text }]}>{item.name}</Text>
                <Text style={[styles.categoryAmount, { color: theme.text }]}>{formatCurrency(item.amount)}</Text>
              </View>
              <View style={[styles.progressBackground, { backgroundColor: theme.surfaceAlt }]}>
                <View style={[styles.progressBar, { width: `${Math.max(percentage, 2)}%`, backgroundColor: item.color }]} />
              </View>
              <Text style={[styles.percentageText, { color: theme.textMuted }]}>{percentage.toFixed(1)}% of total outflow</Text>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', marginTop: 6 },
  header: { marginBottom: 24, marginTop: 4 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 14, marginTop: 4 },
  summaryCard: { padding: 20, alignItems: 'center', marginBottom: 24 },
  summaryLabel: { color: '#AAA', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  summaryValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginVertical: 8 },
  summarySub: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  trendCard: { padding: 16, marginBottom: 24, alignItems: 'center' },
  categoryCard: { padding: 16, marginBottom: 12 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoryName: { fontSize: 15, fontWeight: '600' },
  categoryAmount: { fontSize: 15, fontWeight: '700' },
  progressBackground: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 4 },
  percentageText: { fontSize: 12, marginTop: 8, textAlign: 'right' }
});
