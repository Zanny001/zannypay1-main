import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import { gradients } from '../theme/colors';
import GradientButton from '../components/GradientButton';
import FadeInView from '../components/FadeInView';

const TIERS = [
  { tier: 1, label: 'Basic', limit: '₦50,000 daily', perks: ['Send & receive money', 'Pay bills & buy airtime'] },
  { tier: 2, label: 'Verified', limit: '₦1,000,000 daily', perks: ['Higher transfer limits', 'Access to Flexi Credit', 'Priority support'] },
];

export default function KYCScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { user, updateProfile } = useWallet();

  const kycTier = user?.kycTier || 1;
  const kycStatus = user?.kycStatus || 'unverified';
  const isPending = kycStatus === 'pending';
  const isRejected = kycStatus === 'rejected';
  const [bvn, setBvn] = useState('');
  const [nextOfKinName, setNextOfKinName] = useState(user?.nextOfKinName || '');
  const [nextOfKinPhone, setNextOfKinPhone] = useState(user?.nextOfKinPhone || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (bvn.length !== 4) {
      alert('BVN Required', 'Please enter the last 4 digits of your BVN.', null, { type: 'warning' });
      return;
    }
    if (!nextOfKinName.trim() || !nextOfKinPhone.trim()) {
      alert('Next of Kin Required', "Please provide your next of kin's name and phone number.", null, { type: 'warning' });
      return;
    }

    setSaving(true);
    const res = await updateProfile({
      bvn,
      nextOfKinName: nextOfKinName.trim(),
      nextOfKinPhone: nextOfKinPhone.trim(),
    });
    setSaving(false);

    if (!res.ok) {
      alert('Could Not Submit', res.error, null, { type: 'error' });
      return;
    }
    alert(
      'Verification Submitted',
      "Your details have been sent for review. This usually takes 24-48 hours — you'll see your Tier 2 upgrade and reward points here as soon as it's approved.",
      [{ text: 'Got it', onPress: () => navigation.goBack() }],
      { type: 'success' }
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Identity Verification</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <FadeInView>
          <LinearGradient colors={gradients.primary} style={styles.heroCard}>
            <Ionicons name="shield-checkmark" size={30} color="#fff" />
            <Text style={styles.heroTitle}>
              {kycTier >= 2 ? "You're Verified" : isPending ? 'Verification Pending' : 'Unlock Tier 2'}
            </Text>
            <Text style={styles.heroSub}>
              {kycTier >= 2
                ? 'Your account has full access to Zannypay features.'
                : isPending
                ? "We're reviewing your details — this usually takes 24-48 hours."
                : isRejected
                ? `Your last submission wasn't approved${user?.kycRejectionReason ? `: ${user.kycRejectionReason}` : '.'} You can submit again below.`
                : 'Verify your identity to raise your limits and unlock Flexi Credit.'}
            </Text>
          </LinearGradient>
        </FadeInView>

        {TIERS.map((t, idx) => (
          <FadeInView key={t.tier} delay={idx * 80}>
            <View style={[styles.tierCard, { backgroundColor: theme.surface, borderColor: kycTier === t.tier ? theme.primary : theme.border }]}>
              <View style={styles.tierTopRow}>
                <Text style={[styles.tierName, { color: theme.text }]}>Tier {t.tier} · {t.label}</Text>
                {kycTier >= t.tier && (
                  <View style={[styles.activeBadge, { backgroundColor: `${theme.success}20` }]}>
                    <Text style={[styles.activeBadgeText, { color: theme.success }]}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tierLimit, { color: theme.textMuted }]}>{t.limit}</Text>
              {t.perks.map((perk) => (
                <View key={perk} style={styles.perkRow}>
                  <Ionicons name="checkmark-circle" size={15} color={theme.primary} />
                  <Text style={[styles.perkText, { color: theme.text }]}>{perk}</Text>
                </View>
              ))}
            </View>
          </FadeInView>
        ))}

        {kycTier < 2 && !isPending && (
          <FadeInView delay={160}>
            <View style={[styles.formCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.formTitle, { color: theme.text }]}>Complete Your Verification</Text>

              <Text style={[styles.label, { color: theme.textMuted }]}>Last 4 digits of your BVN</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="••••"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                value={bvn}
                onChangeText={setBvn}
              />
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                We never ask for your full BVN — only the last 4 digits, for lightweight identity confirmation.
              </Text>

              <Text style={[styles.label, { color: theme.textMuted }]}>Next of Kin Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="Full name"
                placeholderTextColor={theme.textMuted}
                value={nextOfKinName}
                onChangeText={setNextOfKinName}
              />

              <Text style={[styles.label, { color: theme.textMuted }]}>Next of Kin Phone</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="Phone number"
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
                value={nextOfKinPhone}
                onChangeText={setNextOfKinPhone}
              />

              <GradientButton title="Submit Verification" onPress={handleSubmit} loading={saving} style={{ marginTop: 20 }} />
            </View>
          </FadeInView>
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
  heroCard: { borderRadius: 20, padding: 24, marginBottom: 20 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 12 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 8, lineHeight: 19 },
  tierCard: { borderRadius: 18, borderWidth: 1.5, padding: 18, marginBottom: 14 },
  tierTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  tierName: { fontSize: 15, fontWeight: '700' },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeBadgeText: { fontSize: 11, fontWeight: '700' },
  tierLimit: { fontSize: 12, marginBottom: 12 },
  perkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  perkText: { fontSize: 12, marginLeft: 8 },
  formCard: { borderRadius: 18, padding: 20, marginTop: 6 },
  formTitle: { fontSize: 15, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1 },
  hint: { fontSize: 11, marginTop: 8, lineHeight: 16 },
});
