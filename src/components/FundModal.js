import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import GradientButton from './GradientButton';
import { colors } from '../theme/colors';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';

const PRESETS = [1000, 2000, 5000, 10000];

const money = (value) => `₦${Number(value || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

export default function FundModal({ visible, onClose }) {
  const { alert } = useAlert();
  const { fundWallet, verifyFunding, getPendingFundingAttempt, syncWallet } = useWallet();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingReference, setPendingReference] = useState(null);
  const [pendingAmount, setPendingAmount] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!visible) return undefined;
    let active = true;
    getPendingFundingAttempt().then((attempt) => {
      if (!active || !attempt) return;
      setAmount(attempt.reference ? '' : String(attempt.amount));
      setPendingAmount(attempt.amount);
      setPendingReference(attempt.reference);
      if (attempt.reference) {
        setStatusMessage('A previous funding attempt is awaiting confirmation. Check its status before starting another payment.');
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [visible, getPendingFundingAttempt]);

  const parsedAmount = Number(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount >= 100 && parsedAmount <= 10000000 && Math.round(parsedAmount * 100) === parsedAmount * 100;
  const formattedAmount = useMemo(() => money(parsedAmount), [parsedAmount]);

  const close = () => {
    if (loading || confirming) return;
    setAmount('');
    setPendingReference(null);
    setPendingAmount(null);
    setStatusMessage('');
    onClose();
  };

  const checkStatus = async (reference = pendingReference, value = pendingAmount) => {
    if (!reference) return;
    setConfirming(true);
    setStatusMessage('Checking securely with Paystack…');
    let latest = { ok: false, status: 'pending' };
    for (let i = 0; i < 4; i += 1) {
      latest = await verifyFunding(reference);
      if (latest.ok || ['failed', 'abandoned', 'reversed'].includes(String(latest.status).toLowerCase())) break;
      if (i < 3) await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    await syncWallet();
    setConfirming(false);
    if (latest.ok) {
      setPendingReference(null);
      setPendingAmount(null);
      setStatusMessage('');
      alert('Payment confirmed', `${money(value)} has been added to your ZannyPay wallet.`, null, { type: 'success' });
      setAmount('');
      onClose();
    } else {
      const failed = ['failed', 'abandoned', 'reversed'].includes(String(latest.status).toLowerCase());
      setStatusMessage(failed
        ? 'Paystack did not complete this payment. If your bank account was debited, contact support with the reference below before trying again.'
        : 'Your payment has not been confirmed yet. Your wallet has not been credited. Keep this reference and check again shortly. Do not start another payment for this attempt.');
    }
  };

  const startFunding = async () => {
    if (!validAmount) {
      alert('Check the amount', 'Enter an amount from ₦100 to ₦10,000,000 with no more than two decimal places.', null, { type: 'warning' });
      return;
    }
    setLoading(true);
    const result = await fundWallet(parsedAmount);
    if (result.completed) {
      setLoading(false);
      await syncWallet();
      alert('Payment confirmed', 'Your wallet has already been credited for this payment attempt.', null, { type: 'success' });
      setAmount('');
      onClose();
      return;
    }
    if (result.pending) {
      setLoading(false);
      setPendingReference(result.reference);
      setPendingAmount(Number(result.amount || parsedAmount));
      setStatusMessage(result.error || 'This payment attempt is already processing.');
      return;
    }
    if (!result.ok || !result.authorizationUrl) {
      setLoading(false);
      alert('Could not start payment', result.error || 'Please try again in a moment.', null, { type: 'error' });
      return;
    }
    setPendingReference(result.reference);
    setPendingAmount(parsedAmount);
    const returnUrl = Linking.createURL('payment-complete');
    try {
      const browserResult = await WebBrowser.openAuthSessionAsync(result.authorizationUrl, returnUrl);
      // A browser close/cancel is not proof of payment. Always ask our server
      // to verify the provider transaction before showing a success state.
      if (browserResult?.type === 'cancel' || browserResult?.type === 'dismiss') {
        setStatusMessage('Checkout was closed. We are checking whether Paystack received a successful payment.');
      }
    } catch {
      setStatusMessage('Checkout could not be reopened. We will check the payment status directly.');
    }
    setLoading(false);
    await checkStatus(result.reference, parsedAmount);
  };

  const busy = loading || confirming;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.handle} />
          {confirming ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.title}>Verifying payment</Text>
              <Text style={styles.subtitle}>We are confirming the result with Paystack. Please keep the app open.</Text>
            </View>
          ) : pendingReference ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.pendingIcon}><Ionicons name="time-outline" size={28} color="#A66A00" /></View>
              <Text style={styles.title}>Payment pending</Text>
              <Text style={styles.subtitle}>{statusMessage || 'We have not received final confirmation yet.'}</Text>
              <View style={styles.referenceCard}>
                <Text style={styles.metaLabel}>AMOUNT</Text>
                <Text style={styles.amountValue}>{money(pendingAmount)}</Text>
                <Text style={styles.metaLabel}>PAYMENT REFERENCE</Text>
                <Text selectable style={styles.reference}>{pendingReference}</Text>
              </View>
              <GradientButton title="Check payment status" onPress={() => checkStatus()} loading={busy} />
              <Text style={styles.safeNote}>Your wallet is credited only after Paystack confirms the exact amount and currency. Please don't pay again using this same attempt.</Text>
              <TouchableOpacity style={styles.cancel} onPress={close}><Text style={styles.cancelText}>Close</Text></TouchableOpacity>
            </ScrollView>
          ) : (
            <>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.title}>Add money</Text>
                  <Text style={styles.subtitle}>Top up your ZannyPay wallet securely.</Text>
                </View>
                <View style={styles.secureIcon}><Ionicons name="shield-checkmark-outline" size={21} color={colors.primary} /></View>
              </View>
              <Text style={styles.sectionLabel}>CHOOSE AMOUNT</Text>
              <View style={styles.amountWrap}>
                <Text style={styles.currency}>₦</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={(value) => setAmount(value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                  maxLength={12}
                  autoFocus={visible}
                />
              </View>
              <View style={styles.presets}>
                {PRESETS.map((preset) => (
                  <TouchableOpacity key={preset} style={[styles.preset, Number(amount) === preset && styles.presetActive]} onPress={() => setAmount(String(preset))}>
                    <Text style={[styles.presetText, Number(amount) === preset && styles.presetTextActive]}>{money(preset)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {amount.length > 0 && (
                <View style={styles.summary}>
                  <Text style={styles.summaryLabel}>You are adding</Text>
                  <Text style={styles.summaryValue}>{formattedAmount}</Text>
                </View>
              )}
              <View style={styles.checkoutInfo}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
                <View style={styles.checkoutCopy}>
                  <Text style={styles.checkoutTitle}>Secure Paystack checkout</Text>
                  <Text style={styles.checkoutSubtitle}>Choose an available payment method at checkout, such as card, bank or USSD where enabled.</Text>
                </View>
              </View>
              <Text style={styles.disclaimer}>Any provider charges, if applicable, are shown by Paystack before you authorize payment.</Text>
              <GradientButton title="Continue securely" onPress={startFunding} loading={loading} disabled={!validAmount || busy} />
              <TouchableOpacity style={styles.cancel} onPress={close}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(9,16,31,0.58)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 23, paddingTop: 12, paddingBottom: 32, maxHeight: '92%' },
  handle: { width: 42, height: 4, borderRadius: 3, backgroundColor: '#D9DEE8', alignSelf: 'center', marginBottom: 22 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textDark },
  subtitle: { fontSize: 13, color: colors.textMuted, marginTop: 6, lineHeight: 19 },
  secureIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EDF4FF', alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.1, color: colors.textMuted, marginBottom: 10 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#DCE3EF', backgroundColor: '#F8FAFD', borderRadius: 17, paddingHorizontal: 17, marginBottom: 14 },
  currency: { fontSize: 25, fontWeight: '800', color: colors.textDark, marginRight: 8 },
  amountInput: { flex: 1, paddingVertical: 18, fontSize: 28, fontWeight: '800', color: colors.textDark },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 17 },
  preset: { flexGrow: 1, minWidth: '21%', paddingVertical: 11, paddingHorizontal: 8, borderRadius: 11, backgroundColor: '#F1F4F9', alignItems: 'center', borderWidth: 1, borderColor: '#F1F4F9' },
  presetActive: { backgroundColor: '#EAF1FF', borderColor: colors.primary },
  presetText: { color: colors.textDark, fontSize: 12, fontWeight: '700' },
  presetTextActive: { color: colors.primary },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderTopWidth: 1, borderTopColor: '#EEF1F5', marginBottom: 12 },
  summaryLabel: { color: colors.textMuted, fontSize: 13 },
  summaryValue: { color: colors.textDark, fontSize: 17, fontWeight: '800' },
  checkoutInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F1F6FF', borderRadius: 14, padding: 14, marginBottom: 9 },
  checkoutCopy: { flex: 1 },
  checkoutTitle: { color: colors.textDark, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  checkoutSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  disclaimer: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginBottom: 18 },
  cancel: { alignItems: 'center', paddingVertical: 15 },
  cancelText: { color: colors.textMuted, fontWeight: '700', fontSize: 13 },
  centerState: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 18 },
  pendingIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#FFF4DB', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  referenceCard: { backgroundColor: '#F5F7FB', borderRadius: 16, padding: 16, marginVertical: 18 },
  metaLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  amountValue: { fontSize: 24, fontWeight: '800', color: colors.textDark, marginBottom: 18 },
  reference: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  safeNote: { color: colors.textMuted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 14, paddingHorizontal: 6 },
});
