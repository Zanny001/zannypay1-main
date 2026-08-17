import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, RefreshControl, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { useTheme } from '../context/ThemeContext';
import { formatCurrency, maskAccount, formatDate } from '../utils/format';
import { useWallet } from '../context/WalletContext';
import { getUnreadCount } from '../utils/notifications';
import TransactionRow from '../components/TransactionRow';
import FundModal from '../components/FundModal';
import Avatar from '../components/Avatar';
import Skeleton from '../components/Skeleton';
import AnimatedNumber from '../components/AnimatedNumber';
import PressableScale from '../components/PressableScale';

// Primary 8-Item Grid
const QUICK_ACTIONS = [
  { key: 'Transfer', icon: 'swap-horizontal', label: 'Transfer' },
  { key: 'Airtime', icon: 'phone-portrait-outline', label: 'Airtime' },
  { key: 'Bills', icon: 'receipt-outline', label: 'Bills' },
  { key: 'Cards', icon: 'card-outline', label: 'Cards' },
  { key: 'Fund', icon: 'add-circle-outline', label: 'Fund Wallet' },
  { key: 'Invoice', icon: 'document-text-outline', label: 'Invoices' },
  { key: 'Beneficiaries', icon: 'people-outline', label: 'Recipients' },
  { key: 'More', icon: 'grid-outline', label: 'More' },
];

// Expanded Menu Items
const MORE_ACTIONS = [
  { key: 'QRPay', icon: 'qr-code-outline', label: 'QR Pay' },
  { key: 'Insights', icon: 'pie-chart-outline', label: 'Analytics' },
  { key: 'Support', icon: 'help-buoy-outline', label: 'Support' },
];

export default function DashboardScreen({ navigation }) {
  const { theme } = useTheme();
  const { user, balance, transactions, syncWallet, isBalanceHidden, toggleBalanceHidden, loading, fetchRecurringTransfers } = useWallet();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [fundModalVisible, setFundModalVisible] = useState(false);
  const [moreModalVisible, setMoreModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [upcomingTransfers, setUpcomingTransfers] = useState([]);

  useFocusEffect(
    useCallback(() => {
      getUnreadCount(transactions).then(setUnreadCount);
    }, [transactions])
  );

  // Master audit / continuation request: nowhere on the dashboard
  // surfaced "you have a recurring transfer coming up" — a user had to
  // remember to check the dedicated Recurring Transfers screen on their
  // own. Shows at most the next 3 active ones, soonest first.
  useFocusEffect(
    useCallback(() => {
      fetchRecurringTransfers().then((res) => {
        if (!res.ok) return;
        const upcoming = (res.data || [])
          .filter((rt) => rt.status === 'active' && rt.nextRunAt)
          .sort((a, b) => new Date(a.nextRunAt) - new Date(b.nextRunAt))
          .slice(0, 3);
        setUpcomingTransfers(upcoming);
      });
    }, [fetchRecurringTransfers])
  );

  const handleQuickAction = (key) => {
    if (key === 'Fund') return setFundModalVisible(true);
    if (key === 'More') return setMoreModalVisible(true);
    navigation.navigate(key);
  };

  const handleMoreAction = (key) => {
    setMoreModalVisible(false);
    navigation.navigate(key);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await syncWallet();
    setRefreshing(false);
  };

  // Only on the very first load — WalletContext's `loading` flag is true
  // until the initial fetch resolves, then stays false on refresh/pull-to-
  // refresh, so this never re-flashes over real content.
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={{ padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <Skeleton width={44} height={44} radius={22} />
            <View style={{ marginLeft: 12 }}>
              <Skeleton width={120} height={12} style={{ marginBottom: 8 }} />
              <Skeleton width={80} height={10} />
            </View>
          </View>
          <Skeleton width="100%" height={140} radius={20} style={{ marginBottom: 24 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ alignItems: 'center' }}>
                <Skeleton width={52} height={52} radius={26} style={{ marginBottom: 8 }} />
                <Skeleton width={40} height={9} />
              </View>
            ))}
          </View>
          <Skeleton width={140} height={14} style={{ marginBottom: 16 }} />
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
              <Skeleton width={40} height={40} radius={20} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Skeleton width="60%" height={12} style={{ marginBottom: 6 }} />
                <Skeleton width="35%" height={10} />
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.userInfoRow}>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              <Avatar uri={user?.profileImage} name={user?.name} size={44} />
            </TouchableOpacity>
            <View style={{ marginLeft: 12 }}>
              <Text style={[styles.hello, { color: theme.text }]}>Hi, {user?.name?.split(' ')[0] || 'there'} 👋</Text>
              <Text style={[styles.account, { color: theme.textMuted }]}>{maskAccount(user?.accountNumber || user?.phone || '0000')}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <View style={[styles.focusToggleWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[styles.focusLabel, { color: theme.textMuted }]}>Focus</Text>
              <Switch
                value={isFocusMode}
                onValueChange={setIsFocusMode}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={'#fff'}
                style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
              />
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={[styles.bellBtn, { backgroundColor: theme.surface }]}>
              <Ionicons name="notifications-outline" size={22} color={theme.text} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {user?.isFrozen && (
          <View style={[styles.frozenBanner, { backgroundColor: `${theme.danger}18` }]}>
            <Ionicons name="lock-closed" size={18} color={theme.danger} />
            <Text style={[styles.frozenBannerText, { color: theme.danger }]}>
              Your account is restricted. Contact support to resolve this.
            </Text>
          </View>
        )}

        {/* BALANCE CARD */}
        <LinearGradient colors={['#2A1F45', '#1A1525']} style={styles.balanceCard}>
          <View style={styles.balanceTopRow}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <TouchableOpacity onPress={toggleBalanceHidden} style={styles.eyeIconWrap}>
              <Ionicons name={isBalanceHidden ? 'eye-off' : 'eye'} size={18} color="#A09CAB" />
            </TouchableOpacity>
          </View>
          <AnimatedNumber
            value={balance}
            hidden={isBalanceHidden}
            format={(n) => formatCurrency(n)}
            style={styles.balanceValue}
          />
          <View style={styles.cardBottomRow}>
            <TouchableOpacity style={styles.fundBtn} onPress={() => setFundModalVisible(true)}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.fundBtnText}>Add Money</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.transferBtn} onPress={() => navigation.navigate('Transfer')}>
              <Text style={styles.transferBtnText}>Transfer</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* QUICK ACTIONS GRID */}
        {!isFocusMode && (
          <View style={styles.gridContainer}>
            {QUICK_ACTIONS.map((action) => (
              <PressableScale key={action.key} style={styles.gridItem} onPress={() => handleQuickAction(action.key)}>
                <View style={[styles.gridIconWrap, { backgroundColor: theme.surface }]}>
                  <Ionicons name={action.icon} size={24} color={theme.primary} />
                </View>
                <Text style={[styles.gridLabel, { color: theme.text }]}>{action.label}</Text>
              </PressableScale>
            ))}
          </View>
        )}

        {/* UPCOMING RECURRING TRANSFERS */}
        {upcomingTransfers.length > 0 && !isFocusMode && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Upcoming Transfers</Text>
              <TouchableOpacity onPress={() => navigation.navigate('RecurringTransfers')}>
                <Text style={[styles.seeAll, { color: theme.primary }]}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
              {upcomingTransfers.map((rt) => (
                <TouchableOpacity
                  key={rt.id}
                  style={[styles.upcomingRow, { backgroundColor: theme.surface }]}
                  onPress={() => navigation.navigate('RecurringTransfers')}
                >
                  <View style={[styles.upcomingIconWrap, { backgroundColor: theme.background }]}>
                    <Ionicons name="repeat" size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.upcomingName, { color: theme.text }]}>{rt.recipientName}</Text>
                    <Text style={[styles.upcomingDate, { color: theme.textMuted }]}>Next: {formatDate(rt.nextRunAt)}</Text>
                  </View>
                  <Text style={[styles.upcomingAmount, { color: theme.text }]}>{formatCurrency(rt.amount)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* RECENT ACTIVITY */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
          {!isFocusMode && (
            <TouchableOpacity onPress={() => navigation.navigate('History')}>
              <Text style={[styles.seeAll, { color: theme.primary }]}>See all</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ marginHorizontal: 20, backgroundColor: theme.surface, borderRadius: 16, overflow: 'hidden', paddingBottom: transactions?.length === 0 ? 0 : 10 }}>
          {transactions?.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.background }]}>
                <Ionicons name="wallet-outline" size={32} color={theme.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Transactions Yet</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>Your financial journey starts here.</Text>
            </View>
          ) : (
            transactions?.slice(0, isFocusMode ? 10 : 5).map((txn) => (
              <TransactionRow key={txn.id} txn={txn} />
            ))
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* FUND MODAL */}
      <FundModal visible={fundModalVisible} onClose={() => setFundModalVisible(false)} />

      {/* MORE SERVICES MODAL */}
      <Modal visible={moreModalVisible} animationType="slide" transparent={true} onRequestClose={() => setMoreModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>All Services</Text>
              <TouchableOpacity onPress={() => setMoreModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.gridContainer}>
              {MORE_ACTIONS.map((action) => (
                <TouchableOpacity key={action.key} style={styles.gridItem} onPress={() => handleMoreAction(action.key)}>
                  <View style={[styles.gridIconWrap, { backgroundColor: theme.surface }]}>
                    <Ionicons name={action.icon} size={24} color={theme.primary} />
                  </View>
                  <Text style={[styles.gridLabel, { color: theme.text }]}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <SafeAreaView edges={['bottom']} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  userInfoRow: { flexDirection: 'row', alignItems: 'center' },
  hello: { fontSize: 16, fontWeight: '700', fontFamily: fonts.bold },
  account: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  focusToggleWrap: { flexDirection: 'row', alignItems: 'center', marginRight: 12, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  focusLabel: { fontSize: 11, fontWeight: '700', marginLeft: 4 },
  bellBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: 0, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  frozenBanner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16, padding: 14, borderRadius: 14 },
  frozenBannerText: { fontSize: 12, fontWeight: '700', marginLeft: 10, flex: 1 },
  balanceCard: { marginHorizontal: 20, borderRadius: 24, padding: 24, marginBottom: 25 },
  balanceTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { color: '#A09CAB', fontSize: 13, fontWeight: '600' },
  eyeIconWrap: { padding: 4 },
  balanceValue: { color: '#fff', fontSize: 34, fontWeight: '800', fontFamily: fonts.extraBold, marginTop: 8, marginBottom: 20 },
  cardBottomRow: { flexDirection: 'row', gap: 12 },
  fundBtn: { flex: 1, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  fundBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 6 },
  transferBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  transferBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, marginBottom: 20 },
  gridItem: { width: '25%', alignItems: 'center', marginBottom: 20 },
  gridIconWrap: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  gridLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  seeAll: { fontSize: 13, fontWeight: '600' },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 10 },
  upcomingIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  upcomingName: { fontSize: 14, fontWeight: '600' },
  upcomingDate: { fontSize: 11, marginTop: 2 },
  upcomingAmount: { fontSize: 14, fontWeight: '700' },
  emptyStateContainer: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, minHeight: 300 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
});
