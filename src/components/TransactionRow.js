import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency, formatDate } from '../utils/format';
import PressableScale from './PressableScale';

export default function TransactionRow({ txn }) {
  const navigation = useNavigation();
  const { theme } = useTheme();
  
  const isCredit = txn.type === 'credit';
  const isInvoice = txn.type === 'invoice';
  const transactionTimestamp = txn.createdAt || txn.date;
  const rawStatus = String(txn.status || 'pending').toLowerCase();
  const status = ['success', 'successful', 'completed', 'paid'].includes(rawStatus) ? 'Successful' : ['failed', 'reversed', 'cancelled', 'canceled'].includes(rawStatus) ? 'Failed' : 'Pending';
  const statusColor = status === 'Successful' ? theme.success : status === 'Failed' ? theme.danger : '#F5A623';

  return (
    <PressableScale
      style={[styles.row, { borderBottomColor: theme.border }]}
      onPress={() => navigation.navigate('TransactionDetail', { txn })}
      activeScale={0.98}
    >
      <View style={[styles.iconWrap, { backgroundColor: isInvoice ? `${theme.info}20` : isCredit ? `${theme.success}20` : `${theme.primary}20` }]}>
        <Ionicons 
          name={isInvoice ? 'document-text' : isCredit ? 'arrow-down-circle' : 'arrow-up-circle'} 
          size={22} 
          color={isInvoice ? theme.info : isCredit ? theme.success : theme.primary} 
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{txn.title || txn.category || "Transaction"}</Text>
        {!!txn.subtitle && <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>{txn.subtitle}</Text>}
        <View style={styles.metaRow}><Text style={[styles.date, { color: theme.textMuted }]}>{formatDate(transactionTimestamp)}</Text><View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}><View style={[styles.statusDot, { backgroundColor: statusColor }]} /><Text style={[styles.statusText, { color: statusColor }]}>{status}</Text></View></View>
      </View>
      <Text style={[styles.amount, { color: isInvoice ? '#00D2FF' : isCredit ? theme.success : theme.text }]}>
        {isInvoice ? '' : isCredit ? '+' : '-'}{formatCurrency(txn.amount)}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 12, marginTop: 2 },
  date: { fontSize: 11, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, gap: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '800' },
  amount: { fontSize: 15, fontWeight: '700', marginLeft: 8 },
});
