import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import { formatCurrency, formatDate } from '../utils/format';
import GradientButton from '../components/GradientButton';
import FadeInView from '../components/FadeInView';
import Skeleton from '../components/Skeleton';

export default function InvoiceDetailScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { user, fetchInvoiceDetail, markInvoicePaid } = useWallet();
  const invoiceId = route?.params?.invoiceId;

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      fetchInvoiceDetail(invoiceId).then((res) => {
        if (cancelled) return;
        if (res.ok) setInvoice(res.data);
        setLoading(false);
      });
      return () => { cancelled = true; };
    }, [invoiceId, fetchInvoiceDetail])
  );

  const handleShare = async () => {
    if (!invoice) return;
    const text = `🧾 Invoice from ${user?.name || 'ZannyPay'}\n\nTo: ${invoice.clientName}\n${invoice.description}\n\nAmount Due: ${formatCurrency(invoice.amount)}\n\nPay to: ${user?.accountNumber} (ZannyPay)`;
    try {
      await Share.share({ message: text, title: `Invoice for ${invoice.clientName}` });
    } catch (e) {
      alert('Error', 'Failed to share the invoice.');
    }
  };

  const handleMarkPaid = async () => {
    setMarking(true);
    const res = await markInvoicePaid(invoiceId);
    setMarking(false);
    if (!res.ok) {
      alert('Could Not Update', res.error, null, { type: 'error' });
      return;
    }
    setInvoice(res.data);
  };

  const qrPayload = invoice
    ? JSON.stringify({ app: 'ZannyPay', type: 'invoice', invoiceId: invoice.id, account: user?.accountNumber, name: user?.name, amount: Number(invoice.amount) })
    : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Invoice</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <>
            <Skeleton width="100%" height={260} radius={20} style={{ marginBottom: 20 }} />
            <Skeleton width="100%" height={100} radius={16} />
          </>
        ) : !invoice ? (
          <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 40 }}>Invoice not found.</Text>
        ) : (
          <>
            <FadeInView>
              <View style={[styles.card, { backgroundColor: theme.surface }]}>
                <View style={styles.statusRow}>
                  <View style={[styles.statusBadge, { backgroundColor: invoice.status === 'paid' ? `${theme.success}20` : `${theme.accent}20` }]}>
                    <Text style={[styles.statusText, { color: invoice.status === 'paid' ? theme.success : theme.accent }]}>
                      {invoice.status === 'paid' ? 'Paid' : 'Awaiting Payment'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.amount, { color: theme.text }]}>{formatCurrency(invoice.amount)}</Text>
                <Text style={[styles.clientName, { color: theme.textMuted }]}>Billed to {invoice.clientName}</Text>
                <Text style={[styles.description, { color: theme.text }]}>{invoice.description}</Text>

                <View style={[styles.qrWrap, { backgroundColor: '#fff' }]}>
                  <QRCode value={qrPayload} size={160} color={theme.text === '#FFFFFF' ? '#1A1523' : theme.text} backgroundColor="white" />
                </View>
                <Text style={[styles.qrCaption, { color: theme.textMuted }]}>Scan in ZannyPay to view this invoice</Text>

                <Text style={[styles.meta, { color: theme.textMuted }]}>
                  Issued {formatDate(invoice.createdAt)}{invoice.paidAt ? ` · Paid ${formatDate(invoice.paidAt)}` : ''}
                </Text>
              </View>
            </FadeInView>

            <FadeInView delay={100}>
              <TouchableOpacity style={[styles.shareRow, { backgroundColor: theme.surface }]} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={20} color={theme.primary} />
                <Text style={[styles.shareText, { color: theme.text }]}>Share Invoice</Text>
              </TouchableOpacity>
            </FadeInView>

            {invoice.status !== 'paid' && (
              <FadeInView delay={160}>
                <GradientButton title="Mark as Paid" onPress={handleMarkPaid} loading={marking} style={{ marginTop: 14 }} />
                <Text style={[styles.hint, { color: theme.textMuted }]}>
                  Confirm this once you've verified payment arrived — ZannyPay doesn't auto-detect invoice payments.
                </Text>
              </FadeInView>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  card: { borderRadius: 20, padding: 22, alignItems: 'center' },
  statusRow: { alignSelf: 'flex-start', marginBottom: 14 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '700' },
  amount: { fontSize: 34, fontWeight: '800' },
  clientName: { fontSize: 13, marginTop: 6 },
  description: { fontSize: 13, textAlign: 'center', marginTop: 14, lineHeight: 19 },
  qrWrap: { padding: 16, borderRadius: 16, marginTop: 22 },
  qrCaption: { fontSize: 11, marginTop: 10 },
  meta: { fontSize: 11, marginTop: 18 },
  shareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16, padding: 16, marginTop: 14 },
  shareText: { fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 16, paddingHorizontal: 10 },
});
