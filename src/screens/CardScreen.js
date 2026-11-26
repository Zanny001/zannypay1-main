import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
  ActivityIndicator, Dimensions, Animated, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import { formatCurrency } from '../utils/format';
import GradientButton from '../components/GradientButton';
import PressableScale from '../components/PressableScale';
import AnimatedProgressBar from '../components/AnimatedProgressBar';
import TransactionRow from '../components/TransactionRow';
import { haptic } from '../theme/motion';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GUTTER = 20;
const CARD_WIDTH = SCREEN_WIDTH - CARD_GUTTER * 2;
const CARD_SPACING = 14;
const CARD_HEIGHT = 196;

// Master audit, Section 5: network branding was entirely absent — every
// card rendered identically regardless of `network`. Colors/wordmarks
// below are deliberately generic/illustrative, not the real Visa/
// Mastercard/Verve brand marks (those are trademarked assets a real
// product licenses through the network itself when it issues cards).
const NETWORK_META = {
  VISA: { label: 'VISA', bg: ['#1A1F71', '#2C3E9E'] },
  MASTERCARD: { label: 'mastercard', bg: ['#1B1B1B', '#3D2E1A'] },
  VERVE: { label: 'VERVE', bg: ['#0A3D2E', '#0E9F6E'] },
  ZANNYPAY: { label: 'ZANNYPAY', bg: ['#123E61', '#061426'] },
};

function CardFace({ card, revealed, holderName }) {
  const meta = NETWORK_META[card.network] || NETWORK_META.ZANNYPAY;
  const panDisplay =
    revealed && !card.isFrozen && card.cardNumber
      ? card.cardNumber.replace(/(.{4})/g, '$1  ').trim()
      : `••••  ••••  ••••  ${card.last4 || '••••'}`;

  return (
    <LinearGradient
      colors={meta.bg}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.creditCard, card.isFrozen && styles.frozenCard]}
    >
      {/* A diagonal sheen — previously every card face was a flat solid
          fill with no texture at all, which read as a placeholder rather
          than a real payment card next to the reference apps this
          redesign is benchmarked against. */}
      <View style={styles.sheen} pointerEvents="none" />

      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardType}>{card.isLinkedExternal ? 'LINKED CARD' : card.type || 'VIRTUAL ULTRA'}</Text>
          {card.isDefault && (
            <View style={styles.defaultPill}>
              <Text style={styles.defaultPillText}>DEFAULT</Text>
            </View>
          )}
        </View>
        <Text style={styles.networkWordmark}>{meta.label}</Text>
      </View>

      <Text style={styles.cardNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{panDisplay}</Text>

      <View style={styles.cardBottom}>
        <View>
          <Text style={styles.cardLabel}>CARD HOLDER</Text>
          <Text style={styles.cardValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{(holderName || 'ZANNYPAY USER').toUpperCase()}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardLabel}>EXPIRES</Text>
          <Text style={styles.cardValue}>{revealed && !card.isFrozen ? card.expiry : '••/••'}</Text>
        </View>
      </View>

      {card.isFrozen && (
        <View style={styles.frozenOverlay}>
          <Ionicons name="lock-closed" size={22} color="#fff" />
          <Text style={styles.frozenText}>FROZEN</Text>
        </View>
      )}
    </LinearGradient>
  );
}

function AddCardTile({ onPress }) {
  return (
    <PressableScale onPress={onPress} style={styles.addCardTile}>
      <View style={styles.addCardInner}>
        <View style={styles.addCardIconWrap}>
          <Ionicons name="add" size={28} color={colors.primary} />
        </View>
        <Text style={styles.addCardText}>Add a Card</Text>
        <Text style={styles.addCardSubtext}>Request new or link existing</Text>
      </View>
    </PressableScale>
  );
}

export default function CardScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const {
    user, cards, toggleCardFreeze, requestVirtualCard, linkExternalCard,
    setDefaultCard, updateCardLimits, removeCard, fetchCardActivity,
  } = useWallet();

  const [activeIndex, setActiveIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [limitsModalVisible, setLimitsModalVisible] = useState(false);
  const [dailyLimitInput, setDailyLimitInput] = useState('');
  const [monthlyLimitInput, setMonthlyLimitInput] = useState('');
  const [savingLimits, setSavingLimits] = useState(false);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);

  const activeCard = cards?.[activeIndex] || null;

  // Reveal state resets the moment the selected card changes — a user
  // scrolling from a revealed card to another one should never see the
  // new card's PAN pre-exposed just because the previous one was open.
  useEffect(() => {
    setShowDetails(false);
  }, [activeIndex]);

  useEffect(() => {
    if (!activeCard) {
      setActivity([]);
      return;
    }
    let cancelled = false;
    setActivityLoading(true);
    fetchCardActivity(activeCard.id).then((res) => {
      if (!cancelled) setActivity(res.ok ? res.data : []);
      if (!cancelled) setActivityLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [activeCard, fetchCardActivity]);

  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: false,
    listener: (e) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_SPACING));
      if (index !== activeIndex && index < (cards?.length || 0)) setActiveIndex(index);
    },
  });

  const handleToggleFreeze = async () => {
    if (!activeCard) return;
    haptic.medium();
    setLoading(true);
    const res = await toggleCardFreeze(activeCard.id, !activeCard.isFrozen);
    setLoading(false);
    if (res.ok) {
      haptic.success();
    } else {
      alert('Error', res.error || 'Could not update card status.');
    }
  };

  const handleSetDefault = async () => {
    if (!activeCard || activeCard.isDefault) return;
    setLoading(true);
    const res = await setDefaultCard(activeCard.id);
    setLoading(false);
    if (res.ok) haptic.success();
    else alert('Error', res.error || 'Could not set this as your default card.');
  };

  const handleRemoveCard = () => {
    if (!activeCard) return;
    alert(
      'Remove this card?',
      `This will permanently remove your ${NETWORK_META[activeCard.network]?.label || activeCard.network} card ending in ${activeCard.last4}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const res = await removeCard(activeCard.id);
            setLoading(false);
            if (!res.ok) alert('Error', res.error || 'Could not remove this card.');
            else setActiveIndex(0);
          },
        },
      ]
    );
  };

  const openAddCardChoice = () => {
    alert('Add a Card', 'Choose how you\u2019d like to add a card to your account.', [
      { text: 'Request New ZannyPay Card', onPress: openNetworkPicker },
      { text: 'Link an Existing Card', onPress: () => setLinkModalVisible(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openNetworkPicker = () => {
    alert('Choose a Network', 'Which network would you like your new card on?', [
      { text: 'ZannyPay', onPress: () => doRequestCard('ZANNYPAY') },
      { text: 'Visa', onPress: () => doRequestCard('VISA') },
      { text: 'Mastercard', onPress: () => doRequestCard('MASTERCARD') },
      { text: 'Verve', onPress: () => doRequestCard('VERVE') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const doRequestCard = async (network) => {
    setLoading(true);
    const res = await requestVirtualCard(network);
    setLoading(false);
    if (res.ok) {
      haptic.success();
      alert('Card Created', 'Your new card is ready to use.', undefined, { type: 'success' });
    } else {
      alert('Error', res.error || 'Could not generate a new card.');
    }
  };

  const handleLinkCard = async () => {
    if (!authCode.trim()) return;
    setLinking(true);
    const res = await linkExternalCard(authCode.trim());
    setLinking(false);
    if (res.ok) {
      setLinkModalVisible(false);
      setAuthCode('');
      haptic.success();
      alert('Card Linked', 'Your card has been linked successfully.', undefined, { type: 'success' });
    } else {
      // Honest by design: with no real card-tokenization processor
      // configured on this backend deployment, this surfaces the
      // backend's own clear "not available" message rather than the UI
      // pretending the link worked. See cards/providers/card-linking.
      // provider.ts on the backend for the real integration shape.
      alert('Could Not Link Card', res.error || 'Please try again.');
    }
  };

  const openLimitsModal = () => {
    if (!activeCard) return;
    setDailyLimitInput(String(activeCard.dailyLimit ?? ''));
    setMonthlyLimitInput(String(activeCard.monthlyLimit ?? ''));
    setLimitsModalVisible(true);
  };

  const handleSaveLimits = async () => {
    if (!activeCard) return;
    setSavingLimits(true);
    const res = await updateCardLimits(activeCard.id, dailyLimitInput, monthlyLimitInput);
    setSavingLimits(false);
    if (res.ok) {
      setLimitsModalVisible(false);
      haptic.success();
    } else {
      alert('Error', res.error || 'Could not update limits.');
    }
  };

  const dailyPct = activeCard ? Math.min(100, (Number(activeCard.dailySpent || 0) / Math.max(1, Number(activeCard.dailyLimit || 1))) * 100) : 0;
  const monthlyPct = activeCard ? Math.min(100, (Number(activeCard.monthlySpent || 0) / Math.max(1, Number(activeCard.monthlyLimit || 1))) * 100) : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.wrapper}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>Zanny Cards</Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                {cards?.length ? `${cards.length} card${cards.length > 1 ? 's' : ''}` : 'No cards yet'}
              </Text>
            </View>
          </View>

          {/* ---------- Carousel ---------- */}
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled={false}
            snapToInterval={CARD_WIDTH + CARD_SPACING}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingRight: CARD_SPACING }}
          >
            {(cards || []).map((card, i) => (
              <View key={card.id} style={{ marginRight: CARD_SPACING }}>
                <CardFace card={card} revealed={showDetails && i === activeIndex} holderName={user?.name} />
              </View>
            ))}
            <AddCardTile onPress={openAddCardChoice} />
          </Animated.ScrollView>

          {/* Dot pagination — only meaningful with 2+ real cards */}
          {(cards?.length || 0) > 1 && (
            <View style={styles.dotsRow}>
              {cards.map((_, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: i === activeIndex ? theme.primary : theme.border }]} />
              ))}
            </View>
          )}

          {!activeCard ? (
            <View style={styles.noCardContainer}>
              <Ionicons name="card-outline" size={56} color={theme.textMuted} />
              <Text style={[styles.noCardText, { color: theme.text }]}>You don't have a virtual card yet.</Text>
              <GradientButton title="Get Your First Card" onPress={openAddCardChoice} loading={loading} />
            </View>
          ) : (
            <>
              {/* ---------- Context-aware action row ---------- */}
              <View style={styles.actionRow}>
                <PressableScale style={styles.actionBtn} onPress={handleToggleFreeze} disabled={loading}>
                  <View style={[styles.actionIconWrap, { backgroundColor: theme.surfaceAlt }]}>
                    {loading ? <ActivityIndicator size="small" color={theme.primary} /> : (
                      <Ionicons name={activeCard.isFrozen ? 'lock-open-outline' : 'lock-closed-outline'} size={20} color={theme.text} />
                    )}
                  </View>
                  <Text style={[styles.actionLabel, { color: theme.textMuted }]}>{activeCard.isFrozen ? 'Unfreeze' : 'Freeze'}</Text>
                </PressableScale>

                <PressableScale style={styles.actionBtn} onPress={() => !activeCard.isFrozen && setShowDetails((s) => !s)} disabled={activeCard.isFrozen}>
                  <View style={[styles.actionIconWrap, { backgroundColor: theme.surfaceAlt, opacity: activeCard.isFrozen ? 0.4 : 1 }]}>
                    <Ionicons name={showDetails ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.text} />
                  </View>
                  <Text style={[styles.actionLabel, { color: theme.textMuted }]}>Reveal</Text>
                </PressableScale>

                <PressableScale style={styles.actionBtn} onPress={handleSetDefault} disabled={activeCard.isDefault}>
                  <View style={[styles.actionIconWrap, { backgroundColor: theme.surfaceAlt, opacity: activeCard.isDefault ? 0.4 : 1 }]}>
                    <Ionicons name="star-outline" size={20} color={theme.text} />
                  </View>
                  <Text style={[styles.actionLabel, { color: theme.textMuted }]}>{activeCard.isDefault ? 'Default' : 'Set Default'}</Text>
                </PressableScale>

                <PressableScale style={styles.actionBtn} onPress={openLimitsModal}>
                  <View style={[styles.actionIconWrap, { backgroundColor: theme.surfaceAlt }]}>
                    <Ionicons name="options-outline" size={20} color={theme.text} />
                  </View>
                  <Text style={[styles.actionLabel, { color: theme.textMuted }]}>Limits</Text>
                </PressableScale>
              </View>

              {showDetails && !activeCard.isFrozen && (
                <View style={[styles.cvvNote, { backgroundColor: theme.surfaceAlt }]}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={theme.textMuted} />
                  <Text style={[styles.cvvNoteText, { color: theme.textMuted }]}>
                    For your security, the CVV is never stored and isn't shown here — it's only ever entered directly at checkout.
                  </Text>
                </View>
              )}

              {/* ---------- Spending limits ---------- */}
              <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Spending Limits</Text>

                <View style={styles.limitRow}>
                  <View style={styles.limitHeader}>
                    <Text style={[styles.limitLabel, { color: theme.textMuted }]}>Daily</Text>
                    <Text style={[styles.limitValue, { color: theme.text }]}>
                      {formatCurrency(activeCard.dailySpent || 0)} / {formatCurrency(activeCard.dailyLimit || 0)}
                    </Text>
                  </View>
                  <AnimatedProgressBar percentage={dailyPct} color={theme.primary} />
                </View>

                <View style={[styles.limitRow, { marginTop: 16 }]}>
                  <View style={styles.limitHeader}>
                    <Text style={[styles.limitLabel, { color: theme.textMuted }]}>Monthly</Text>
                    <Text style={[styles.limitValue, { color: theme.text }]}>
                      {formatCurrency(activeCard.monthlySpent || 0)} / {formatCurrency(activeCard.monthlyLimit || 0)}
                    </Text>
                  </View>
                  <AnimatedProgressBar percentage={monthlyPct} color={theme.accent} />
                </View>
              </View>

              {/* ---------- Card Services ---------- */}
              <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Card Services</Text>
                <View style={styles.servicesGrid}>
                  <PressableScale style={styles.serviceItem} onPress={() => navigation.navigate('Statement')}>
                    <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                    <Text style={[styles.serviceLabel, { color: theme.text }]}>Statement</Text>
                  </PressableScale>
                  <PressableScale style={styles.serviceItem} onPress={() => navigation.navigate('Disputes')}>
                    <Ionicons name="alert-circle-outline" size={20} color={theme.primary} />
                    <Text style={[styles.serviceLabel, { color: theme.text }]}>Dispute a Charge</Text>
                  </PressableScale>
                  <PressableScale style={styles.serviceItem} onPress={openLimitsModal}>
                    <Ionicons name="options-outline" size={20} color={theme.primary} />
                    <Text style={[styles.serviceLabel, { color: theme.text }]}>Manage Limits</Text>
                  </PressableScale>
                  <PressableScale style={styles.serviceItem} onPress={handleRemoveCard}>
                    <Ionicons name="trash-outline" size={20} color={colors.danger} />
                    <Text style={[styles.serviceLabel, { color: colors.danger }]}>Remove Card</Text>
                  </PressableScale>
                </View>
              </View>

              {/* ---------- Card activity ---------- */}
              <View style={[styles.section, { backgroundColor: theme.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Card Activity</Text>
                {activityLoading ? (
                  <ActivityIndicator color={theme.primary} style={{ marginVertical: 20 }} />
                ) : activity.length === 0 ? (
                  <Text style={[styles.emptyActivityText, { color: theme.textMuted }]}>No purchases on this card yet.</Text>
                ) : (
                  activity.slice(0, 10).map((txn) => <TransactionRow key={txn.id} txn={txn} />)
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={linkModalVisible} transparent animationType="slide" onRequestClose={() => setLinkModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Link an Existing Card</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textMuted }]}>
              Your card details go directly to our payment processor — ZannyPay never sees or stores your card number.
            </Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
              placeholder="Authorization code from your bank"
              placeholderTextColor={theme.textMuted}
              value={authCode}
              onChangeText={setAuthCode}
              autoCapitalize="none"
            />
            <GradientButton title="Link Card" onPress={handleLinkCard} loading={linking} style={{ marginTop: 8 }} />
            <TouchableOpacity onPress={() => { setLinkModalVisible(false); setAuthCode(''); }} style={{ marginTop: 14 }}>
              <Text style={[styles.modalCancel, { color: theme.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={limitsModalVisible} transparent animationType="slide" onRequestClose={() => setLimitsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Spending Limits</Text>
            <Text style={[styles.modalLabel, { color: theme.textMuted }]}>Daily limit (₦)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
              keyboardType="numeric"
              value={dailyLimitInput}
              onChangeText={setDailyLimitInput}
            />
            <Text style={[styles.modalLabel, { color: theme.textMuted, marginTop: 12 }]}>Monthly limit (₦)</Text>
            <TextInput
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border }]}
              keyboardType="numeric"
              value={monthlyLimitInput}
              onChangeText={setMonthlyLimitInput}
            />
            <GradientButton title="Save Limits" onPress={handleSaveLimits} loading={savingLimits} style={{ marginTop: 16 }} />
            <TouchableOpacity onPress={() => setLimitsModalVisible(false)} style={{ marginTop: 14 }}>
              <Text style={[styles.modalCancel, { color: theme.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  wrapper: { padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 6, gap: 12 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', fontFamily: fonts.extraBold },
  subtitle: { fontSize: 13, fontFamily: fonts.regular, marginTop: 2 },

  creditCard: {
    width: CARD_WIDTH, height: CARD_HEIGHT, borderRadius: 20, padding: 22,
    justifyContent: 'space-between', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  frozenCard: { opacity: 0.6 },
  sheen: {
    position: 'absolute', top: -60, left: -40, width: CARD_WIDTH * 0.9, height: CARD_HEIGHT * 1.4,
    backgroundColor: 'rgba(255,255,255,0.06)', transform: [{ rotate: '25deg' }],
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardType: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  defaultPill: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 6, alignSelf: 'flex-start' },
  defaultPillText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  networkWordmark: { color: '#fff', fontSize: 18, fontWeight: '800', fontStyle: 'italic' },
  cardNumber: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 1.8, maxWidth: '100%' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '600', letterSpacing: 1, marginBottom: 2 },
  cardValue: { color: '#fff', fontSize: 12, fontWeight: '700', maxWidth: 190, flexShrink: 1 },
  frozenOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', gap: 8 },
  frozenText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 3 },

  addCardTile: { width: CARD_WIDTH, height: CARD_HEIGHT },
  addCardInner: {
    flex: 1, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  addCardIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.primary}18`, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  addCardText: { fontSize: 15, fontWeight: '700', color: colors.textDark },
  addCardSubtext: { fontSize: 12, color: colors.textMuted },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  noCardContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 30, gap: 12 },
  noCardText: { fontSize: 15, fontWeight: '500', marginBottom: 8 },

  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, paddingHorizontal: 4 },
  actionBtn: { alignItems: 'center', gap: 8, flex: 1 },
  actionIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '600' },

  cvvNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, marginTop: 16 },
  cvvNoteText: { flex: 1, fontSize: 12, lineHeight: 17 },

  section: { borderRadius: 20, padding: 18, marginTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 14 },

  limitRow: {},
  limitHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  limitLabel: { fontSize: 12, fontWeight: '600' },
  limitValue: { fontSize: 12, fontWeight: '700' },

  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  serviceItem: { width: '48%', minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: '#1B3B57' },
  serviceLabel: { flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 17, fontWeight: '700', flexShrink: 1 },

  emptyActivityText: { fontSize: 13, textAlign: 'center', paddingVertical: 20 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 36 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, lineHeight: 19, marginBottom: 18 },
  modalLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalCancel: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
