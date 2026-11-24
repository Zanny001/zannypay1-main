import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  FlatList,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import GradientButton from '../components/GradientButton';
import SuccessModal from '../components/SuccessModal';
import { colors } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { formatCurrency, formatDate } from '../utils/format';
import { useAlert } from '../context/AlertContext';
import { apiGet } from '../services/apiClient';

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

export default function TransferScreen({ navigation, route }) {
  const { alert } = useAlert();
  const { theme } = useTheme();
  const { balance, transferMoney, transactions, resolveRecipient, beneficiaries, fetchBeneficiaries } = useWallet();

  // 'bank' = external transfer, 'zanny' = internal ZannyPay-to-ZannyPay transfer
  const [tab, setTab] = useState('bank');
  const [subTab, setSubTab] = useState('recent');

  const [account, setAccount] = useState('');
  const [bank, setBank] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [banks, setBanks] = useState([]);
  const [bankLookupError, setBankLookupError] = useState(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pin, setPin] = useState('');

  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null); // { message, txn } while the success modal is shown
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef(null);
  const amountInputRef = useRef(null);

  // Animated tab underline
  const tabAnim = useRef(new Animated.Value(0)).current;
  // Animated fade for whichever list (recent/saved) is showing
  const listFade = useRef(new Animated.Value(1)).current;

  // Real saved recipients (from the backend-persisted Beneficiary model —
  // see WalletContext) and real recent transfers (derived from actual
  // transaction history). This used to read its own separate local copy
  // straight out of AsyncStorage, which drifted out of sync the moment
  // BeneficiariesScreen moved onto the backend API — now it shares the
  // exact same `beneficiaries` the rest of the app uses, so adding or
  // removing a recipient anywhere is reflected here immediately too.
  const [resolvedRecipient, setResolvedRecipient] = useState(null);
  const [resolving, setResolving] = useState(false);
  const resolveDebounceRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      fetchBeneficiaries();
    }, [fetchBeneficiaries])
  );

  const recentTransfers = useMemo(() => {
    const transferTxns = (transactions || []).filter(
      (t) => t.type === 'debit' && (t.category || '').toLowerCase() === 'transfer' && t.recipientAccount
    );
    const seen = new Set();
    const items = [];
    for (const t of transferTxns) {
      if (seen.has(t.recipientAccount)) continue;
      seen.add(t.recipientAccount);
      items.push({
        id: t.id,
        name: (t.title || '').replace(/^Transfer to /, ''),
        acc: t.recipientAccount,
        bank: t.bank || null,
        date: formatDate(t.createdAt).split(' · ')[0],
      });
      if (items.length >= 6) break;
    }
    return items;
  }, [transactions]);

  // Load the authoritative Nigerian bank directory from Paystack. Bank
  // codes are provider identifiers; display labels must never be used as
  // substitutes when resolving an account.
  useEffect(() => {
    let active = true;
    apiGet('/wallet/banks')
      .then((response) => {
        if (active) setBanks(Array.isArray(response?.banks) ? response.banks : []);
      })
      .catch((error) => {
        if (active) setBankLookupError(error.message || 'Bank directory unavailable.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!bank || bankCode || !banks.length) return;
    const match = banks.find((item) => item.name.toLowerCase() === bank.toLowerCase());
    if (match) setBankCode(match.code);
  }, [bank, bankCode, banks]);

  // Resolve the destination name through Paystack for external bank
  // accounts. Internal ZannyPay recipients continue using the user lookup.
  // A transfer must not proceed to a bank unless this verification succeeds.
  useEffect(() => {
    let active = true;
    setResolvedRecipient(null);
    setBankLookupError(null);
    setResolving(false);
    if (resolveDebounceRef.current) clearTimeout(resolveDebounceRef.current);

    const cleaned = (account || '').trim();
    if (tab === 'bank') {
      if (cleaned.length !== 10 || !bankCode) return () => { active = false; };
      resolveDebounceRef.current = setTimeout(async () => {
        if (active) setResolving(true);
        try {
          const result = await apiGet(
            `/wallet/resolve-bank-account?accountNumber=${encodeURIComponent(cleaned)}&bankCode=${encodeURIComponent(bankCode)}`,
          );
          if (active) {
            setResolvedRecipient({
              name: result.accountName,
              accountNumber: result.accountNumber,
              bankName: result.bankName,
              verified: result.verified === true,
            });
          }
        } catch (error) {
          if (active) setBankLookupError(error.message || 'Could not verify this bank account.');
        } finally {
          if (active) setResolving(false);
        }
      }, 500);
    } else {
      if (cleaned.length < 10) return () => { active = false; };
      resolveDebounceRef.current = setTimeout(async () => {
        if (active) setResolving(true);
        try {
          const result = await resolveRecipient(cleaned);
          if (active && result.ok) setResolvedRecipient(result.recipient);
        } finally {
          if (active) setResolving(false);
        }
      }, 500);
    }

    return () => {
      active = false;
      clearTimeout(resolveDebounceRef.current);
    };
  }, [account, bankCode, tab, resolveRecipient]);

  useEffect(() => {
    Animated.spring(tabAnim, {
      toValue: tab === 'bank' ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [tab, tabAnim]);

  useEffect(() => {
    listFade.setValue(0);
    Animated.timing(listFade, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [subTab, listFade]);

  useEffect(() => {
    const params = route?.params;
    if (params?.prefillAccount) {
      setAccount(params.prefillAccount);
      if (params.prefillBank) {
        setBank(params.prefillBank);
        setTab('bank');
      } else {
        setTab('zanny');
      }
    }
    // Used by the QR "Scan to Pay" flow — a requested-amount code (see
    // QRPayScreen's "My Code" tab) prefills the amount too, not just who
    // to pay, so scanning a code with a set price is genuinely one-tap
    // faster than a manual transfer.
    if (params?.prefillAmount) {
      setAmount(String(params.prefillAmount));
    }
  }, [route?.params]);

  const filteredBanks = banks.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const savedForCurrentTab = useMemo(() => {
    if (tab === 'zanny') return beneficiaries.filter((b) => !b.bank || b.bank === 'ZannyPay');
    return beneficiaries.filter((b) => b.bank && b.bank !== 'ZannyPay');
  }, [beneficiaries, tab]);

  const handleTabSwitch = (newTab) => {
    setTab(newTab);
    setSubTab('recent');
    if (newTab !== 'bank') setBankCode('');
  };

  const focusAmountField = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setTimeout(() => amountInputRef.current?.focus(), 300);
  };

  const handlePickRecent = (item) => {
    setTab(item.bank ? 'bank' : 'zanny');
    setAccount(item.acc);
    setBank(item.bank || '');
    setBankCode('');
    focusAmountField();
  };

  const handlePickSaved = (item) => {
    setTab(item.bank && item.bank !== 'ZannyPay' ? 'bank' : 'zanny');
    setAccount(item.accountNumber);
    setBank(item.bank && item.bank !== 'ZannyPay' ? item.bank : '');
    setBankCode('');
    focusAmountField();
  };

  const handleInitiateTransfer = () => {
    if (!account || !amount) {
      alert('Missing Info', 'Please enter an account number and amount.');
      return;
    }
    if (tab === 'bank' && !bank) {
      alert('Missing Info', 'Please select a destination bank.');
      return;
    }
    if (tab === 'bank' && (!resolvedRecipient?.verified || resolving)) {
      alert('Verify Account', 'Select a bank and enter a valid 10-digit account number. Wait for the account name to be confirmed before continuing.');
      return;
    }
    // Do not collect a transaction PIN or submit an external payout until
    // the backend has a verified disbursement provider. The account-name
    // lookup is live, but name resolution alone is not a money-transfer rail.
    if (tab === 'bank') {
      alert(
        'Bank Transfers Unavailable',
        'The recipient account can be verified, but outgoing bank transfers are not yet connected to a live payout provider. You can still send money to another ZannyPay account.',
      );
      return;
    }
    if (parseFloat(amount) > balance) {
      alert('Insufficient Funds', 'You do not have enough balance for this transfer.');
      return;
    }
    setShowPinModal(true);
  };

  const handleConfirmTransfer = async () => {
    if (pin.length !== 4) {
      alert('Invalid PIN', 'Please enter your 4-digit transaction PIN.');
      return;
    }

    setLoading(true);
    const res = await transferMoney({
      recipientAccount: account,
      bank: tab === 'zanny' ? 'ZannyPay' : bank,
      bankCode: tab === 'bank' ? bankCode : undefined,
      recipientName: resolvedRecipient?.name,
      amount,
      note,
      pin,
    });
    setLoading(false);
    setShowPinModal(false);
    setPin('');

    if (!res.ok) {
      alert('Transfer Failed', res.error);
      return;
    }

    setSuccessInfo({ message: `Sent ${formatCurrency(amount)} to ${account}.`, txn: res.txn });
  };

  const renderRecentItem = (item) => (
    <TouchableOpacity key={item.id} style={styles.contactItem} onPress={() => handlePickRecent(item)}>
      <View style={[styles.contactAvatar, { backgroundColor: theme.surfaceAlt }]}>
        <Text style={[styles.contactAvatarText, { color: theme.text }]}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.contactDetails, { color: theme.textMuted }]}>{item.acc}{item.bank ? `  •  ${item.bank}` : ''}</Text>
        {item.date ? <Text style={[styles.contactDate, { color: theme.textMuted }]}>Last transfer on {item.date}</Text> : null}
      </View>
      <MaterialCommunityIcons name="bank-transfer" size={18} color={theme.textMuted} />
    </TouchableOpacity>
  );

  const renderSavedItem = (item) => (
    <TouchableOpacity key={item.id} style={styles.contactItem} onPress={() => handlePickSaved(item)}>
      <View style={[styles.contactAvatar, { backgroundColor: theme.surfaceAlt }]}>
        <Text style={[styles.contactAvatarText, { color: theme.text }]}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: theme.text }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.contactDetails, { color: theme.textMuted }]}>{item.accountNumber}{item.bank ? `  •  ${item.bank}` : ''}</Text>
      </View>
      <Ionicons name="flash-outline" size={18} color={theme.primary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          {tab === 'bank' ? 'Transfer to Bank' : 'Transfer to ZannyPay'}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('History')}>
          <Ionicons name="receipt-outline" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Animated Tabs */}
      <View style={[styles.tabContainer, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.tabBtn} onPress={() => handleTabSwitch('bank')}>
          <Text style={[styles.tabText, { color: tab === 'bank' ? theme.primary : theme.textMuted }]}>To Bank</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabBtn} onPress={() => handleTabSwitch('zanny')}>
          <Text style={[styles.tabText, { color: tab === 'zanny' ? theme.primary : theme.textMuted }]}>To ZannyPay</Text>
        </TouchableOpacity>
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              backgroundColor: theme.primary,
              left: tabAnim.interpolate({ inputRange: [0, 1], outputRange: ['5%', '55%'] }),
            },
          ]}
        />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.balanceText, { color: theme.textMuted }]}>
          Available: <Text style={{ color: theme.success, fontWeight: '800' }}>{formatCurrency(balance)}</Text>
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>Account Number</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder={tab === 'bank' ? '0000000000' : 'Account No. or Phone No.'}
          placeholderTextColor={theme.textMuted}
          keyboardType="number-pad"
          value={account}
          onChangeText={(value) => {
            setResolvedRecipient(null);
            setBankLookupError(null);
            setAccount(value.replace(/\D/g, '').slice(0, tab === 'bank' ? 10 : 11));
          }}
          maxLength={tab === 'bank' ? 10 : 11}
        />

        {resolving && (
          <View style={styles.resolveBanner}>
            <ActivityIndicator size="small" color={theme.textMuted} />
            <Text style={[styles.resolveText, { color: theme.textMuted }]}>Looking up recipient…</Text>
          </View>
        )}
        {!resolving && bankLookupError && tab === 'bank' && (
          <View style={[styles.resolveBanner, { backgroundColor: `${theme.danger || '#dc2626'}15` }]}>
            <Ionicons name="alert-circle" size={16} color={theme.danger || '#dc2626'} />
            <Text style={[styles.resolveText, { color: theme.danger || '#dc2626' }]}>{bankLookupError}</Text>
          </View>
        )}
        {!resolving && resolvedRecipient?.verified === true && tab === 'bank' && (
          <View style={[styles.verifiedRecipientCard, { backgroundColor: theme.surface, borderColor: theme.success }]}>
            <View style={styles.verifiedRecipientHeader}>
              <Ionicons name="shield-checkmark" size={19} color={theme.success} />
              <Text style={[styles.verifiedRecipientEyebrow, { color: theme.success }]}>ACCOUNT NAME VERIFIED</Text>
            </View>
            <Text style={[styles.verifiedRecipientName, { color: theme.text }]}>{resolvedRecipient.name}</Text>
            <Text style={[styles.verifiedRecipientMeta, { color: theme.textMuted }]}>
              {resolvedRecipient.accountNumber}  ·  {resolvedRecipient.bankName || bank}
            </Text>
            <Text style={[styles.verifiedRecipientFootnote, { color: theme.textMuted }]}>
              Confirm this name and account number carefully before any withdrawal.
            </Text>
          </View>
        )}

        {tab === 'bank' ? (
          <>
            <Text style={[styles.label, { color: theme.text }]}>Select Bank</Text>
            <TouchableOpacity
              style={[styles.dropdownTrigger, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setBankModalVisible(true)}
            >
              <Text style={{ color: bank ? theme.text : theme.textMuted, fontWeight: '600' }}>
                {bank || 'Choose a bank'}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.zannyStaticSelect, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.zannyStaticIcon, { backgroundColor: theme.primary }]}>
              <Text style={styles.zannyStaticIconText}>Z</Text>
            </View>
            <Text style={[styles.zannyStaticText, { color: theme.text }]}>ZannyPay</Text>
          </View>
        )}

        <Text style={[styles.label, { color: theme.text }]}>Amount</Text>
        <TextInput
          ref={amountInputRef}
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="₦0.00"
          placeholderTextColor={theme.textMuted}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
        <View style={styles.quickAmountRow}>
          {QUICK_AMOUNTS.map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[styles.quickAmountChip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
              onPress={() => setAmount(String(preset))}
            >
              <Text style={[styles.quickAmountText, { color: theme.text }]}>{preset.toLocaleString()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.text }]}>Add a Note (Optional)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="What is this for?"
          placeholderTextColor={theme.textMuted}
          value={note}
          onChangeText={setNote}
        />

        <GradientButton title="Next" onPress={handleInitiateTransfer} style={{ marginTop: 30 }} />

        {tab === 'bank' && (
          <View style={[styles.payoutNotice, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Ionicons name="information-circle-outline" size={18} color={theme.textMuted} />
            <Text style={[styles.payoutNoticeText, { color: theme.textMuted }]}>
              Account-name verification is available. External bank withdrawals will become available after a payout provider is approved and connected. No money will be debited before then.
            </Text>
          </View>
        )}

        {/* Sub Tabs */}
        <View style={styles.subTabContainer}>
          <View style={styles.subTabLeft}>
            <TouchableOpacity onPress={() => setSubTab('recent')}>
              <Text style={[styles.subTabText, { color: subTab === 'recent' ? theme.primary : theme.textMuted }]}>Recent</Text>
              {subTab === 'recent' && <View style={[styles.subTabIndicator, { backgroundColor: theme.primary }]} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSubTab('saved')}>
              <Text style={[styles.subTabText, { color: subTab === 'saved' ? theme.primary : theme.textMuted }]}>Saved Recipients</Text>
              {subTab === 'saved' && <View style={[styles.subTabIndicator, { backgroundColor: theme.primary }]} />}
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Beneficiaries')}>
            <Ionicons name="add-circle-outline" size={22} color={theme.primary} />
          </TouchableOpacity>
        </View>

        <Animated.View style={{ opacity: listFade }}>
          <View style={styles.listContainer}>
            {subTab === 'recent' && recentTransfers.length > 0 && recentTransfers.map(renderRecentItem)}
            {subTab === 'recent' && recentTransfers.length === 0 && (
              <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 30 }}>No transfers yet</Text>
            )}
            {subTab === 'saved' && savedForCurrentTab.length > 0 && savedForCurrentTab.map(renderSavedItem)}
            {subTab === 'saved' && savedForCurrentTab.length === 0 && (
              <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 30 }}>No saved recipients yet</Text>
            )}
            {subTab === 'recent' && recentTransfers.length > 0 && (
              <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('History')}>
                <Text style={[styles.viewAllText, { color: theme.textMuted }]}>View All </Text>
                <Ionicons name="chevron-forward" size={12} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      {/* Select Bank Modal */}
      <Modal
        visible={bankModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setBankModalVisible(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setBankModalVisible(false)}>
              <Ionicons name="close" size={26} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select Bank</Text>
            <View style={{ width: 26 }} />
          </View>

          <View style={[styles.searchContainer, { backgroundColor: theme.surface }]}>
            <Ionicons name="search" size={20} color={theme.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search Bank"
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <FlatList
            data={filteredBanks}
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalBankRow, { borderBottomColor: theme.surface }]}
                onPress={() => {
                  setResolvedRecipient(null);
                  setBankLookupError(null);
                  setBank(item.name);
                  setBankCode(item.code);
                  setBankModalVisible(false);
                  setSearchQuery('');
                }}
              >
                <View style={[styles.modalBankIcon, { backgroundColor: theme.surfaceAlt }]}>
                  <Text style={[styles.modalBankIconText, { color: theme.text }]}>{item.name.charAt(0)}</Text>
                </View>
                <Text style={[styles.modalBankText, { color: theme.text }]} >{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <Text style={[styles.noBankText, { color: theme.textMuted }]}>No banks found</Text>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* PIN Confirmation Modal */}
      <Modal visible={showPinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.pinModalCard, { backgroundColor: theme.surfaceAlt }]}>
            <Text style={[styles.pinModalTitle, { color: theme.text }]}>Confirm Transfer</Text>
            <Text style={[styles.pinModalSubtitle, { color: theme.textMuted }]}>
              You are sending <Text style={{ fontWeight: '800', color: theme.success }}>{formatCurrency(amount)}</Text> to {account}
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.primary,
                  color: theme.text,
                  textAlign: 'center',
                  fontSize: 24,
                  letterSpacing: 12,
                  marginTop: 10,
                },
              ]}
              placeholder="••••"
              placeholderTextColor={theme.border}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              value={pin}
              onChangeText={setPin}
              autoFocus
            />

            <GradientButton title="Confirm & Send" onPress={handleConfirmTransfer} loading={loading} style={{ marginTop: 25 }} />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowPinModal(false); setPin(''); }}>
              <Text style={[styles.cancelBtnText, { color: theme.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SuccessModal
        visible={!!successInfo}
        title="Transfer Successful"
        message={successInfo?.message}
        buttonLabel="Done"
        onClose={() => { setSuccessInfo(null); navigation.navigate('Main'); }}
        secondaryLabel="View Receipt"
        onSecondary={() => { const txn = successInfo?.txn; setSuccessInfo(null); navigation.navigate('TransactionDetail', { txn }); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  tabContainer: { flexDirection: 'row', marginHorizontal: 20, borderBottomWidth: 1, position: 'relative' },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { fontSize: 15, fontWeight: '600' },
  tabIndicator: { position: 'absolute', bottom: 0, width: '40%', height: 2, borderRadius: 1 },

  scroll: { padding: 24 },
  balanceText: { textAlign: 'center', fontSize: 14, marginBottom: 20, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 10, marginTop: 20 },
  quickAmountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  quickAmountChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  quickAmountText: { fontSize: 13, fontWeight: '600' },
  input: { borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, fontSize: 16, borderWidth: 1, fontWeight: '600' },
  resolveBanner: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingVertical: 8, paddingHorizontal: 4 },
  resolveText: { fontSize: 13, marginLeft: 8 },
  verifiedRecipientCard: { borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 14 },
  verifiedRecipientHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedRecipientEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  verifiedRecipientName: { fontSize: 18, fontWeight: '800', marginTop: 10 },
  verifiedRecipientMeta: { fontSize: 13, fontWeight: '600', marginTop: 5 },
  verifiedRecipientFootnote: { fontSize: 11, marginTop: 8, lineHeight: 16 },
  payoutNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 18 },
  payoutNoticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  dropdownTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, borderWidth: 1 },

  zannyStaticSelect: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 16, borderWidth: 1 },
  zannyStaticIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  zannyStaticIconText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  zannyStaticText: { fontSize: 16, fontWeight: '500' },

  promoBanner: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, marginBottom: 15 },
  promoText: { fontSize: 12, marginRight: 5 },
  promoHighlight: { fontWeight: 'bold' },

  monitorBanner: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 25 },
  monitorText: { flex: 1, fontSize: 13, marginLeft: 10, fontWeight: '500' },

  subTabContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  subTabLeft: { flexDirection: 'row', gap: 20 },
  subTabText: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  subTabIndicator: { height: 2, width: 20, borderRadius: 1 },

  listContainer: { paddingBottom: 20 },
  contactItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 22 },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  contactAvatarText: { fontSize: 18, fontWeight: 'bold' },
  contactInfo: { flex: 1, justifyContent: 'center' },
  contactName: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  contactDetails: { fontSize: 12, marginBottom: 2 },
  contactDate: { fontSize: 11 },

  viewAllBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  viewAllText: { fontSize: 12 },

  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 20, borderRadius: 10, paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 45, fontSize: 15 },
  modalBankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1 },
  modalBankIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  modalBankIconText: { fontSize: 14, fontWeight: 'bold' },
  modalBankText: { fontSize: 15, fontWeight: '500' },
  noBankText: { textAlign: 'center', marginTop: 40, fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  pinModalCard: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 30, paddingBottom: 50 },
  pinModalTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  pinModalSubtitle: { fontSize: 15, textAlign: 'center', marginTop: 10, marginBottom: 25 },
  cancelBtn: { marginTop: 20, padding: 15, alignItems: 'center' },
  cancelBtnText: { fontWeight: '700', fontSize: 16 },
});
