import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import AnimatedProgressBar from '../components/AnimatedProgressBar';
import FadeInView from '../components/FadeInView';
import Confetti from '../components/Confetti';
import AnimatedNumber from '../components/AnimatedNumber';

// Real tiers derived from the real rewardPoints total — no fabricated
// coupon counts or countdown timers.
const TIERS = [
  { name: 'Bronze', min: 0, icon: 'medal-outline' },
  { name: 'Silver', min: 200, icon: 'medal' },
  { name: 'Gold', min: 500, icon: 'trophy' },
];

function getTier(points) {
  let current = TIERS[0];
  for (const t of TIERS) {
    if (points >= t.min) current = t;
  }
  const next = TIERS.find((t) => t.min > points);
  return { current, next };
}

export default function RewardsScreen() {
  const { alert } = useAlert();
  const { theme } = useTheme();
  const { user, dailyCheckIn } = useWallet();
  const navigation = useNavigation();
  const [checkingIn, setCheckingIn] = useState(false);
  const [celebration, setCelebration] = useState(null); // { count } while a confetti burst is playing, else null

  const points = user?.rewardPoints || 0;
  const streak = user?.checkInStreak || 0;
  const { current, next } = getTier(points);
  const progressToNext = next ? Math.min(100, (points / next.min) * 100) : 100;
  const isCheckedInToday = user?.lastCheckIn
    ? new Date(user.lastCheckIn).toDateString() === new Date().toDateString()
    : false;

  const handleCheckIn = async () => {
    setCheckingIn(true);
    const res = await dailyCheckIn();
    setCheckingIn(false);

    if (!res.ok) {
      alert('Could Not Check In', res.error, null, { type: 'error' });
      return;
    }
    if (res.alreadyCheckedIn) {
      alert('Already Checked In', "You've already claimed today's reward. Come back tomorrow!", null, { type: 'info' });
      return;
    }

    // A milestone streak gets a bigger burst and its own message; an
    // ordinary day still gets a small celebration rather than a flat
    // alert box, so checking in feels rewarding every time, not just on
    // round numbers.
    setCelebration({ count: res.milestone ? 60 : 24 });
    setTimeout(() => setCelebration(null), 1400);

    if (res.milestone) {
      alert(
        `${res.milestone}-Day Streak! 🔥`,
        `You've checked in ${res.milestone} days in a row — +${res.pointsEarned} points (${res.rewardPoints} total).`,
        null,
        { type: 'success' }
      );
    } else {
      alert('Reward Claimed! 🎉', `+${res.pointsEarned} points added. You now have ${res.rewardPoints} points.`, null, { type: 'success' });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Rewards</Text>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <FadeInView>
          <View style={{ position: 'relative' }}>
            <LinearGradient colors={gradients.gold} style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name={current.icon} size={26} color="#1A1523" />
                  <Text style={styles.tierLabel}>{current.name} Tier</Text>
                </View>
                {streak > 0 && (
                  <View style={styles.streakBadge}>
                    <Ionicons name="flame" size={15} color="#EA580C" />
                    <Text style={styles.streakText}>{streak} day{streak === 1 ? '' : 's'}</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <AnimatedNumber value={points} format={(n) => Math.round(n).toLocaleString()} style={styles.pointsValue} />
                <Text style={styles.pts}> PTS</Text>
              </View>

              {next ? (
                <>
                  <AnimatedProgressBar percentage={progressToNext} color="#1A1523" trackColor="rgba(26,21,35,0.15)" />
                  <Text style={styles.nextTierText}>{next.min - points} points to {next.name}</Text>
                </>
              ) : (
                <Text style={styles.nextTierText}>You've reached the highest tier 🎉</Text>
              )}

              <TouchableOpacity
                style={[styles.claimBtn, isCheckedInToday && styles.claimBtnDisabled]}
                onPress={handleCheckIn}
                disabled={isCheckedInToday || checkingIn}
              >
                <Text style={[styles.claimBtnText, isCheckedInToday && styles.claimBtnTextDisabled]}>
                  {isCheckedInToday ? 'Checked In Today' : checkingIn ? 'Checking in…' : 'Daily Check-In +10'}
                </Text>
              </TouchableOpacity>
            </LinearGradient>
            {celebration && <Confetti count={celebration.count} origin={{ x: 150, y: 60 }} />}
          </View>
        </FadeInView>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Ways to Earn</Text>

        <FadeInView delay={60}>
          <TouchableOpacity style={[styles.actionCard, { backgroundColor: theme.surface }]} onPress={() => navigation.navigate('Referral')}>
            <View style={[styles.actionIcon, { backgroundColor: `${theme.primary}20` }]}>
              <Ionicons name="gift-outline" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Refer a Friend</Text>
              <Text style={[styles.actionSub, { color: theme.textMuted }]}>Earn 50 points for every friend who joins ZannyPay</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        </FadeInView>

        <FadeInView delay={120}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: theme.surface }]}
            onPress={() => navigation.navigate('KYC')}
            disabled={(user?.kycTier || 1) >= 2}
          >
            <View style={[styles.actionIcon, { backgroundColor: `${theme.success}20` }]}>
              <Ionicons name="shield-checkmark-outline" size={22} color={theme.success} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.actionTitle, { color: theme.text }]}>Verify Your Identity</Text>
              <Text style={[styles.actionSub, { color: theme.textMuted }]}>
                {(user?.kycTier || 1) >= 2 ? 'Completed — 100 points earned' : 'One-time 100 point bonus for Tier 2 verification'}
              </Text>
            </View>
            {(user?.kycTier || 1) >= 2 ? (
              <Ionicons name="checkmark-circle" size={20} color={theme.success} />
            ) : (
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            )}
          </TouchableOpacity>
        </FadeInView>

        <Text style={[styles.footnote, { color: theme.textMuted }]}>
          Points are earned through real account activity and never expire.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  scrollContainer: { paddingHorizontal: 20 },
  heroCard: { borderRadius: 20, padding: 24, marginBottom: 24 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, gap: 4 },
  streakText: { fontSize: 12, fontWeight: '700', color: '#1A1523' },
  tierLabel: { fontSize: 14, fontWeight: '700', color: '#1A1523', marginLeft: 8 },
  pointsValue: { fontSize: 36, fontWeight: '800', color: '#1A1523', marginBottom: 14 },
  pts: { fontSize: 16, fontWeight: '700' },
  nextTierText: { fontSize: 12, color: 'rgba(26,21,35,0.7)', marginTop: 10, marginBottom: 18 },
  claimBtn: { backgroundColor: '#1A1523', paddingVertical: 14, borderRadius: 25, alignItems: 'center' },
  claimBtnDisabled: { backgroundColor: 'rgba(26,21,35,0.15)' },
  claimBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  claimBtnTextDisabled: { color: 'rgba(26,21,35,0.5)' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
  actionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 16, marginBottom: 12 },
  actionIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '700' },
  actionSub: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  footnote: { fontSize: 11, textAlign: 'center', marginTop: 10, lineHeight: 16 },
});
