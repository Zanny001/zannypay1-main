import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import { formatCurrency, formatDate } from '../utils/format';
import GradientButton from '../components/GradientButton';
import FadeInView from '../components/FadeInView';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));

const RANGE_OPTIONS = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: 'All Time', days: null },
];

export default function StatementScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { user, transactions } = useWallet();
  const [range, setRange] = useState(RANGE_OPTIONS[1]);
  const [generating, setGenerating] = useState(false);

  const filtered = useMemo(() => {
    if (!range.days) return transactions || [];
    const cutoff = Date.now() - range.days * 24 * 60 * 60 * 1000;
    return (transactions || []).filter((t) => new Date(t.createdAt || t.date).getTime() >= cutoff);
  }, [transactions, range]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, t) => {
        const amt = Math.abs(parseFloat(t.amount)) || 0;
        if (t.type === 'credit') acc.in += amt;
        else if (t.type === 'debit') acc.out += amt;
        return acc;
      },
      { in: 0, out: 0 }
    );
  }, [filtered]);

  const buildStatementHtml = () => {
    const rows = filtered
      .map(
        (t) => `
        <tr>
          <td>${formatDate(t.createdAt || t.date)}</td>
          <td>${escapeHtml(t.title || t.category || 'Transaction')}</td>
          <td style="text-transform:capitalize">${escapeHtml(t.category || '—')}</td>
          <td style="text-align:right; color:${t.type === 'credit' ? '#16A34A' : '#DC2626'}">
            ${t.type === 'credit' ? '+' : '-'}${formatCurrency(Math.abs(parseFloat(t.amount)) || 0)}
          </td>
        </tr>`
      )
      .join('');

    return `
      <html>
        <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
        <body style="font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 20px; color: #10243A; overflow-wrap: anywhere;">
          <h2 style="margin-bottom: 4px; color:#10243A;">ZannyPay Account Statement</h2>
          <p style="color: #71869B; margin-top: 0;">${escapeHtml(user?.name || 'Account holder')} · ${escapeHtml(user?.accountNumber || '')}</p>
          <p style="color: #847F94; font-size: 13px;">Period: ${range.label} · Generated ${formatDate(new Date().toISOString())}</p>

          <div style="display:flex; gap: 20px; margin: 20px 0;">
            <div><strong style="color:#16A34A;">Money In:</strong> ${formatCurrency(totals.in)}</div>
            <div><strong style="color:#DC2626;">Money Out:</strong> ${formatCurrency(totals.out)}</div>
          </div>

          <table width="100%" style="border-collapse: collapse; table-layout: fixed; font-size: 12px; width: 100%;">
            <thead>
              <tr style="border-bottom: 2px solid #ECE9F3; text-align:left;">
                <th width="18%" style="padding: 8px 4px; text-align:left;">Date</th>
                <th width="38%" style="padding: 8px 4px; text-align:left;">Description</th>
                <th width="18%" style="padding: 8px 4px; text-align:left;">Category</th>
                <th width="26%" style="padding: 8px 4px; text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="4" style="padding:16px; text-align:center; color:#847F94;">No transactions in this period.</td></tr>'}</tbody>
          </table>

          <p style="color:#847F94; font-size: 11px; margin-top: 30px;">This statement was generated on-device by the ZannyPay app and reflects the last 50 transactions synced to this account.</p>
        </body>
      </html>
    `;
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const { uri } = await Print.printToFileAsync({ html: buildStatementHtml() });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'ZannyPay Statement', UTI: 'com.adobe.pdf' });
      } else {
        alert('Statement Ready', `Saved to: ${uri}`, null, { type: 'success' });
      }
    } catch (error) {
      alert('Could Not Generate', 'Something went wrong while creating your statement.', null, { type: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Account Statement</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={[styles.label, { color: theme.textMuted }]}>Select a period</Text>
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.label}
              style={[styles.rangeChip, { borderColor: theme.border }, range.label === opt.label && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setRange(opt)}
            >
              <Text style={[styles.rangeChipText, { color: theme.text }, range.label === opt.label && { color: '#fff' }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FadeInView delay={80}>
          <View style={[styles.summaryCard, { backgroundColor: theme.surface }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Transactions</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{filtered.length}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Money In</Text>
              <Text style={[styles.summaryValue, { color: theme.success }]}>{formatCurrency(totals.in)}</Text>
            </View>
            <View style={[styles.summaryRow, { marginBottom: 0 }]}>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Money Out</Text>
              <Text style={[styles.summaryValue, { color: theme.danger }]}>{formatCurrency(totals.out)}</Text>
            </View>
          </View>
        </FadeInView>

        <GradientButton title="Generate PDF Statement" onPress={handleGenerate} loading={generating} style={{ marginTop: 24 }} />
        <Text style={[styles.footnote, { color: theme.textMuted }]}>
          Statements are generated on-device and cover the transactions currently synced to your account (last 50).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  rangeChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, marginBottom: 8 },
  rangeChipText: { fontSize: 13, fontWeight: '700' },
  summaryCard: { borderRadius: 18, padding: 20 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
  summaryLabel: { flexGrow: 1, flexShrink: 0, fontSize: 13 },
  summaryValue: { flexShrink: 1, maxWidth: '68%', textAlign: 'right', fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  footnote: { fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 16, paddingHorizontal: 10 },
});
