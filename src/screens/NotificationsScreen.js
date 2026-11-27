import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
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
  { key: 'payments', label: 'Payments', icon: 'wallet-outline' },
  { key: 'messages', label: 'Messages', icon: 'chatbubbles-outline' },
];

const getDestination = (item) => {
  if (item.txn) return { name: 'TransactionDetail', params: { txn: item.txn } };
  switch (item.type) {
    case 'chat_reply':
      return { name: 'SupportChat' };
    case 'kyc_approved':
    case 'kyc_rejected':
      return { name: 'KYC' };
    case 'dispute_resolved':
      return { name: 'Disputes' };
    case 'card_frozen':
    case 'card_funded':
      return { name: 'Cards' };
    case 'recurring_transfer_sent':
    case 'recurring_transfer_failed':
    case 'recurring_transfer_paused':
      return { name: 'RecurringTransfers' };
    case 'transfer_sent':
    case 'transfer_received':
    case 'bill_paid':
    case 'airtime_purchased':
    case 'transaction_reversed':
      return { name: 'History' };
    case 'account_frozen':
    case 'account_unfrozen':
    case 'fraud_alert':
      return { name: 'Security' };
    default:
      return null;
  }
};

export default function NotificationsScreen({ navigation }) {
  const { theme } = useTheme();
  const { transactions = [] } = useWallet();
  const [activeTab, setActiveTab] = useState('payments');
  const [feed, setFeed] = useState([]);
  const [readIds, setReadIds] = useState([]);
  const [counts, setCounts] = useState({ payments: 0, messages: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serverError, setServerError] = useState('');

  const loadNotifications = useCallback(async ({ pullToRefresh = false } = {}) => {
    if (pullToRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [serverNotifications, currentReadIds] = await Promise.all([
        fetchServerNotifications(),
        getReadIds(),
      ]);
      const built = buildNotificationFeed(transactions, serverNotifications);
      const currentCounts = await getUnreadCountsByCategory(transactions, serverNotifications);
      setFeed(built);
      setReadIds(currentReadIds);
      setCounts(currentCounts);
      setServerError('');
    } catch (error) {
      // Keep transaction-derived and locally stored messages visible, but
      // never disguise an API outage as a genuinely empty inbox.
      const currentReadIds = await getReadIds();
      setFeed(buildNotificationFeed(transactions, []));
      setReadIds(currentReadIds);
      const currentCounts = await getUnreadCountsByCategory(transactions, []);
      setCounts(currentCounts);
      setServerError(error?.message || 'We could not load live notifications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [transactions]);

  useFocusEffect(
    useCallback(() => {
      loadNotifications().catch(() => {});
    }, [loadNotifications])
  );

  const refresh = useCallback(() => {
    loadNotifications({ pullToRefresh: true });
  }, [loadNotifications]);

  const markItemRead = useCallback(async (item) => {
    if (item.serverId) {
      if (item.serverRead) return true;
      const saved = await markServerNotificationsRead([item.serverId]);
      if (!saved) {
        Alert.alert('Could not update notification', 'Please check your connection and try again.');
        return false;
      }
      setFeed((current) => current.map((entry) =>
        entry.id === item.id ? { ...entry, serverRead: true } : entry
      ));
    } else if (!readIds.includes(item.id)) {
      const next = [...readIds, item.id];
      await markAllRead(next);
      setReadIds(next);
    }
    setCounts(await getUnreadCountsByCategory(
      transactions,
      feed.filter((entry) => entry.serverId).map((entry) =>
        entry.id === item.id ? { ...entry, serverRead: true } : entry
      ),
    ));
    return true;
  }, [feed, readIds, transactions]);

  const handlePress = useCallback(async (item) => {
    const marked = await markItemRead(item);
    if (!marked) return;
    const destination = getDestination(item);
    if (destination) navigation.navigate(destination.name, destination.params);
  }, [markItemRead, navigation]);

  const markVisibleRead = useCallback(async () => {
    const visible = feed.filter((item) => item.category === activeTab);
    const unreadServerIds = visible
      .filter((item) => item.serverId && !item.serverRead)
      .map((item) => item.serverId);
    const localIds = visible
      .filter((item) => !item.serverId)
      .map((item) => item.id);

    const serverSaved = await markServerNotificationsRead(unreadServerIds);
    const nextReadIds = Array.from(new Set([...readIds, ...localIds]));
    await markAllRead(nextReadIds);
    setReadIds(nextReadIds);
    setFeed((current) => current.map((item) =>
      item.category === activeTab && (!item.serverId || serverSaved)
        ? { ...item, serverRead: item.serverId ? true : item.serverRead }
        : item
    ));
    if (!serverSaved && unreadServerIds.length > 0) {
      Alert.alert('Some notifications remain unread', 'We could not update the server. Refresh and try again.');
    }
    const updatedServerFeed = feed
      .filter((item) => item.serverId)
      .map((item) => item.category === activeTab && serverSaved ? { ...item, serverRead: true } : item);
    setCounts(await getUnreadCountsByCategory(transactions, updatedServerFeed));
  }, [activeTab, feed, readIds, transactions]);

  const visibleFeed = feed.filter((item) => item.category === activeTab);
  const activeUnreadCount = counts[activeTab] || 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={23} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Notifications</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>Your account activity and updates</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="notifications" size={19} color={theme.primary} />
        </View>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key] || 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? theme.primary : theme.surface,
                  borderColor: isActive ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.82}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Ionicons name={tab.icon} size={17} color={isActive ? '#FFFFFF' : theme.textMuted} />
              <Text style={[styles.tabLabel, { color: isActive ? '#FFFFFF' : theme.textMuted }]}>{tab.label}</Text>
              {count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: isActive ? '#FFFFFF' : theme.danger }]}>
                  <Text style={[styles.tabBadgeText, { color: isActive ? theme.primary : '#FFFFFF' }]}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.actionsRow}>
        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
          {activeTab === 'payments' ? 'ACCOUNT ACTIVITY' : 'UPDATES & MESSAGES'}
        </Text>
        {activeUnreadCount > 0 && (
          <TouchableOpacity onPress={markVisibleRead} activeOpacity={0.7} accessibilityRole="button">
            <Text style={[styles.markAllText, { color: theme.primary }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!serverError && (
        <View style={[styles.errorBanner, { backgroundColor: theme.danger + '14', borderColor: theme.danger + '40' }]}>
          <Ionicons name="cloud-offline-outline" size={18} color={theme.danger} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.errorTitle, { color: theme.danger }]}>Live notifications unavailable</Text>
            <Text style={[styles.errorText, { color: theme.textMuted }]}>{serverError}</Text>
          </View>
          <TouchableOpacity onPress={refresh} accessibilityRole="button" accessibilityLabel="Retry loading notifications">
            <Ionicons name="refresh" size={20} color={theme.danger} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={visibleFeed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
        renderItem={({ item, index }) => {
          const isUnread = item.serverId ? !item.serverRead : !readIds.includes(item.id);
          const destination = getDestination(item);
          return (
            <FadeInView index={index}>
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => handlePress(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${isUnread ? 'Unread.' : 'Read.'} ${destination ? 'Open details.' : 'Mark as read.'}`}
              >
                <Card style={[
                  styles.row,
                  {
                    backgroundColor: theme.surface,
                    borderColor: isUnread ? theme.primary + '55' : theme.border,
                  },
                ]}>
                  <View style={[
                    styles.iconWrap,
                    { backgroundColor: isUnread ? theme.primary + '18' : theme.surfaceAlt },
                  ]}>
                    <Ionicons name={item.icon || 'notifications-outline'} size={21} color={theme.primary} />
                  </View>
                  <View style={styles.itemContent}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.title, { color: theme.text, fontWeight: isUnread ? '800' : '600' }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      {isUnread && <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />}
                    </View>
                    <Text style={[styles.body, { color: theme.textMuted }]} numberOfLines={3}>{item.body}</Text>
                    {!!item.timestamp && (
                      <Text style={[styles.time, { color: theme.textMuted }]}>{formatDate(item.timestamp)}</Text>
                    )}
                  </View>
                  {destination ? (
                    <Ionicons name="chevron-forward" size={17} color={theme.textMuted} style={styles.chevron} />
                  ) : isUnread ? (
                    <View style={[styles.unreadPill, { backgroundColor: theme.primary + '16' }]}>
                      <Text style={[styles.unreadPillText, { color: theme.primary }]}>NEW</Text>
                    </View>
                  ) : null}
                </Card>
              </TouchableOpacity>
            </FadeInView>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: theme.surface }]}>
              <Ionicons
                name={serverError ? 'cloud-offline-outline' : activeTab === 'payments' ? 'wallet-outline' : 'chatbubbles-outline'}
                size={30}
                color={theme.primary}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {loading ? 'Loading notifications' : serverError ? 'We could not reach your inbox' : "You're all caught up"}
            </Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              {loading
                ? 'Please wait while we check for updates.'
                : serverError
                  ? 'Pull down to retry. Your locally available activity is still shown when possible.'
                  : activeTab === 'payments'
                    ? 'Transaction and account alerts will appear here.'
                    : 'Important tips and support updates will appear here.'}
            </Text>
            {loading && <ActivityIndicator color={theme.primary} style={{ marginTop: 18 }} />}
            {!!serverError && (
              <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.primary }]} onPress={refresh}>
                <Text style={styles.retryButtonText}>Try again</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  backBtn: { width: 40, height: 42, justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  headerSubtitle: { fontSize: 11.5, marginTop: 3 },
  headerIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(32,201,243,0.12)' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 17 },
  tab: { flex: 1, minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 14, borderWidth: 1 },
  tabLabel: { fontSize: 12.5, fontWeight: '700', marginLeft: 7 },
  tabBadge: { minWidth: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: 7, paddingHorizontal: 4 },
  tabBadgeText: { fontSize: 10, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, marginBottom: 11 },
  sectionLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  markAllText: { fontSize: 12, fontWeight: '800' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 13, borderWidth: 1 },
  errorTitle: { fontSize: 12, fontWeight: '800' },
  errorText: { fontSize: 10.5, marginTop: 3, lineHeight: 15 },
  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 10, borderRadius: 17, borderWidth: 1 },
  iconWrap: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemContent: { flex: 1, marginLeft: 12, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 13.5, flex: 1, lineHeight: 19 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, marginLeft: 7 },
  body: { fontSize: 11.5, marginTop: 4, lineHeight: 17 },
  time: { fontSize: 10.5, marginTop: 7 },
  chevron: { marginLeft: 7 },
  unreadPill: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, marginLeft: 7 },
  unreadPillText: { fontSize: 8.5, fontWeight: '900', letterSpacing: 0.5 },
  emptyStateContainer: { alignItems: 'center', marginTop: 54, paddingHorizontal: 28 },
  emptyIconWrap: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 7, textAlign: 'center' },
  emptySub: { fontSize: 12, textAlign: 'center', lineHeight: 19 },
  retryButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 16 },
  retryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
