import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import { gradients } from '../theme/colors';
import { apiPost } from '../services/apiClient';
import GradientButton from '../components/GradientButton';
import FadeInView from '../components/FadeInView';

const TIERS = [
  { tier: 1, label: 'Basic', limit: '₦50,000 daily', perks: ['Send & receive money', 'Pay bills & buy airtime'] },
  { tier: 2, label: 'Verified', limit: '₦1,000,000 daily', perks: ['Higher transfer limits', 'Access to Flexi Credit', 'Priority support'] },
];

// How long a revealed BVN/NIN stays visible before auto-re-masking. This is
// deliberately short — the reveal exists for the one moment someone needs
// to read the number out or copy it, not to leave a national ID number
// sitting on screen.
const REVEAL_AUTO_HIDE_MS = 15000;

function maskedId(last4) {
  return last4 ? `••• ••• •${last4}` : 'Not provided';
}

export default function KYCScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { user, updateProfile } = useWallet();

  const kycTier = user?.kycTier || 1;
  const kycStatus = user?.kycStatus || 'unverified';
  const isPending = kycStatus === 'pending';
  const isRejected = kycStatus === 'rejected';

  const [bvn, setBvn] = useState('');
  const [nin, setNin] = useState('');
  const [nextOfKinName, setNextOfKinName] = useState(user?.nextOfKinName || '');
  const [nextOfKinPhone, setNextOfKinPhone] = useState(user?.nextOfKinPhone || '');
  const [saving, setSaving] = useState(false);

  // Reveal-with-PIN state
  const [revealModal, setRevealModal] = useState(null); // 'bvn' | 'nin' | null
  const [revealPin, setRevealPin] = useState('');
  const [revealing, setRevealing] = useState(false);
  const [revealedValue, setRevealedValue] = useState(null); // { field, value } while shown

  const handleSubmit = async () => {
    if (bvn.length !== 11) {
      alert('BVN Required', 'Please enter your full 11-digit BVN.', null, { type: 'warning' });
      return;
    }
    if (nin.length !== 11) {
      alert('NIN Required', 'Please enter your full 11-digit NIN.', null, { type: 'warning' });
      return;
    }
    if (!nextOfKinName.trim() || !nextOfKinPhone.trim()) {
      alert('Next of Kin Required', "Please provide your next of kin's name and phone number.", null, { type: 'warning' });
      return;
    }

    setSaving(true);
    const res = await updateProfile({
      bvn,
      nin,
      nextOfKinName: nextOfKinName.trim(),
      nextOfKinPhone: nextOfKinPhone.trim(),
    });
    setSaving(false);

    if (!res.ok) {
      alert('Could Not Submit', res.error, null, { type: 'error' });
      return;
    }
    // Clear the plaintext values from this screen's own memory the moment
    // they've been sent — nothing left sitting in local state once
    // they're safely encrypted server-side.
    setBvn('');
    setNin('');
    alert(
      'Verification Submitted',
      "Your details have been sent for review. This usually takes 24-48 hours — you'll see your Tier 2 upgrade and reward points here as soon as it's approved.",
      [{ text: 'Got it', onPress: () => navigation.goBack() }],
      { type: 'success' }
    );
  };

  const openReveal = (field) => {
    setRevealModal(field);
    setRevealPin('');
  };

  const confirmReveal = async () => {
    if (revealPin.length !== 4) return;
    setRevealing(true);
    try {
      const res = await apiPost('/user/kyc/reveal', { field: revealModal, pin: revealPin });
      setRevealedValue({ field: revealModal, value: res.value });
      setRevealModal(null);
      setRevealPin('');
      // Auto re-mask after a short window — this is meant to be glanced at
      // or copied, not left on screen.
      setTimeout(() => setRevealedValue((current) => (current?.field === res.field ? null : current)), REVEAL_AUTO_HIDE_MS);
    } catch (err) {
      alert('Could Not Reveal', err.message || 'Incorrect PIN.', null, { type: 'error' });
    } finally {
      setRevealing(false);
    }
  };

  const copyRevealed = async () => {
    if (!revealedValue) return;
    await Clipboard.setStringAsync(revealedValue.value);
    alert('Copied', `Your ${revealedValue.field.toUpperCase()} has been copied. It will clear from your clipboard the next time you copy something else.`, null, { type: 'info' });
  };

  const hasSubmittedIdentity = !!(user?.bvnLast4 || user?.ninLast4);

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
                ? 'Your account has full access to ZannyPay features.'
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

        {/* Once BVN/NIN has been submitted, show the masked values with a
            PIN-gated reveal — regardless of tier/pending state, since this
            is about viewing what's already on file, not resubmitting it. */}
        {hasSubmittedIdentity && (
          <FadeInView delay={120}>
            <View style={[styles.formCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.formTitle, { color: theme.text }]}>Your ID Numbers on File</Text>
              <Text style={[styles.hint, { color: theme.textMuted, marginBottom: 14 }]}>
                Hidden by default. Viewing the full number requires your transaction PIN.
              </Text>

              {['bvn', 'nin'].map((field) => {
                const last4 = field === 'bvn' ? user?.bvnLast4 : user?.ninLast4;
                if (!last4) return null;
                const isRevealed = revealedValue?.field === field;
                return (
                  <View key={field} style={[styles.idRow, { borderColor: theme.border }]}>
                    <View>
                      <Text style={[styles.idLabel, { color: theme.textMuted }]}>{field.toUpperCase()}</Text>
                      <Text style={[styles.idValue, { color: theme.text }]}>
                        {isRevealed ? revealedValue.value : maskedId(last4)}
                      </Text>
                    </View>
                    {isRevealed ? (
                      <TouchableOpacity onPress={copyRevealed} style={styles.idActionBtn}>
                        <Ionicons name="copy-outline" size={16} color={theme.primary} />
                        <Text style={[styles.idActionText, { color: theme.primary }]}>Copy</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => openReveal(field)} style={styles.idActionBtn}>
                        <Ionicons name="eye-outline" size={16} color={theme.primary} />
                        <Text style={[styles.idActionText, { color: theme.primary }]}>View</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </FadeInView>
        )}

        {kycTier < 2 && !isPending && (
          <FadeInView delay={160}>
            <View style={[styles.formCard, { backgroundColor: theme.surface }]}>
              <Text style={[styles.formTitle, { color: theme.text }]}>Complete Your Verification</Text>

              <Text style={[styles.label, { color: theme.textMuted }]}>BVN (Bank Verification Number)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="11-digit BVN"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                maxLength={11}
                secureTextEntry
                value={bvn}
                onChangeText={(v) => setBvn(v.replace(/[^0-9]/g, ''))}
              />

              <Text style={[styles.label, { color: theme.textMuted }]}>NIN (National Identification Number)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                placeholder="11-digit NIN"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                maxLength={11}
                secureTextEntry
                value={nin}
                onChangeText={(v) => setNin(v.replace(/[^0-9]/g, ''))}
              />
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Your BVN and NIN are encrypted before they're stored. Once submitted, viewing them again always requires your transaction PIN — even for you.
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

      <Modal visible={!!revealModal} transparent animationType="fade" onRequestClose={() => setRevealModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Enter Your PIN</Text>
            <Text style={[styles.hint, { color: theme.textMuted, textAlign: 'center', marginBottom: 20 }]}>
              Confirm your transaction PIN to view your full {revealModal?.toUpperCase()}.
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, textAlign: 'center', fontSize: 24, letterSpacing: 8 }]}
              placeholder="••••"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              autoFocus
              value={revealPin}
              onChangeText={setRevealPin}
            />
            <GradientButton title="Confirm" onPress={confirmReveal} loading={revealing} style={{ marginTop: 20 }} />
            <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => setRevealModal(null)}>
              <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  formCard: { borderRadius: 18, padding: 20, marginTop: 6, marginBottom: 14 },
  formTitle: { fontSize: 15, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1 },
  hint: { fontSize: 11, marginTop: 8, lineHeight: 16 },
  idRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  idLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  idValue: { fontSize: 15, fontWeight: '600', marginTop: 3, fontVariant: ['tabular-nums'] },
  idActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  idActionText: { fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
});
