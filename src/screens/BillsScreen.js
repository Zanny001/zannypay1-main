import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientButton from '../components/GradientButton';
import SuccessModal from '../components/SuccessModal';
import PressableScale from '../components/PressableScale';
import PointsRedemptionToggle, { computeMaxRedeemablePoints } from '../components/PointsRedemptionToggle';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { formatCurrency } from '../utils/format';
import { useAlert } from '../context/AlertContext';
import FadeInView from '../components/FadeInView';

// These categories are visible as a product roadmap, not as live billers.
 // The backend deliberately fails closed until a contracted biller can confirm
 // fulfilment. Do not collect a PIN or debit a wallet for an unavailable service.
const BILL_PAYMENTS_LIVE = false;

const CATEGORIES = [
  { key: 'electricity', label: 'Electricity', icon: 'flash', color: '#F59E0B' },
  { key: 'tv', label: 'TV Subscription', icon: 'tv', color: '#8B5CF6' },
  { key: 'water', label: 'Water', icon: 'water', color: '#0EA5E9' },
  { key: 'internet', label: 'Internet', icon: 'globe', color: '#0E9F6E' },
  { key: 'education', label: 'Education', icon: 'school', color: '#D97706' },
  { key: 'transport', label: 'Transport', icon: 'bus', color: '#64748B' },
  { key: 'insurance', label: 'Insurance', icon: 'shield-checkmark', color: '#0F766E' },
  { key: 'waste', label: 'Waste & Sanitation', icon: 'leaf', color: '#65A30D' },
];

const PROVIDERS = {
  electricity: ['EKEDC', 'IKEDC', 'AEDC', 'PHED'],
  tv: ['DSTV', 'GOtv', 'StarTimes'],
  water: ['Lagos Water Corp'],
  internet: ['Spectranet', 'Smile'],
};

export default function BillsScreen({ navigation, route }) {
  const { alert } = useAlert();
  const { theme } = useTheme();
  const { payBill, balance, user } = useWallet();
  const [category, setCategory] = useState(route?.params?.initialCategory || null);
  const [provider, setProvider] = useState('');
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usePoints, setUsePoints] = useState(false);

  const activeCategory = CATEGORIES.find((c) => c.key === category);

  const reset = () => {
    setCategory(null);
    setProvider('');
    setReference('');
    setAmount('');
    setPin('');
    setUsePoints(false);
  };

  const openPinModal = () => {
    if (!BILL_PAYMENTS_LIVE) {
      alert('Bill payments coming soon', 'ZannyPay is preparing verified electricity, TV, water and other bill-payment connections. Your wallet will not be charged until a live provider is connected.', null, { type: 'info' });
      return;
    }
    if (!provider || !amount || !reference) {
      alert('Missing details', 'Please select a provider, then enter your account/meter number and amount.', null, { type: 'warning' });
      return;
    }
    setPin('');
    setPinModalVisible(true);
  };

  const handlePay = async () => {
    if (pin.length !== 4) {
      alert('Invalid PIN', 'Please enter your 4-digit transaction PIN.', null, { type: 'warning' });
      return;
    }
    const pointsToRedeem = usePoints ? computeMaxRedeemablePoints(amount, user?.rewardPoints) : 0;
    setLoading(true);
    const res = await payBill({
      billerName: provider,
      category: activeCategory?.label,
      amount,
      reference,
      pin,
      pointsToRedeem,
    });
    setLoading(false);
    setPinModalVisible(false);

    if (!res.ok) {
      alert('Payment failed', res.error, null, { type: 'error' });
      return;
    }
    const savingsNote = pointsToRedeem > 0 ? ` (saved ${formatCurrency(pointsToRedeem / 10)} with points)` : '';
    setSuccessInfo({ message: `Paid ${formatCurrency(amount)} to ${provider}.${savingsNote}` });
  };

  // View 1: Categories Grid
  if (!category) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Pay Bills</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
          <View style={[styles.balanceCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.balanceLabel, { color: theme.textMuted }]}>Available Balance</Text>
            <Text style={[styles.balanceValue, { color: theme.text }]}>{formatCurrency(balance)}</Text>
          </View>

          <TouchableOpacity style={[styles.airtimeBanner, { backgroundColor: theme.surfaceAlt }]} onPress={() => navigation.navigate('Airtime')}>
            <View style={[styles.iconWrap, { backgroundColor: `${theme.primary}20` }]}>
              <Ionicons name="phone-portrait" size={24} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.airtimeTitle, { color: theme.text }]}>Airtime & Data</Text>
              <Text style={[styles.airtimeSub, { color: theme.textMuted }]}>Airtime and data top-ups · Coming soon</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>

          <View style={[styles.availabilityCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="construct-outline" size={20} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.availabilityTitle, { color: theme.text }]}>Bill payments are being prepared</Text>
              <Text style={[styles.availabilityText, { color: theme.textMuted }]}>
                Provider verification and secure fulfilment are still in progress. These services are not accepting payments yet.
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>Utilities · Coming soon</Text>
          <View style={styles.grid}>
            {CATEGORIES.map((c, idx) => (
              <FadeInView key={c.key} index={idx} style={styles.gridItemWrap}>
                <PressableScale style={[styles.gridItem, { backgroundColor: theme.surface, opacity: 0.78 }]} onPress={() => {
                  if (!BILL_PAYMENTS_LIVE) {
                    alert('Coming soon', `${c.label} payments will be enabled after a verified biller connection is live.`, null, { type: 'info' });
                    return;
                  }
                  setCategory(c.key);
                }}>
                  <View style={[styles.categoryIconWrap, { backgroundColor: `${c.color}20` }]}>
                    <Ionicons name={c.icon} size={24} color={c.color} />
                  </View>
                  <Text style={[styles.gridLabel, { color: theme.text }]}>{c.label}</Text>
                  <Text style={[styles.comingSoonLabel, { color: theme.textMuted }]}>Coming soon</Text>
                </PressableScale>
              </FadeInView>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // View 2: Specific Bill Payment Form
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setCategory(null)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{activeCategory?.label}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.label, { color: theme.textMuted }]}>Select Provider</Text>
        <View style={styles.providerRow}>
          {(PROVIDERS[category] || []).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.providerChip,
                { borderColor: theme.border, backgroundColor: theme.surface },
                provider === p && { backgroundColor: activeCategory?.color, borderColor: activeCategory?.color },
              ]}
              onPress={() => setProvider(p)}
            >
              <Text style={{ color: provider === p ? '#fff' : theme.text, fontWeight: '600' }}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textMuted }]}>
          {category === 'electricity' || category === 'tv' ? 'Meter / Smartcard Number' : 'Account Number'}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Enter number"
          placeholderTextColor={theme.textMuted}
          value={reference}
          onChangeText={setReference}
          keyboardType="number-pad"
        />

        <Text style={[styles.label, { color: theme.textMuted }]}>Amount</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="₦0.00"
          placeholderTextColor={theme.textMuted}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <GradientButton title="Continue" onPress={openPinModal} style={{ marginTop: 30 }} />
      </ScrollView>

      <Modal visible={pinModalVisible} transparent animationType="fade" onRequestClose={() => setPinModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Confirm Payment</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
              Pay {formatCurrency(amount)} to {provider} for {reference}
            </Text>

            <PointsRedemptionToggle
              amount={amount}
              availablePoints={user?.rewardPoints}
              enabled={usePoints}
              onToggle={setUsePoints}
            />

            <TextInput
              style={[styles.pinInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              placeholder="••••"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              value={pin}
              onChangeText={setPin}
              autoFocus
            />
            <GradientButton title="Confirm & Pay" onPress={handlePay} loading={loading} style={{ marginTop: 20 }} />
            <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => setPinModalVisible(false)}>
              <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SuccessModal
        visible={!!successInfo}
        title="Payment Successful"
        message={successInfo?.message}
        onClose={() => { setSuccessInfo(null); reset(); navigation.navigate('Main'); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  balanceCard: { borderRadius: 18, padding: 18, marginBottom: 20 },
  balanceLabel: { fontSize: 12, fontWeight: '600' },
  balanceValue: { fontSize: 24, fontWeight: '800', marginTop: 6 },
  airtimeBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 16, marginBottom: 24 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  airtimeTitle: { fontSize: 14, fontWeight: '700' },
  airtimeSub: { fontSize: 12, marginTop: 3 },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItemWrap: { width: '48%', marginBottom: 14 },
  gridItem: { alignItems: 'center', borderRadius: 18, paddingVertical: 20 },
  categoryIconWrap: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  gridLabel: { fontSize: 13, textAlign: 'center', fontWeight: '600' },
  comingSoonLabel: { fontSize: 10, fontWeight: '700', marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  availabilityCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 24 },
  availabilityTitle: { fontSize: 14, fontWeight: '800', marginBottom: 5 },
  availabilityText: { fontSize: 12, lineHeight: 18 },
  scrollContent: { padding: 24, paddingTop: 10 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  providerRow: { flexDirection: 'row', flexWrap: 'wrap' },
  providerChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, marginBottom: 10 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  pinInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 24, letterSpacing: 8, textAlign: 'center', borderWidth: 1 },
});
