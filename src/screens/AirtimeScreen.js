import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { formatCurrency } from '../utils/format';
import GradientButton from '../components/GradientButton';
import SuccessModal from '../components/SuccessModal';
import PointsRedemptionToggle, { computeMaxRedeemablePoints } from '../components/PointsRedemptionToggle';
import { useAlert } from '../context/AlertContext';

const AMOUNTS = ['100', '200', '500', '1000', '2000', '5000'];
const PROVIDERS = ['MTN', 'Airtel', 'Glo', '9mobile'];

// Merged in from the standalone DataScreen — a real plan catalog beats a
// bare amount grid for data bundles, since data is sold in fixed tiers.
const DATA_PLANS = [
  { id: '1', data: '1GB', duration: '1 Day', price: 440 },
  { id: '2', data: '110MB', duration: '1 Day', price: 50 },
  { id: '3', data: '500MB', duration: '7 Days', price: 440 },
  { id: '4', data: '1GB', duration: '7 Days', price: 740 },
  { id: '5', data: '1.2GB', duration: '30 Days', price: 980 },
  { id: '6', data: '2GB', duration: '30 Days', price: 1440 },
  { id: '7', data: '3GB', duration: '30 Days', price: 1470 },
  { id: '8', data: '10GB', duration: '30 Days', price: 2940 },
];

export default function AirtimeScreen({ navigation }) {
  const { alert } = useAlert();
  const { theme } = useTheme();
  const { buyAirtime, user } = useWallet();
  const [activeTab, setActiveTab] = useState('Airtime');
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [usePoints, setUsePoints] = useState(false);
  
  // PIN Modal State
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleTopup = () => {
    if (!phone || !amount) {
      alert('Details Required', 'Please enter a phone number and select an amount.');
      return;
    }
    setPin(''); // Reset PIN on new attempt
    setUsePoints(false);
    setPinModalVisible(true); // Trigger the PIN input modal
  };

  const handleConfirmPurchase = async () => {
    if (pin.length !== 4) {
      alert('Invalid PIN', 'Please enter your 4-digit transaction PIN.');
      return;
    }
    
    const pointsToRedeem = usePoints ? computeMaxRedeemablePoints(amount, user?.rewardPoints) : 0;
    setLoading(true);
    const res = await buyAirtime({
      phone,
      amount,
      provider,
      pin,
      isData: activeTab === 'Data Bundle',
      pointsToRedeem,
    });
    
    setLoading(false);
    
    if (!res.ok) {
      setPinModalVisible(false);
      alert('Purchase failed', res.error);
      return;
    }
    
    setPinModalVisible(false);
    const savingsNote = pointsToRedeem > 0 ? ` Saved ${formatCurrency(pointsToRedeem / 10)} with points.` : '';
    const successMessage = activeTab === 'Data Bundle' && selectedPlan
      ? `${selectedPlan.data} (${selectedPlan.duration}) data purchased for ${phone}.${savingsNote}`
      : `${formatCurrency(amount)} ${activeTab} purchased for ${phone}.${savingsNote}`;
    setSuccessInfo({ message: successMessage });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Mobile Top-up</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Tab Switcher */}
        <View style={[styles.tabContainer, { backgroundColor: theme.surface }]}>
          {['Airtime', 'Data Bundle'].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && { backgroundColor: theme.surfaceAlt }]}
              onPress={() => {
                setActiveTab(tab);
                setAmount('');
                setSelectedPlan(null);
              }}
            >
              <Text style={[styles.tabText, { color: activeTab === tab ? theme.primary : theme.textMuted }]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Provider Selector */}
        <Text style={[styles.label, { color: theme.textMuted }]}>Network Provider</Text>
        <View style={styles.providerRow}>
          {PROVIDERS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.providerChip, { borderColor: theme.border, backgroundColor: theme.surface }, provider === p && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setProvider(p)}
            >
              <Text style={{ color: provider === p ? '#fff' : theme.text, fontWeight: '600' }}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Input Card */}
        <View style={[styles.inputCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.label, { color: theme.textMuted, marginTop: 0 }]}>Mobile Number</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="0800 000 0000"
              placeholderTextColor={theme.border}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <Ionicons name="person-circle" size={32} color={theme.primary} />
          </View>
        </View>

        {activeTab === 'Airtime' ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Top-up Amount</Text>
            <View style={styles.grid}>
              {AMOUNTS.map((amt) => (
                <TouchableOpacity
                  key={amt}
                  style={[
                    styles.gridItem,
                    { backgroundColor: theme.surface, borderColor: amount === amt ? theme.primary : theme.border },
                    amount === amt && { backgroundColor: 'rgba(98, 54, 255, 0.15)' }
                  ]}
                  onPress={() => setAmount(amt)}
                >
                  <Text style={[styles.gridAmt, { color: amount === amt ? theme.primary : theme.text }]}>₦{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: theme.textMuted }]}>Or enter a custom amount</Text>
            <TextInput
              style={[styles.input, styles.customAmountInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              placeholder="₦0.00"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          </>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Choose a Data Plan</Text>
            <View style={styles.planGrid}>
              {DATA_PLANS.map((plan) => (
                <TouchableOpacity
                  key={plan.id}
                  style={[
                    styles.planCard,
                    { backgroundColor: theme.surface, borderColor: selectedPlan?.id === plan.id ? theme.primary : theme.border },
                    selectedPlan?.id === plan.id && { backgroundColor: 'rgba(98, 54, 255, 0.15)' },
                  ]}
                  onPress={() => {
                    setSelectedPlan(plan);
                    setAmount(String(plan.price));
                  }}
                >
                  <Text style={[styles.planData, { color: selectedPlan?.id === plan.id ? theme.primary : theme.text }]}>{plan.data}</Text>
                  <Text style={[styles.planDuration, { color: theme.textMuted }]}>{plan.duration}</Text>
                  <Text style={[styles.planPrice, { color: theme.text }]}>₦{plan.price}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <GradientButton title="Pay Now" onPress={handleTopup} style={{ marginTop: 20 }} />
      </ScrollView>

      {/* PIN Confirmation Modal */}
      <Modal visible={pinModalVisible} transparent animationType="fade" onRequestClose={() => setPinModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Confirm Purchase</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
              {activeTab === 'Data Bundle' && selectedPlan
                ? `Buy ${selectedPlan.data} (${selectedPlan.duration}) for ${phone} (${provider}) — ${formatCurrency(amount)}`
                : `Buy ${formatCurrency(amount)} ${activeTab} for ${phone} (${provider})?`}
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
              keyboardType="numeric"
              secureTextEntry
              maxLength={4}
              value={pin}
              onChangeText={setPin}
              autoFocus
            />
            
            <GradientButton title="Confirm & Pay" onPress={handleConfirmPurchase} loading={loading} style={{ marginTop: 20 }} />
            
            <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => setPinModalVisible(false)}>
              <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <SuccessModal
        visible={!!successInfo}
        title="Purchase Successful"
        message={successInfo?.message}
        onClose={() => { setSuccessInfo(null); navigation.goBack(); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  scroll: { padding: 20 },
  tabContainer: { flexDirection: 'row', borderRadius: 16, padding: 6, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 12 },
  tabText: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginTop: 16 },
  providerRow: { flexDirection: 'row', flexWrap: 'wrap' },
  providerChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, marginBottom: 10 },
  inputCard: { borderRadius: 20, padding: 20, marginTop: 6, marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { flex: 1, fontSize: 20, fontWeight: '800', padding: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridItem: { width: '31%', borderWidth: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 15 },
  gridAmt: { fontSize: 18, fontWeight: '800' },
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  planCard: { width: '48%', borderWidth: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  planData: { fontSize: 18, fontWeight: '800' },
  planDuration: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  planPrice: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  customAmountInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  pinInput: { borderRadius: 12, borderWidth: 1, textAlign: 'center', fontSize: 24, letterSpacing: 8, paddingVertical: 15 }
});
