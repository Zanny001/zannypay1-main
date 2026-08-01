import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, SectionList, TouchableOpacity, RefreshControl, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { formatCurrency } from '../utils/format';
import TransactionRow from '../components/TransactionRow';

const CATEGORY_FILTERS = ['All Categories', 'Transfers', 'Bills & Utilities', 'Savings', 'Flexi Credit', 'Funding', 'Invoices'];

function matchesCategory(txn, filterLabel) {
  if (filterLabel === 'All Categories') return true;
  const cat = (txn.category || '').toLowerCase();
  if (filterLabel === 'Transfers') return cat === 'transfer';
  if (filterLabel === 'Savings') return cat === 'savings';
  if (filterLabel === 'Flexi Credit') return cat === 'flexi credit';
  if (filterLabel === 'Invoices') return cat === 'invoices';
  if (filterLabel === 'Funding') return cat === 'funding' || cat === 'wallet funding';
  if (filterLabel === 'Bills & Utilities') {
    return !['transfer', 'savings', 'flexi credit', 'invoices', 'funding', 'wallet funding'].includes(cat);
  }
  return true;
}

export default function HistoryScreen({ navigation }) {
  const { theme } = useTheme();
  const { transactions, syncWallet } = useWallet();
  const [flowFilter, setFlowFilter] = useState('all'); // 'all' | 'credit' | 'debit'
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    return (transactions || []).filter((txn) => {
      if (flowFilter !== 'all' && txn.type !== flowFilter) return false;
      return matchesCategory(txn, categoryFilter);
    });
  }, [transactions, flowFilter, categoryFilter]);

  // Group by "Month Year" for a SectionList, newest month first.
  const sections = useMemo(() => {
    const groups = {};
    filtered.forEach((txn) => {
      const date = new Date(txn.createdAt || txn.date || Date.now());
      const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(txn);
    });
    return Object.keys(groups).map((title) => ({ title, data: groups[title] }));
  }, [filtered]);

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

  const onRefresh = async () => {
    setRefreshing(true);
    await syncWallet();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Transaction History</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.flowMetrics}>
        <Text style={[styles.metricsLabel, { color: theme.textMuted }]}>
          In <Text style={[styles.metricsValue, { color: theme.success }]}>{formatCurrency(totals.in)}</Text>
        </Text>
        <Text style={[styles.metricsLabel, { color: theme.textMuted, marginLeft: 16 }]}>
          Out <Text style={[styles.metricsValue, { color: theme.danger }]}>{formatCurrency(totals.out)}</Text>
        </Text>
      </View>

      <View style={styles.filterContainer}>
        {['all', 'credit', 'debit'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, { backgroundColor: flowFilter === f ? theme.primary : theme.surface }]}
            onPress={() => setFlowFilter(f)}
          >
            <Text style={[styles.filterText, { color: flowFilter === f ? '#FFF' : theme.textMuted }]}>
              {f === 'all' ? 'All' : f === 'credit' ? 'Money In' : 'Money Out'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.filterPill, styles.categoryPill, { backgroundColor: theme.surface }]}
          onPress={() => setCategoryModalVisible(true)}
        >
          <Text style={[styles.filterText, { color: theme.textMuted }]} numberOfLines={1}>{categoryFilter}</Text>
          <Ionicons name="funnel-outline" size={13} color={theme.textMuted} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => <TransactionRow txn={item} index={index} />}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={[styles.sectionHeader, { color: theme.textMuted, backgroundColor: theme.background }]}>{title}</Text>
        )}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.surface }]}>
              <Ionicons name="receipt-outline" size={32} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Records Found</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>Nothing matches these filters yet.</Text>
          </View>
        }
      />

      <Modal visible={categoryModalVisible} animationType="slide" transparent onRequestClose={() => setCategoryModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeaderClose, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>Filter by Category</Text>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              {CATEGORY_FILTERS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.dropdownRow, { borderBottomColor: theme.border }]}
                  onPress={() => {
                    setCategoryFilter(cat);
                    setCategoryModalVisible(false);
                  }}
                >
                  <Text style={[styles.dropdownRowText, { color: theme.text }, categoryFilter === cat && { color: theme.primary, fontWeight: '700' }]}>{cat}</Text>
                  {categoryFilter === cat && <Ionicons name="checkmark" size={18} color={theme.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  title: { fontSize: 20, fontWeight: '800' },
  flowMetrics: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 14 },
  metricsLabel: { fontSize: 12 },
  metricsValue: { fontWeight: '700' },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, gap: 10 },
  filterPill: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24, flexDirection: 'row', alignItems: 'center' },
  categoryPill: { flex: 1 },
  filterText: { fontSize: 13, fontWeight: '700' },
  listContent: { paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 },
  sectionHeader: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', paddingVertical: 10, letterSpacing: 0.5 },
  emptyStateContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { height: '75%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalHeaderClose: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalHeaderTitle: { fontSize: 16, fontWeight: '700' },
  dropdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  dropdownRowText: { fontSize: 15, fontWeight: '500' },
});
