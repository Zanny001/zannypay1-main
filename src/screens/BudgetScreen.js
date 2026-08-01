import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import { formatCurrency } from '../utils/format';
import AnimatedProgressBar from '../components/AnimatedProgressBar';
import GradientButton from '../components/GradientButton';
import FadeInView from '../components/FadeInView';

const CATEGORIES = ['Transfers', 'Bills & Utilities', 'Airtime & Data', 'Savings'];

function matchesCategory(txn, label) {
  const cat = (txn.category || '').toLowerCase();
  if (label === 'Transfers') return cat === 'transfer';
  if (label === 'Savings') return cat === 'savings';
  if (label === 'Airtime & Data') return cat === 'airtime' || cat === 'data';
  if (label === 'Bills & Utilities') {
    return !['transfer', 'savings', 'flexi credit', 'invoices', 'funding', 'airtime', 'data'].includes(cat);
  }
  return false;
}

export default function BudgetScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { budgets, setBudgetLimit, removeBudget, transactions } = useWallet();

  const [modalVisible, setModalVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [limitInput, setLimitInput] = useState('');
  const [saving, setSaving] = useState(false);

  const spendByCategory = useMemo(() => {
    const now = new Date();
    const monthTxns = (transactions || []).filter((t) => {
      const d = new Date(t.createdAt || t.date);
      return t.type === 'debit' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const map = {};
    CATEGORIES.forEach((cat) => {
      map[cat] = monthTxns.filter((t) => matchesCategory(t, cat)).reduce((sum, t) => sum + (Math.abs(parseFloat(t.amount)) || 0), 0);
    });
    return map;
  }, [transactions]);

  const getBudgetFor = (category) => budgets.find((b) => b.category === category);

  const openSetLimit = (category) => {
    const existing = getBudgetFor(category);
    setActiveCategory(category);
    setLimitInput(existing ? String(existing.monthlyLimit) : '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!limitInput || Number(limitInput) <= 0) {
      alert('Invalid Amount', 'Please enter a valid monthly limit.', null, { type: 'warning' });
      return;
    }
    setSaving(true);
    const res = await setBudgetLimit(activeCategory, limitInput);
    setSaving(false);
    if (!res.ok) {
      alert('Could Not Save', res.error, null, { type: 'error' });
      return;
    }
    setModalVisible(false);
    alert('Budget Set', `${activeCategory} monthly limit set to ${formatCurrency(limitInput)}.`, null, { type: 'success' });
  };

  const handleRemove = async (category) => {
    await removeBudget(category);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Spending Budgets</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={[styles.introText, { color: theme.textMuted }]}>
          Set a monthly spending limit per category. We'll track it against this month's real activity.
        </Text>

        {CATEGORIES.map((category, idx) => {
          const budget = getBudgetFor(category);
          const spent = spendByCategory[category] || 0;
          const limit = budget ? Number(budget.monthlyLimit) : 0;
          const pct = limit > 0 ? (spent / limit) * 100 : 0;
          const isOver = limit > 0 && spent > limit;

          return (
            <FadeInView key={category} delay={idx * 60}>
              <View style={[styles.card, { backgroundColor: theme.surface }]}>
                <View style={styles.cardTopRow}>
                  <Text style={[styles.cardTitle, { color: theme.text }]}>{category}</Text>
                  {budget ? (
                    <TouchableOpacity onPress={() => handleRemove(category)}>
                      <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {budget ? (
                  <>
                    <AnimatedProgressBar percentage={Math.min(pct, 100)} color={isOver ? theme.danger : theme.primary} trackColor={theme.border} />
                    <View style={styles.cardMetaRow}>
                      <Text style={[styles.cardMetaText, { color: isOver ? theme.danger : theme.text }]}>
                        {formatCurrency(spent)} spent
                      </Text>
                      <Text style={[styles.cardMetaText, { color: theme.textMuted }]}>of {formatCurrency(limit)}</Text>
                    </View>
                    {isOver && <Text style={[styles.overText, { color: theme.danger }]}>You've gone over this month's limit.</Text>}
                    <TouchableOpacity onPress={() => openSetLimit(category)}>
                      <Text style={[styles.editLink, { color: theme.primary }]}>Edit Limit</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={[styles.setBtn, { borderColor: theme.border }]} onPress={() => openSetLimit(category)}>
                    <Ionicons name="add-circle-outline" size={16} color={theme.primary} />
                    <Text style={[styles.setBtnText, { color: theme.primary }]}>Set a monthly limit</Text>
                  </TouchableOpacity>
                )}
              </View>
            </FadeInView>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{activeCategory}</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>Set your monthly spending limit</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              placeholder="₦0.00"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={limitInput}
              onChangeText={setLimitInput}
              autoFocus
            />
            <GradientButton title="Save Limit" onPress={handleSave} loading={saving} style={{ marginTop: 20 }} />
            <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => setModalVisible(false)}>
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
  headerTitle: { fontSize: 18, fontWeight: '800' },
  introText: { fontSize: 13, lineHeight: 19, marginBottom: 20 },
  card: { borderRadius: 18, padding: 18, marginBottom: 14 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cardMetaText: { fontSize: 12, fontWeight: '600' },
  overText: { fontSize: 11, fontWeight: '700', marginTop: 8 },
  editLink: { fontSize: 12, fontWeight: '700', marginTop: 12 },
  setBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, paddingVertical: 12 },
  setBtnText: { fontSize: 13, fontWeight: '700', marginLeft: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, borderWidth: 1, textAlign: 'center' },
});
