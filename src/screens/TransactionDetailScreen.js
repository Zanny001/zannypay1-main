import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { colors } from '../theme/colors';
import { formatCurrency, formatDate } from '../utils/format';
import { useAlert } from '../context/AlertContext';
import { useWallet } from '../context/WalletContext';

const { width } = Dimensions.get('window');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>\"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));

const STATUS_STEPS = {
  successful: ['Payment successful', 'Submitted to bank', 'Received by bank'],
  completed: ['Payment successful', 'Submitted to bank', 'Received by bank'],
  pending: ['Payment initiated', 'Processing', 'Awaiting confirmation'],
  failed: ['Payment failed', '\u2014', '\u2014'],
};

// Human-readable transaction type derived from the real category/type the
// backend recorded — no fabricated fields, only what actually happened.
function describeTransactionType(txn) {
  const cat = (txn.category || '').toLowerCase();
  if (cat === 'transfer') return 'Money Transfer';
  if (cat === 'airtime') return 'Airtime Top-up';
  if (cat === 'data') return 'Data Bundle';
  if (cat === 'savings') return 'Savings';
  if (cat === 'flexi credit') return 'Flexi Credit';
  if (cat === 'funding') return 'Wallet Funding';
  if (cat === 'invoices') return 'Invoice';
  if (txn.type === 'invoice') return 'Invoice';
  return txn.category || 'Bill Payment';
}

function renderSerratedEdge(isTop) {
  const notchCount = Math.floor((width - 40) / 16);
  return (
    <View style={[styles.serratedContainer, isTop ? styles.serratedTop : styles.serratedBottom]}>
      {Array.from({ length: notchCount }).map((_, i) => (
        <View key={i} style={styles.serratedNotch} />
      ))}
    </View>
  );
}

export default function TransactionDetailScreen({ route, navigation }) {
  const { alert } = useAlert();
  const { user, createDispute } = useWallet();
  const { txn } = route.params;
  const receiptRef = useRef(null);
  const [sharing, setSharing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Prisma Decimal fields serialize as strings over JSON — always coerce with Number().
  const amount = Number(txn.amount ?? 0);
  const fee = Number(txn.fee ?? 0);

  const isCredit = txn.type === 'credit';
  const isInvoice = txn.type === 'invoice';

  const transactionTimestamp = txn.createdAt || txn.date;

  const rawStatus = String(txn.status || 'pending').toLowerCase();
  const normalizedStatus = ['success', 'successful', 'completed', 'paid'].includes(rawStatus)
    ? 'successful'
    : ['failed', 'reversed', 'cancelled', 'canceled'].includes(rawStatus)
      ? 'failed'
      : 'pending';
  const statusLabel = normalizedStatus === 'successful' ? 'Successful' : normalizedStatus === 'failed' ? 'Failed' : 'Pending';
  const statusColor = normalizedStatus === 'pending' ? '#F5A623' : normalizedStatus === 'failed' ? colors.danger : colors.success;
  const statusDotColor = statusColor;
  const steps = STATUS_STEPS[normalizedStatus];

  const recipientName = txn.recipientName || txn.subtitle || 'N/A';
  const recipientBank = txn.recipientBank || txn.bank || null;
  const recipientAccount = txn.recipientAccount || txn.accountNumber || null;
  const transactionType = describeTransactionType(txn);
  const reference = txn.reference || txn.id;

  const buildReceiptHtml = () => `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; background: #F4F8FC; padding: 0; margin: 0; }
          .card { max-width: 480px; margin: 30px auto; background: #061426; border-radius: 20px; padding: 32px; color: #F4F9FF; }
          .logo-row { display: flex; align-items: center; margin-bottom: 24px; }
          .logo-circle { width: 30px; height: 30px; border-radius: 15px; background: #1688D6; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; margin-right: 10px; }
          .logo-name { font-size: 16px; font-weight: 700; }
          .amount { text-align: center; font-size: 34px; font-weight: 800; color: #35D6F5; margin-bottom: 6px; }
          .status { text-align: center; color: #D5EAF8; font-size: 14px; margin-bottom: 4px; }
          .date { text-align: center; color: #9AAEC4; font-size: 12px; margin-bottom: 20px; }
          .dashed { border-top: 1px dashed #28516F; margin: 20px 0; }
          .row { display: flex; justify-content: space-between; gap: 14px; margin-bottom: 16px; font-size: 13px; overflow-wrap: anywhere; }
          .label { color: #9AAEC4; }
          .value { color: #fff; font-weight: 600; text-align: right; }
          .footer-text { text-align: center; color: #8FB5D2; font-size: 11px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo-row"><div class="logo-circle">Z</div><div class="logo-name">ZannyPay</div></div>
          <div class="amount">${formatCurrency(amount)}</div>
          <div class="status">${escapeHtml(statusLabel)} Transaction</div>
          <div class="date">${escapeHtml(formatDate(transactionTimestamp))}</div>
          <div class="dashed"></div>
          <div class="row"><span class="label">Transaction Type</span><span class="value">${escapeHtml(transactionType)}</span></div>
          ${!isInvoice ? `<div class="row"><span class="label">Recipient</span><span class="value">${escapeHtml(recipientName)}${recipientBank ? ` (${escapeHtml(recipientBank)})` : ''}</span></div>${recipientAccount ? `<div class="row"><span class="label">Account</span><span class="value">${escapeHtml(recipientAccount)}</span></div>` : ''}` : ''}
          <div class="row"><span class="label">Reference</span><span class="value">${escapeHtml(reference)}</span></div>
          <div class="row"><span class="label">Fee</span><span class="value">${escapeHtml(formatCurrency(fee))}</span></div>
          <div class="row"><span class="label">Payer</span><span class="value">${escapeHtml(user?.name || '')} · ${escapeHtml(user?.accountNumber || '')}</span></div>
          <div class="dashed"></div>
          <div class="footer-text">Enjoy seamless, secure transfers with ZannyPay.</div>
        </div>
      </body>
    </html>
  `;

  const handleShareImage = async () => {
    try {
      setSharing(true);
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        alert('Sharing Unavailable', 'Sharing is not available on this device.', null, { type: 'error' });
        return;
      }
      const uri = await receiptRef.current.capture();
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Receipt' });
    } catch (error) {
      alert('Could Not Share', 'Something went wrong while creating the receipt image.', null, { type: 'error' });
    } finally {
      setSharing(false);
    }
  };

  const handleSaveDocument = async () => {
    try {
      setSaving(true);
      const { uri } = await Print.printToFileAsync({ html: buildReceiptHtml(), base64: false });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Save Receipt', UTI: 'com.adobe.pdf' });
      } else {
        alert('PDF Ready', `Saved to: ${uri}`, null, { type: 'success' });
      }
    } catch (error) {
      alert('Could Not Save', 'Something went wrong while generating the PDF.', null, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const submitDispute = async (reason) => {
    const res = await createDispute(txn.id, reason);
    if (!res.ok) {
      alert('Could Not File Dispute', res.error, null, { type: 'error' });
      return;
    }
    if (res.alreadyExists) {
      alert('Already Filed', 'You already have an open dispute for this transaction. Our team is reviewing it.', null, { type: 'info' });
      return;
    }
    alert(
      'Dispute Filed',
      'Your dispute has been recorded and our team will follow up shortly. You can track its status from My Disputes.',
      [
        { text: 'View Disputes', onPress: () => navigation.navigate('Disputes') },
        { text: 'Done', style: 'cancel' },
      ],
      { type: 'success' }
    );
  };

  const handleDispute = () => {
    alert(
      'Report a Dispute',
      "What's the issue with this transaction?",
      [
        { text: 'Unauthorized transaction', onPress: () => submitDispute('Unauthorized transaction') },
        { text: 'Wrong amount', onPress: () => submitDispute('Wrong amount charged') },
        { text: 'Duplicate charge', onPress: () => submitDispute('Duplicate charge') },
        { text: 'Service not received', onPress: () => submitDispute('Service or goods not received') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction Receipt</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Support')}>
          <Ionicons name="headset-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.receiptWrapper}>
          <ViewShot ref={receiptRef} options={{ format: 'png', quality: 1 }} style={styles.receiptCard}>
            <View style={styles.logoRow}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>Z</Text>
              </View>
              <Text style={styles.logoName}>ZannyPay</Text>
            </View>

            <View style={styles.cardHeader}>
              <Text style={styles.amount}>
                {isInvoice ? '' : isCredit ? '+' : '-'}
                {formatCurrency(amount)}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
                <Ionicons
                  name={normalizedStatus === 'failed' ? 'close-circle' : normalizedStatus === 'pending' ? 'time' : 'checkmark-circle'}
                  size={14}
                  color={statusColor}
                />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel} Transaction</Text>
              </View>
              <Text style={styles.dateText}>{formatDate(transactionTimestamp)}</Text>
            </View>

            {!isInvoice && (
              <View style={styles.timeline}>
                {steps.map((label, idx) => (
                  <React.Fragment key={idx}>
                    <View style={styles.timelineStep}>
                      <View style={[styles.dot, { backgroundColor: statusDotColor }]} />
                      <Text style={styles.stepTitle}>{label}</Text>
                    </View>
                    {idx < steps.length - 1 && (
                      <View style={[styles.line, { backgroundColor: statusDotColor }]} />
                    )}
                  </React.Fragment>
                ))}
              </View>
            )}

            <View style={styles.dashedLine} />

            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Transaction Type</Text>
                <Text style={styles.detailValue}>{transactionType}</Text>
              </View>

              {!isInvoice && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Recipient</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.detailValue}>{recipientName}</Text>
                    {(recipientBank || recipientAccount) && (
                      <Text style={styles.subDetail}>
                        {[recipientBank, recipientAccount].filter(Boolean).join(' | ')}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Payer</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.detailValue}>{user?.name}</Text>
                  <Text style={styles.subDetail}>ZannyPay | {user?.accountNumber}</Text>
                </View>
              </View>

              {!isInvoice && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Fee</Text>
                  <Text style={styles.detailValue}>{formatCurrency(fee)}</Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Reference ID</Text>
                <Text style={[styles.detailValue, { fontSize: 11 }]}>{reference}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Completion Time</Text>
                <Text style={styles.detailValue}>{formatDate(transactionTimestamp)}</Text>
              </View>
            </View>

            <Text style={styles.receiptFooterText}>Enjoy seamless, secure transfers with ZannyPay.</Text>
          </ViewShot>

          {renderSerratedEdge(true)}
          {renderSerratedEdge(false)}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerBtn} onPress={handleShareImage} disabled={sharing}>
          <Ionicons name="share-social-outline" size={20} color={colors.primary} />
          <Text style={styles.footerBtnText}>{sharing ? 'Preparing…' : 'Share as Image'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerBtn} onPress={handleSaveDocument} disabled={saving}>
          <Ionicons name="download-outline" size={20} color={colors.primary} />
          <Text style={styles.footerBtnText}>{saving ? 'Generating…' : 'Save as PDF'}</Text>
        </TouchableOpacity>
        {!isInvoice && (
          <TouchableOpacity style={styles.footerBtn} onPress={handleDispute}>
            <Ionicons name="alert-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.footerBtnText}>Dispute</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#061426' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
  scrollContent: { padding: 20 },

  receiptWrapper: { position: 'relative' },
  receiptCard: { backgroundColor: '#0B1D33', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 28 },
  serratedContainer: { flexDirection: 'row', position: 'absolute', left: 0, right: 0, justifyContent: 'space-around', overflow: 'hidden' },
  serratedTop: { top: -6 },
  serratedBottom: { bottom: -6 },
  serratedNotch: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#0D0D0D' },

  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  logoCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1688D6', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  logoText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  logoName: { color: '#fff', fontSize: 16, fontWeight: '700' },

  cardHeader: { alignItems: 'center', marginBottom: 26 },
  amount: { color: '#35D6F5', fontSize: 32, fontWeight: 'bold', marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 8 },
  statusText: { marginLeft: 6, fontSize: 12, fontWeight: 'bold' },
  dateText: { color: '#666', fontSize: 12 },

  timeline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26, paddingHorizontal: 10 },
  timelineStep: { alignItems: 'center', width: 80 },
  dot: { width: 14, height: 14, borderRadius: 7, marginBottom: 8 },
  stepTitle: { color: '#fff', fontSize: 10, textAlign: 'center' },
  line: { flex: 1, height: 2, marginTop: 6 },

  dashedLine: { height: 1, borderStyle: 'dashed', borderWidth: 1, borderColor: '#1B3B57', borderRadius: 1, marginBottom: 18 },

  detailsList: {},
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1B3B57' },
  detailLabel: { flex: 0.85, color: '#9AAEC4', fontSize: 12 },
  detailValue: { flex: 1.15, color: '#F4F9FF', fontSize: 12, fontWeight: '700', textAlign: 'right', flexWrap: 'wrap' },
  detailLabel: { flex: 0.85, color: '#9AAEC4', fontSize: 12 },
  detailValue: { flex: 1.15, color: '#F4F9FF', fontSize: 12, fontWeight: '700', textAlign: 'right', flexWrap: 'wrap' },
  subDetail: { color: '#666', fontSize: 11, marginTop: 4 },

  receiptFooterText: { color: '#555', fontSize: 11, textAlign: 'center', marginTop: 24 },

  footer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: '#1B3B57', backgroundColor: '#0D0D0D' },
  footerBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 15 },
  footerBtnText: { color: '#35D6F5', fontSize: 13, fontWeight: 'bold', marginLeft: 6 },
});
