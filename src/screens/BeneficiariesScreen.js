import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, SectionList, TouchableOpacity, TextInput, Modal, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { saveJSON, loadJSON } from '../utils/storage';
import { formatDate } from '../utils/format';
import GradientButton from '../components/GradientButton';
import Card from '../components/Card';
import FadeInView from '../components/FadeInView';
import { useAlert } from '../context/AlertContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STORAGE_KEY = 'zannypay:beneficiaries';
const BANKS = ['ZannyPay', 'Access Bank', 'First Bank', 'GTBank', 'UBA', 'Zenith Bank', 'Kuda', 'Opay'];
const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function sectionLetterFor(name) {
  const first = (name || '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : '#';
}

export default function BeneficiariesScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { transactions } = useWallet();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [query, setQuery] = useState('');
  const [addVisible, setAddVisible] = useState(false);
  const [name, setName] = useState('');
  const [account, setAccount] = useState('');
  const [bank, setBank] = useState(BANKS[0]);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    const saved = await loadJSON(STORAGE_KEY, []);
    setBeneficiaries(saved || []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Most recent transfer per beneficiary, derived from real transaction
  // history rather than tracked separately — a transfer already records
  // the account it targeted (Transaction.recipientAccount), so this is
  // just a lookup, not new state to keep in sync.
  const lastTransferByAccount = useMemo(() => {
    const map = {};
    for (const txn of transactions || []) {
      if (!txn.recipientAccount) continue;
      const existing = map[txn.recipientAccount];
      const txnDate = txn.createdAt || txn.date;
      if (!existing || new Date(txnDate) > new Date(existing)) {
        map[txn.recipientAccount] = txnDate;
      }
    }
    return map;
  }, [transactions]);

  const sections = useMemo(() => {
    const filtered = beneficiaries.filter((b) => b.name.toLowerCase().includes(query.trim().toLowerCase()));
    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    const grouped = {};
    for (const b of sorted) {
      const letter = sectionLetterFor(b.name);
      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(b);
    }
    return Object.keys(grouped)
      .sort()
      .map((letter) => ({ title: letter, data: grouped[letter] }));
  }, [beneficiaries, query]);

  const availableLetters = useMemo(() => new Set(sections.map((s) => s.title)), [sections]);

  const scrollToLetter = (letter) => {
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    if (sectionIndex === -1) return;
    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, animated: true, viewOffset: 0 });
  };

  const handleAdd = async () => {
    if (!name || !account) {
      alert('Missing details', 'Please enter a name and account number.');
      return;
    }
    const entry = { id: Date.now().toString(), name, account, bank };
    const updated = [entry, ...beneficiaries];
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setBeneficiaries(updated);
    await saveJSON(STORAGE_KEY, updated);
    setName('');
    setAccount('');
    setBank(BANKS[0]);
    setAddVisible(false);
  };

  const handleRemove = (id) => {
    alert('Remove Beneficiary', 'This will remove them from your saved recipients.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = beneficiaries.filter((b) => b.id !== id);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setBeneficiaries(updated);
          await saveJSON(STORAGE_KEY, updated);
        },
      },
    ]);
  };

  const handleSendTo = (item) => {
    navigation.navigate('Transfer', {
      prefillAccount: item.account,
      prefillBank: item.bank === 'ZannyPay' ? null : item.bank,
      prefillName: item.name,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Saved Recipients</Text>
        <TouchableOpacity onPress={() => setAddVisible(true)} style={styles.backBtn}>
          <Ionicons name="add-circle-outline" size={26} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {beneficiaries.length > 0 && (
        <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search recipients"
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      )}

      <View style={{ flex: 1, flexDirection: 'row' }}>
        <SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          onScrollToIndexFailed={() => {}}
          style={{ flex: 1 }}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
              <Text style={[styles.sectionHeaderText, { color: theme.textMuted }]}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item, index }) => {
            const lastTransfer = lastTransferByAccount[item.account];
            return (
              <FadeInView index={index % 8}>
                <Card style={styles.row}>
                  <TouchableOpacity style={styles.rowMain} onPress={() => handleSendTo(item)} activeOpacity={0.7}>
                    <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                      <Text style={styles.avatarText}>{item.name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={[styles.rowName, { color: theme.text }]}>{item.name}</Text>
                      <Text style={[styles.rowSub, { color: theme.textMuted }]}>{item.bank} · {item.account}</Text>
                      {!!lastTransfer && (
                        <Text style={[styles.rowLastTransfer, { color: theme.textMuted }]}>
                          Last transfer {formatDate(lastTransfer)}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="paper-plane-outline" size={20} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleRemove(item.id)}>
                    <Ionicons name="trash-outline" size={18} color={theme.danger} />
                  </TouchableOpacity>
                </Card>
              </FadeInView>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyStateContainer}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="people-outline" size={32} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>
                {query ? 'No matches' : 'No Saved Recipients'}
              </Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                {query ? 'Try a different name.' : 'Add people you pay often for one-tap transfers.'}
              </Text>
              {!query && (
                <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: theme.primary }]} onPress={() => setAddVisible(true)}>
                  <Text style={styles.emptyBtnText}>Add Recipient</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />

        {sections.length > 0 && (
          <View style={styles.alphaRail}>
            {ALPHABET.map((letter) => {
              const isAvailable = availableLetters.has(letter);
              return (
                <TouchableOpacity key={letter} onPress={() => isAvailable && scrollToLetter(letter)} style={styles.alphaRailItem}>
                  <Text style={[styles.alphaRailText, { color: isAvailable ? theme.primary : theme.border }]}>{letter}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <Modal visible={addVisible} transparent animationType="slide" onRequestClose={() => setAddVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add Recipient</Text>

            <Text style={[styles.label, { color: theme.text }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              placeholder="e.g. John Doe"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { color: theme.text }]}>Account Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              placeholder="0000000000"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              value={account}
              onChangeText={setAccount}
              maxLength={10}
            />

            <Text style={[styles.label, { color: theme.text }]}>Bank</Text>
            <View style={styles.bankRow}>
              {BANKS.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[styles.bankChip, { borderColor: theme.border, backgroundColor: theme.background }, bank === b && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                  onPress={() => setBank(b)}
                >
                  <Text style={[styles.bankChipText, { color: theme.text }, bank === b && { color: '#fff' }]}>{b}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <GradientButton title="Save Recipient" onPress={handleAdd} style={{ marginTop: 20 }} />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddVisible(false)}>
              <Text style={[styles.cancelBtnText, { color: theme.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  listContent: { paddingHorizontal: 20, paddingRight: 8, paddingBottom: 40, flexGrow: 1 },
  sectionHeader: { paddingVertical: 6 },
  sectionHeaderText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 12 },
  rowMain: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  rowName: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowLastTransfer: { fontSize: 11, marginTop: 3 },
  deleteBtn: { paddingLeft: 12 },
  alphaRail: { width: 22, justifyContent: 'center', paddingRight: 4 },
  alphaRailItem: { paddingVertical: 1.5 },
  alphaRailText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  emptyStateContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 24 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center', marginBottom: 20 },
  emptyBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1 },
  bankRow: { flexDirection: 'row', flexWrap: 'wrap' },
  bankChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  bankChipText: { fontSize: 12, fontWeight: '600' },
  cancelBtn: { marginTop: 16, alignItems: 'center' },
  cancelBtnText: { fontWeight: '600' },
});
