import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { formatCurrency, formatDate } from '../utils/format';
import Card from '../components/Card';
import FadeInView from '../components/FadeInView';
import Skeleton from '../components/Skeleton';

export default function InvoicesListScreen({ navigation }) {
  const { theme } = useTheme();
  const { fetchInvoices } = useWallet();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      fetchInvoices().then((res) => {
        if (cancelled) return;
        if (res.ok) setInvoices(res.data || []);
        setLoading(false);
      });
      return () => { cancelled = true; };
    }, [fetchInvoices])
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Invoices</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Invoice')} style={styles.backBtn}>
          <Ionicons name="add-circle-outline" size={26} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 20 }}>
          <Skeleton width="100%" height={70} radius={14} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={70} radius={14} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={70} radius={14} />
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <FadeInView index={index}>
              <TouchableOpacity onPress={() => navigation.navigate('InvoiceDetail', { invoiceId: item.id })}>
                <Card style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.clientName, { color: theme.text }]}>{item.clientName}</Text>
                    <Text style={[styles.date, { color: theme.textMuted }]}>{formatDate(item.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.amount, { color: theme.text }]}>{formatCurrency(item.amount)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: item.status === 'paid' ? `${theme.success}20` : `${theme.accent}20` }]}>
                      <Text style={[styles.statusText, { color: item.status === 'paid' ? theme.success : theme.accent }]}>
                        {item.status === 'paid' ? 'Paid' : 'Issued'}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            </FadeInView>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="document-text-outline" size={32} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Invoices Yet</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>Create your first invoice to get paid for your work.</Text>
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
  headerTitle: { fontSize: 18, fontWeight: '800' },
  listContent: { padding: 20, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, marginBottom: 12 },
  clientName: { fontSize: 15, fontWeight: '700' },
  date: { fontSize: 12, marginTop: 3 },
  amount: { fontSize: 15, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginTop: 6 },
  statusText: { fontSize: 10, fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center' },
});
