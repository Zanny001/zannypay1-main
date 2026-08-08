import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import { gradients } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import GradientButton from '../components/GradientButton';
import FadeInView from '../components/FadeInView';
import AnimatedNumber from '../components/AnimatedNumber';
import Skeleton from '../components/Skeleton';

export default function BusinessScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { activateBusiness, fetchBusinessProfile } = useWallet();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null); // null while not activated
  const [businessName, setBusinessName] = useState('');
  const [activating, setActivating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      fetchBusinessProfile().then((res) => {
        if (cancelled) return;
        if (res.ok) setProfile(res.data);
        setLoading(false);
      });
      return () => { cancelled = true; };
    }, [fetchBusinessProfile])
  );

  const handleActivate = async () => {
    if (businessName.trim().length < 2) {
      alert('Business Name Required', 'Please enter your business name.', null, { type: 'warning' });
      return;
    }
    setActivating(true);
    const res = await activateBusiness(businessName.trim());
    setActivating(false);
    if (!res.ok) {
      alert('Could Not Activate', res.error, null, { type: 'error' });
      return;
    }
    const refreshed = await fetchBusinessProfile();
    if (refreshed.ok) setProfile(refreshed.data);
  };

  const copyAccountNumber = async () => {
    await Clipboard.setStringAsync(profile.businessAccountNumber);
    alert('Copied', 'Business account number copied to clipboard.', null, { type: 'info' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>ZannyPay Business</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <>
            <Skeleton width="100%" height={140} radius={20} style={{ marginBottom: 20 }} />
            <Skeleton width="100%" height={100} radius={16} />
          </>
        ) : profile ? (
          <>
            <FadeInView>
              <LinearGradient colors={gradients.primary} style={styles.revenueCard}>
                <Text style={styles.revenueLabel}>Today's Received</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <AnimatedNumber value={profile.todayReceived} format={(n) => formatCurrency(n)} style={styles.revenueValue} />
                </View>
                <Text style={styles.revenueSub}>{profile.todayTransactionCount} transaction{profile.todayTransactionCount === 1 ? '' : 's'}</Text>
              </LinearGradient>
            </FadeInView>

            <FadeInView delay={100}>
              <View style={[styles.card, { backgroundColor: theme.surface }]}>
                <Text style={[styles.cardLabel, { color: theme.textMuted }]}>Total Received</Text>
                <Text style={[styles.cardValue, { color: theme.text }]}>{formatCurrency(profile.totalReceived)}</Text>
              </View>
            </FadeInView>

            <FadeInView delay={160}>
              <View style={[styles.card, { backgroundColor: theme.surface, marginTop: 14 }]}>
                <Text style={[styles.cardLabel, { color: theme.textMuted }]}>{profile.businessName}</Text>
                <TouchableOpacity style={styles.accountRow} onPress={copyAccountNumber}>
                  <Text style={[styles.accountNumber, { color: theme.text }]}>{profile.businessAccountNumber}</Text>
                  <Ionicons name="copy-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
                <Text style={[styles.hint, { color: theme.textMuted }]}>
                  Share this number to get paid directly — funds arrive in the same wallet as your personal balance.
                </Text>
              </View>
            </FadeInView>

            <FadeInView delay={220}>
              <TouchableOpacity style={[styles.invoiceLink, { backgroundColor: theme.surface }]} onPress={() => navigation.navigate('Invoice')}>
                <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                <Text style={[styles.invoiceLinkText, { color: theme.text }]}>Create an Invoice</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </FadeInView>
          </>
        ) : (
          <FadeInView>
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: theme.surfaceAlt }]}>
                <Ionicons name="storefront-outline" size={32} color={theme.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>Get Paid for Your Business</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                Activate a dedicated business account number — separate from your personal one, same wallet — and start tracking what you receive.
              </Text>

              <Text style={[styles.label, { color: theme.text }]}>Business Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder="e.g. Ada's Bakery"
                placeholderTextColor={theme.textMuted}
                value={businessName}
                onChangeText={setBusinessName}
              />

              <GradientButton title="Activate ZannyPay Business" onPress={handleActivate} loading={activating} style={{ marginTop: 20 }} />
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
  revenueCard: { borderRadius: 20, padding: 22, marginBottom: 14 },
  revenueLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  revenueValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 6 },
  revenueSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 6 },
  card: { borderRadius: 16, padding: 18 },
  cardLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  cardValue: { fontSize: 22, fontWeight: '800' },
  accountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  accountNumber: { fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  hint: { fontSize: 11, marginTop: 10, lineHeight: 16 },
  invoiceLink: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginTop: 14, gap: 12 },
  invoiceLinkText: { flex: 1, fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 20 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 24, paddingHorizontal: 10 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, alignSelf: 'flex-start' },
  input: { width: '100%', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1 },
});
