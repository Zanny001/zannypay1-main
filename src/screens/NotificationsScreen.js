import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { formatDate } from '../utils/format';
import {
  buildNotificationFeed,
  getReadIds,
  markAllRead,
  fetchServerNotifications,
  markServerNotificationsRead,
  getUnreadCountsByCategory,
} from '../utils/notifications';
import Card from '../components/Card';
import FadeInView from '../components/FadeInView';

const TABS = [
  { key: 'payments', label: 'Payments', icon: 'wallet' },
  { key: 'messages', label: 'Messages', icon: 'chatbubbles' },
];

export default function NotificationsScreen({ navigation }) {
  const { theme } = useTheme();
  const { transactions } = useWallet();
  const [activeTab, setActiveTab] = useState('payments');
  const [feed, setFeed] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [counts, setCounts] = useState({ payments: 0, messages: 0 });

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const serverNotifications = await fetchServerNotifications();
        const built = buildNotificationFeed(transactions, serverNotifications);
        const currentReadIds = await getReadIds();
        const currentCounts = await getUnreadCountsByCategory(transactions, serverNotifications);
        setFeed(built);
        setReadIds(currentReadIds);
        setCounts(currentCounts);

        // Mark everything currently visible as read once the user opens the
        // center — locally for transaction/system items, on the backend for
        // real events (KYC/dispute/freeze/chat), so the dashboard badge
        // clears for both. Marking happens regardless of which tab is
        // active — opening the center at all is the signal, same as before.
        const localIds = built.filter((n) => !n.serverId).map((n) => n.id);
        const merged = Array.from(new Set([...currentReadIds, ...localIds]));
        await markAllRead(merged);
        if (serverNotifications.length > 0) await markServerNotificationsRead();
      };
      load();
    }, [transactions])
  );

  const handlePress = (item) => {
    if (item.txn) {
      navigation.navigate('TransactionDetail', { txn: item.txn });
    } else if (item.type === 'chat_reply') {
      navigation.navigate('SupportChat');
    } else if (item.type === 'kyc_approved' || item.type === 'kyc_rejected') {
      navigation.navigate('KYC');
    } else if (item.type === 'dispute_resolved') {
      navigation.navigate('Disputes');
    }
  };

  const visibleFeed = feed.filter((n) => n.category === activeTab);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key] || 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, { backgroundColor: theme.surface, borderColor: isActive ? theme.primary : theme.border }]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name={tab.icon} size={16} color={isActive ? theme.primary : theme.textMuted} />
                <Text style={[styles.tabLabel, { color: isActive ? theme.primary : theme.textMuted }]}>{tab.label}</Text>
              </View>
              {count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: theme.danger }]}>
                  <Text style={styles.tabBadgeText}>{count > 99 ? '99+' : count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={visibleFeed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const wasUnread = item.serverId ? !item.serverRead : !readIds.includes(item.id);
          const isPressable = !!(item.txn || item.type === 'chat_reply' || item.type === 'kyc_approved' || item.type === 'kyc_rejected' || item.type === 'dispute_resolved');
          return (
            <FadeInView index={index}>
              <TouchableOpacity activeOpacity={isPressable ? 0.7 : 1} onPress={() => handlePress(item)}>
                <Card style={styles.row}>
                  <View style={[styles.iconWrap, { backgroundColor: theme.surfaceAlt }]}>
                    <Ionicons name={item.icon} size={20} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
                      {wasUnread && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
                    </View>
                    <Text style={[styles.body, { color: theme.textMuted }]} numberOfLines={2}>{item.body}</Text>
                    {!!item.timestamp && <Text style={[styles.time, { color: theme.textMuted }]}>{formatDate(item.timestamp)}</Text>}
                  </View>
                </Card>
              </TouchableOpacity>
            </FadeInView>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name={activeTab === 'payments' ? 'wallet-outline' : 'chatbubbles-outline'} size={32} color={theme.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>You're all caught up</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              {activeTab === 'payments'
                ? 'Transaction and account alerts will show up here.'
                : 'Tips and updates from ZannyPay will show up here.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 6 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1.5 },
  tabLabel: { fontSize: 13, fontWeight: '700', marginLeft: 6 },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginLeft: 6, paddingHorizontal: 4 },
  tabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  listContent: { padding: 20, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, marginBottom: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700' },
  unreadDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 8 },
  body: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  time: { fontSize: 11, marginTop: 6 },
  emptyStateContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center' },
});
