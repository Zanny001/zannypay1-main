import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import { formatCurrency, formatDate } from '../utils/format';
import Card from '../components/Card';
import FadeInView from '../components/FadeInView';
import Skeleton from '../components/Skeleton';

const STATUS_META = {
  active: { label: 'Active', color: 'success' },
  paused: { label: 'Paused', color: 'accent' },
  cancelled: { label: 'Cancelled', color: 'textMuted' },
};

function frequencyLabel(f) {
  return f === 'daily' ? 'Every day' : f === 'weekly' ? 'Every week' : 'Every month';
}

export default function RecurringTransfersScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { fetchRecurringTransfers, pauseRecurringTransfer, resumeRecurringTransfer, cancelRecurringTransfer } = useWallet();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);

  const load = useCallback(async () => {
    const res = await fetchRecurringTransfers();
    if (res.ok) setItems(res.data);
  }, [fetchRecurringTransfers]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      load().finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [load])
  );

  const handlePause = async (id) => {
    setActioningId(id);
    await pauseRecurringTransfer(id);
    await load();
    setActioningId(null);
  };

  const handleResume = async (id) => {
    setActioningId(id);
    await resumeRecurringTransfer(id);
    await load();
    setActioningId(null);
  };

  const handleCancel = (id) => {
    alert('Cancel Recurring Transfer', 'This cannot be undone — you can always set up a new one later.', [
      { text: 'Keep It', style: 'cancel' },
      {
        text: 'Cancel Transfer',
        style: 'destructive',
        onPress: async () => {
          setActioningId(id);
          await cancelRecurringTransfer(id);
          await load();
          setActioningId(null);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Recurring Transfers</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateRecurringTransfer')} style={styles.backBtn}>
          <Ionicons name="add-circle-outline" size={26} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 20 }}>
          <Skeleton width="100%" height={90} radius={16} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={90} radius={16} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const meta = STATUS_META[item.status] || STATUS_META.active;
            const isBusy = actioningId === item.id;
            return (
              <FadeInView index={index}>
                <Card style={styles.card}>
                  <View style={styles.topRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.recipientName, { color: theme.text }]}>{item.recipientName}</Text>
                      <Text style={[styles.frequency, { color: theme.textMuted }]}>{frequencyLabel(item.frequency)}</Text>
                    </View>
                    <Text style={[styles.amount, { color: theme.text }]}>{formatCurrency(item.amount)}</Text>
                  </View>

                  <View style={[styles.metaRow, { borderTopColor: theme.border }]}>
                    <View style={[styles.statusBadge, { backgroundColor: `${theme[meta.color]}20` }]}>
                      <Text style={[styles.statusText, { color: theme[meta.color] }]}>{meta.label}</Text>
                    </View>
                    <Text style={[styles.nextRun, { color: theme.textMuted }]}>
                      {item.status === 'active' ? `Next: ${formatDate(item.nextRunAt)}` : item.lastRunError || ' '}
                    </Text>
                  </View>

                  {item.status !== 'cancelled' && (
                    <View style={styles.actionsRow}>
                      {item.status === 'active' ? (
                        <TouchableOpacity disabled={isBusy} onPress={() => handlePause(item.id)} style={styles.actionBtn}>
                          <Text style={[styles.actionText, { color: theme.primary }]}>Pause</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity disabled={isBusy} onPress={() => handleResume(item.id)} style={styles.actionBtn}>
                          <Text style={[styles.actionText, { color: theme.primary }]}>Resume</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity disabled={isBusy} onPress={() => handleCancel(item.id)} style={styles.actionBtn}>
                        <Text style={[styles.actionText, { color: theme.danger }]}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              </FadeInView>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="repeat-outline" size={32} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Recurring Transfers</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>Automate rent, savings, or regular payments.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  listContent: { padding: 20, flexGrow: 1 },
  card: { padding: 16, marginBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  recipientName: { fontSize: 15, fontWeight: '700' },
  frequency: { fontSize: 12, marginTop: 3 },
  amount: { fontSize: 15, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '700' },
  nextRun: { fontSize: 11, flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  actionsRow: { flexDirection: 'row', gap: 20, marginTop: 12 },
  actionBtn: { paddingVertical: 4 },
  actionText: { fontSize: 13, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center' },
});
