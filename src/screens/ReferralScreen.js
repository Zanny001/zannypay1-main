import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import { gradients } from '../theme/colors';
import { formatDate } from '../utils/format';
import Avatar from '../components/Avatar';
import FadeInView from '../components/FadeInView';

export default function ReferralScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { referrals, fetchReferrals, fetchLeaderboard } = useWallet();
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [myRank, setMyRank] = useState(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([
        fetchReferrals(),
        fetchLeaderboard().then((res) => {
          if (res.ok) {
            setLeaderboard(res.data.leaderboard || []);
            setRecentActivity(res.data.recentActivity || []);
            setMyRank(res.data.myRank);
          }
        }),
      ]).finally(() => setLoading(false));
    }, [fetchReferrals, fetchLeaderboard])
  );

  const handleCopy = async () => {
    if (!referrals.referralCode) return;
    await Clipboard.setStringAsync(referrals.referralCode);
    alert('Copied', 'Referral code copied to clipboard.', null, { type: 'success' });
  };

  const handleShare = async () => {
    if (!referrals.referralCode) return;
    try {
      await Share.share({
        message: `Join me on ZannyPay! Use my referral code ${referrals.referralCode} when you sign up. Fast, secure payments made simple. 💜`,
      });
    } catch (error) {
      // share sheet dismissed — nothing to do
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Refer & Earn</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <FadeInView>
          <LinearGradient colors={gradients.gold} style={styles.heroCard}>
            <Ionicons name="gift" size={30} color="#1A1523" />
            <Text style={styles.heroTitle}>Invite friends to ZannyPay</Text>
            <Text style={styles.heroSub}>Share your code — when they sign up, they'll be linked to you as your referral.</Text>

            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{referrals.referralCode || '········'}</Text>
              <TouchableOpacity onPress={handleCopy}>
                <Ionicons name="copy-outline" size={20} color="#1A1523" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={16} color="#fff" />
              <Text style={styles.shareBtnText}>Share Invite</Text>
            </TouchableOpacity>
          </LinearGradient>
        </FadeInView>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.statValue, { color: theme.text }]}>{referrals.totalReferred}</Text>
            <Text style={[styles.statLabel, { color: theme.textMuted }]}>Friends Joined</Text>
          </View>
          {myRank && (
            <View style={[styles.statCard, { backgroundColor: theme.surface, marginLeft: 12 }]}>
              <Text style={[styles.statValue, { color: theme.text }]}>#{myRank}</Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>Your Rank</Text>
            </View>
          )}
        </View>

        {leaderboard.length > 0 && (
          <>
            <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Top Referrers</Text>
            <View style={[styles.leaderboardCard, { backgroundColor: theme.surface }]}>
              {leaderboard.map((entry, idx) => (
                <View key={entry.id} style={[styles.leaderboardRow, idx < leaderboard.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                  <Text style={[styles.leaderboardRank, { color: idx < 3 ? theme.accent : theme.textMuted }]}>{idx + 1}</Text>
                  <Text style={[styles.leaderboardName, { color: theme.text }]}>{entry.name}</Text>
                  <Text style={[styles.leaderboardCount, { color: theme.primary }]}>{entry.count} joined</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {recentActivity.length > 0 && (
          <>
            <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Recent Activity</Text>
            <View style={[styles.activityCard, { backgroundColor: theme.surface }]}>
              {recentActivity.slice(0, 5).map((entry, idx) => (
                <View key={idx} style={[styles.activityRow, idx < Math.min(recentActivity.length, 5) - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                  <Ionicons name="person-add" size={14} color={theme.success} />
                  <Text style={[styles.activityText, { color: theme.text }]}>
                    <Text style={{ fontWeight: '700' }}>{entry.name}</Text> joined via a referral
                  </Text>
                  <Text style={[styles.activityTime, { color: theme.textMuted }]}>{formatDate(entry.joinedAt)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>People You've Referred</Text>
        {!loading && referrals.referred.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
            <Ionicons name="people-outline" size={28} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Nobody has signed up with your code yet. Share it to start earning rewards perks.
            </Text>
          </View>
        ) : (
          referrals.referred.map((person, idx) => (
            <FadeInView key={person.id} delay={idx * 50}>
              <View style={[styles.personRow, { backgroundColor: theme.surface }]}>
                <Avatar uri={person.profileImage} name={person.name} size={40} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[styles.personName, { color: theme.text }]}>{person.name}</Text>
                  <Text style={[styles.personDate, { color: theme.textMuted }]}>Joined {formatDate(person.createdAt)}</Text>
                </View>
              </View>
            </FadeInView>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  heroCard: { borderRadius: 20, padding: 24, marginBottom: 16 },
  heroTitle: { color: '#1A1523', fontSize: 19, fontWeight: '800', marginTop: 12 },
  heroSub: { color: 'rgba(26,21,35,0.75)', fontSize: 13, marginTop: 8, marginBottom: 20, lineHeight: 19 },
  codeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16, marginBottom: 16 },
  codeText: { fontSize: 22, fontWeight: '800', color: '#1A1523', letterSpacing: 3 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1523', paddingVertical: 14, borderRadius: 14 },
  shareBtnText: { color: '#fff', fontWeight: '700', marginLeft: 8 },
  statsRow: { flexDirection: 'row', marginBottom: 20 },
  statCard: { flex: 1, borderRadius: 16, padding: 18, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 4 },
  sectionHeading: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 },
  leaderboardCard: { borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  leaderboardRank: { width: 22, fontSize: 14, fontWeight: '800' },
  leaderboardName: { flex: 1, fontSize: 13, fontWeight: '600' },
  leaderboardCount: { fontSize: 12, fontWeight: '700' },
  activityCard: { borderRadius: 16, marginBottom: 20, overflow: 'hidden' },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  activityText: { flex: 1, fontSize: 12 },
  activityTime: { fontSize: 10 },
  emptyCard: { borderRadius: 16, padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 19 },
  personRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 10 },
  personName: { fontSize: 14, fontWeight: '700' },
  personDate: { fontSize: 11, marginTop: 2 },
});
