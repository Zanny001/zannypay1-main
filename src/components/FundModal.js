import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import GradientButton from './GradientButton';
import { colors, gradients } from '../theme/colors';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';

// How many times (and how far apart) to poll Paystack's verify endpoint
// after the checkout browser closes, before giving up and telling the user
// their payment is still processing. Paystack itself can take a couple of
// seconds to finalize a transaction after redirecting back.
const VERIFY_ATTEMPTS = 5;
const VERIFY_INTERVAL_MS = 2000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function FundModal({ visible, onClose }) {
  const { alert } = useAlert();
  const { user, fundWallet, verifyFunding, syncWallet } = useWallet();

  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [method, setMethod] = useState('card'); // 'card' | 'bank'

  const resetAndClose = () => {
    setAmount('');
    setLoading(false);
    setConfirming(false);
    onClose();
  };

  const handleCardFunding = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      alert('Invalid Amount', 'Please enter a valid amount.', null, { type: 'warning' });
      return;
    }

    setLoading(true);
    const result = await fundWallet(amount);
    setLoading(false);

    if (!result.ok || !result.authorizationUrl) {
      alert('Could Not Start Payment', result.error || 'Please try again in a moment.', null, { type: 'error' });
      return;
    }

    const returnUrl = Linking.createURL('payment-complete');
    await WebBrowser.openAuthSessionAsync(result.authorizationUrl, returnUrl);

    // The webhook may take a while (or, in local/dev setups, may never
    // arrive) — actively confirm with Paystack instead of just hoping.
    setConfirming(true);
    let confirmed = false;
    for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt++) {
      const verifyResult = await verifyFunding(result.reference);
      if (verifyResult.ok) {
        confirmed = true;
        break;
      }
      if (attempt < VERIFY_ATTEMPTS - 1) await wait(VERIFY_INTERVAL_MS);
    }
    await syncWallet();
    setConfirming(false);
    resetAndClose();

    if (confirmed) {
      alert('Payment Confirmed', `${'\u20a6'}${Number(amount).toLocaleString()} has been added to your wallet.`, null, { type: 'success' });
    } else {
      alert(
        'Still Processing',
        "We haven't heard back from Paystack yet. If your bank confirmed the debit, your balance will update automatically within a few minutes — no need to try again.",
        null,
        { type: 'warning' }
      );
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={confirming ? undefined : onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {confirming ? (
            <View style={styles.confirmingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.confirmingTitle}>Confirming your payment…</Text>
              <Text style={styles.confirmingSub}>This usually takes a few seconds. Please don't close the app.</Text>
            </View>
          ) : (
            <>
              <View style={styles.handleBar} />
              <Text style={styles.modalTitle}>Fund Wallet</Text>
              <Text style={styles.modalSubtitle}>Choose how you want to add money.</Text>

              <View style={styles.methodSelector}>
                <TouchableOpacity
                  style={[styles.methodTab, method === 'card' && styles.activeTab]}
                  onPress={() => setMethod('card')}
                >
                  <Ionicons name="card-outline" size={16} color={method === 'card' ? colors.primary : colors.textMuted} />
                  <Text style={method === 'card' ? styles.activeTabText : styles.tabText}>Card / Online</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.methodTab, method === 'bank' && styles.activeTab]}
                  onPress={() => setMethod('bank')}
                >
                  <Ionicons name="business-outline" size={16} color={method === 'bank' ? colors.primary : colors.textMuted} />
                  <Text style={method === 'bank' ? styles.activeTabText : styles.tabText}>Bank Transfer</Text>
                </TouchableOpacity>
              </View>

              {method === 'card' ? (
                <View>
                  <View style={styles.amountInputWrap}>
                    <Text style={styles.currencySign}>{'\u20a6'}</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={amount}
                      onChangeText={setAmount}
                      autoFocus={visible}
                    />
                  </View>
                  <GradientButton title="Proceed to Paystack" onPress={handleCardFunding} loading={loading} />
                </View>
              ) : (
                <View style={styles.bankContainer}>
                  <Text style={styles.bankInstruction}>
                    Share this account number with other ZannyPay users so they can send money straight to your wallet.
                    {'\n\n'}
                    This is <Text style={{ fontWeight: '700' }}>not</Text> a bank-linked virtual account yet, so transfers from
                    an external bank app will not arrive here — use "Proceed to Paystack" above to fund from a card or your bank instead.
                  </Text>
                  <LinearGradient colors={gradients.primary} style={styles.accountCard}>
                    <Text style={styles.bankName}>ZannyPay Account Number</Text>
                    <Text style={styles.accountNumber}>{user?.accountNumber || 'Generating...'}</Text>
                    <Text style={styles.accountName}>{user?.name}</Text>
                  </LinearGradient>
                </View>
              )}

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.textDark },
  modalSubtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4, marginBottom: 20 },

  methodSelector: { flexDirection: 'row', backgroundColor: colors.bgLight, borderRadius: 14, padding: 4, marginBottom: 24 },
  methodTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 6 },
  activeTab: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  tabText: { color: colors.textMuted, fontWeight: '600' },
  activeTabText: { color: colors.primary, fontWeight: 'bold' },

  amountInputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgLight, borderRadius: 16, paddingHorizontal: 18, marginBottom: 18, borderWidth: 1, borderColor: colors.border },
  currencySign: { fontSize: 22, fontWeight: '800', color: colors.textMuted, marginRight: 6 },
  modalInput: { flex: 1, paddingVertical: 18, fontSize: 22, fontWeight: '700', color: colors.textDark },

  bankContainer: { marginBottom: 10 },
  bankInstruction: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 16 },
  accountCard: { padding: 24, borderRadius: 20 },
  bankName: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  accountNumber: { color: '#fff', fontSize: 32, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 },
  accountName: { color: '#fff', fontSize: 16, fontWeight: '500' },

  cancelBtn: { marginTop: 24, alignItems: 'center' },
  cancelBtnText: { color: colors.textMuted, fontWeight: '600' },

  confirmingWrap: { alignItems: 'center', paddingVertical: 40 },
  confirmingTitle: { fontSize: 17, fontWeight: '700', color: colors.textDark, marginTop: 20 },
  confirmingSub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
});
