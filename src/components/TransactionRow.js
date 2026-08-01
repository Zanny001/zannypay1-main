import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency, formatDate } from '../utils/format';
import PressableScale from './PressableScale';
import FadeInView from './FadeInView';

// Same data contract as before (`txn` + navigate to TransactionDetail).
// Pass an optional `index` and the row slides in as part of a staggered list.
export default function TransactionRow({ txn, index }) {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const isCredit = txn.type === 'credit';
  const isInvoice = txn.type === 'invoice';
  const transactionTimestamp = txn.createdAt || txn.date;

  return (
    <FadeInView index={index} distance={12} stagger={45}>
      <PressableScale
        style={[styles.row, { borderBottomColor: theme.border }]}
        onPress={() => navigation.navigate('TransactionDetail', { txn })}
        activeScale={0.985}
        dim={false}
      >
        <View style={[styles.iconWrap, { backgroundColor: isInvoice ? '#00A3E020' : isCredit ? '#00E67620' : '#6236FF20' }]}>
          <Ionicons
            name={isInvoice ? 'document-text' : isCredit ? 'arrow-down-circle' : 'arrow-up-circle'}
            size={22}
            color={isInvoice ? '#00D2FF' : isCredit ? theme.success : theme.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{txn.title}</Text>
          {!!txn.subtitle && <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>{txn.subtitle}</Text>}
          <Text style={[styles.date, { color: theme.textMuted }]}>{formatDate(transactionTimestamp)}</Text>
        </View>
        <Text style={[styles.amount, { color: isInvoice ? '#00D2FF' : isCredit ? theme.success : theme.text }]}>
          {isInvoice ? '' : isCredit ? '+' : '-'}{formatCurrency(txn.amount)}
        </Text>
      </PressableScale>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 12, marginTop: 2 },
  date: { fontSize: 11, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700', marginLeft: 8 },
});
