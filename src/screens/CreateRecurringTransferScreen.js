import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import { formatCurrency } from '../utils/format';
import GradientButton from '../components/GradientButton';

const FREQUENCIES = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

export default function CreateRecurringTransferScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { resolveRecipient, createRecurringTransfer } = useWallet();

  const [recipientAccount, setRecipientAccount] = useState('');
  const [resolvedRecipient, setResolvedRecipient] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const resolveDebounceRef = useRef(null);

  useEffect(() => {
    setResolvedRecipient(null);
    if (resolveDebounceRef.current) clearTimeout(resolveDebounceRef.current);

    const cleaned = (recipientAccount || '').trim();
    if (cleaned.length < 10) return;

    resolveDebounceRef.current = setTimeout(async () => {
      setResolving(true);
      const res = await resolveRecipient(cleaned);
      setResolving(false);
      if (res.ok) setResolvedRecipient(res.recipient);
    }, 500);

    return () => clearTimeout(resolveDebounceRef.current);
  }, [recipientAccount, resolveRecipient]);

  const handleContinue = () => {
    if (!resolvedRecipient) {
      alert('Recipient Required', 'Enter a valid ZannyPay account number, phone number, or business account number.', null, { type: 'warning' });
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      alert('Amount Required', 'Please enter an amount.', null, { type: 'warning' });
      return;
    }
    setPin('');
    setPinModalVisible(true);
  };

  const handleConfirm = async () => {
    if (pin.length !== 4) return;
    setSaving(true);
    const res = await createRecurringTransfer({ recipientAccount: recipientAccount.trim(), amount, note, frequency, pin });
    setSaving(false);
    setPinModalVisible(false);

    if (!res.ok) {
      alert('Could Not Set Up', res.error, null, { type: 'error' });
      return;
    }
    alert(
      'Recurring Transfer Set Up',
      `${formatCurrency(amount)} will be sent to ${resolvedRecipient.name} every ${frequency === 'daily' ? 'day' : frequency === 'weekly' ? 'week' : 'month'}, starting soon.`,
      [{ text: 'Done', onPress: () => navigation.goBack() }],
      { type: 'success' }
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>New Recurring Transfer</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: theme.text }]}>Recipient</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Account number, phone, or business number"
          placeholderTextColor={theme.textMuted}
          value={recipientAccount}
          onChangeText={setRecipientAccount}
          keyboardType="number-pad"
        />
        {resolving && <ActivityIndicator style={{ marginTop: 10 }} color={theme.primary} />}
        {resolvedRecipient && (
          <View style={[styles.resolvedCard, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="checkmark-circle" size={18} color={theme.success} />
            <Text style={[styles.resolvedText, { color: theme.text }]}>{resolvedRecipient.name}</Text>
          </View>
        )}

        <Text style={[styles.label, { color: theme.text }]}>Amount</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="₦0.00"
          placeholderTextColor={theme.textMuted}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={[styles.label, { color: theme.text }]}>Repeats</Text>
        <View style={styles.frequencyRow}>
          {FREQUENCIES.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.frequencyChip, { borderColor: theme.border, backgroundColor: theme.surface }, frequency === f.key && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setFrequency(f.key)}
            >
              <Text style={[styles.frequencyText, { color: theme.text }, frequency === f.key && { color: '#fff' }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          The first transfer happens one {frequency === 'daily' ? 'day' : frequency === 'weekly' ? 'week' : 'month'} from today, not immediately.
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>Note (Optional)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="e.g. Rent"
          placeholderTextColor={theme.textMuted}
          value={note}
          onChangeText={setNote}
        />

        <GradientButton title="Continue" onPress={handleContinue} style={{ marginTop: 24 }} />
      </ScrollView>

      <Modal visible={pinModalVisible} transparent animationType="fade" onRequestClose={() => setPinModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Confirm Your PIN</Text>
            <Text style={[styles.hint, { color: theme.textMuted, textAlign: 'center', marginBottom: 20 }]}>
              This authorizes {formatCurrency(amount || 0)} every {frequency === 'daily' ? 'day' : frequency === 'weekly' ? 'week' : 'month'} to {resolvedRecipient?.name}. Your PIN is only checked now — future transfers won't ask for it again.
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, textAlign: 'center', fontSize: 24, letterSpacing: 8 }]}
              placeholder="••••"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
              value={pin}
              onChangeText={setPin}
            />
            <GradientButton title="Authorize" onPress={handleConfirm} loading={saving} style={{ marginTop: 20 }} />
            <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => setPinModalVisible(false)}>
              <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1 },
  resolvedCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginTop: 10 },
  resolvedText: { fontSize: 13, fontWeight: '600' },
  frequencyRow: { flexDirection: 'row', gap: 10 },
  frequencyChip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  frequencyText: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 11, marginTop: 8, lineHeight: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
});
