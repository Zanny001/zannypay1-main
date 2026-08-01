import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { formatDate } from '../utils/format';
import FadeInView from '../components/FadeInView';

const STATUS_META = {
  open: { label: 'Open', icon: 'time-outline' },
  under_review: { label: 'Under Review', icon: 'search-outline' },
  resolved: { label: 'Resolved', icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rejected', icon: 'close-circle-outline' },
};

export default function DisputesScreen({ navigation }) {
  const { theme } = useTheme();
  const { disputes, syncWallet } = useWallet();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      syncWallet();
    }, [syncWallet])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await syncWallet();
    setRefreshing(false);
  };

  const statusColor = (status) => {
    if (status === 'resolved') return theme.success;
    if (status === 'rejected') return theme.danger;
    if (status === 'under_review') return theme.info;
    return theme.warning;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>My Disputes</Text>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={disputes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const meta = STATUS_META[item.status] || STATUS_META.open;
          const color = statusColor(item.status);
          return (
            <FadeInView delay={index * 40}>
              <View style={[styles.card, { backgroundColor: theme.surface }]}>
                <View style={styles.cardTopRow}>
                  <Text style={[styles.reason, { color: theme.text }]} numberOfLines={1}>{item.reason}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${color}20` }]}>
                    <Ionicons name={meta.icon} size={13} color={color} />
                    <Text style={[styles.statusText, { color }]}>{meta.label}</Text>
                  </View>
                </View>
                {!!item.details && <Text style={[styles.details, { color: theme.textMuted }]} numberOfLines={2}>{item.details}</Text>}
                <Text style={[styles.date, { color: theme.textMuted }]}>Filed {formatDate(item.createdAt)}</Text>
              </View>
            </FadeInView>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.surface }]}>
              <Ionicons name="shield-outline" size={32} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Disputes Filed</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              If something looks wrong with a transaction, you can raise a dispute from its receipt.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  listContent: { padding: 20, flexGrow: 1 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reason: { fontSize: 14, fontWeight: '700', flex: 1, marginRight: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700', marginLeft: 4 },
  details: { fontSize: 12, marginBottom: 8, lineHeight: 17 },
  date: { fontSize: 11 },
  emptyStateContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
