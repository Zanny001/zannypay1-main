import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import Avatar from '../components/Avatar';
import GradientButton from '../components/GradientButton';

function InfoRow({ theme, icon, label, value, copyable, onCopy, isLast }) {
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }, isLast && { borderBottomWidth: 0 }]}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={theme.primary} />
        <View style={{ marginLeft: 12 }}>
          <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{label}</Text>
          <Text style={[styles.rowValue, { color: theme.text }]}>{value || 'Not set'}</Text>
        </View>
      </View>
      {copyable && value ? (
        <TouchableOpacity onPress={onCopy}>
          <Ionicons name="copy-outline" size={18} color={theme.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function formatDOB(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ProfileInfoScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { user } = useWallet();

  const copy = async (value, label) => {
    await Clipboard.setStringAsync(value);
    alert('Copied', `${label} copied to clipboard.`, null, { type: 'success' });
  };

  const kycTier = user?.kycTier || 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Profile Details</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.avatarWrap}>
          <Avatar uri={user?.profileImage} name={user?.name} size={96} fontSize={36} />
          <Text style={[styles.name, { color: theme.text }]}>{user?.name || 'Zannypay Member'}</Text>
          <TouchableOpacity style={[styles.tierPill, { backgroundColor: kycTier >= 2 ? `${theme.success}20` : `${theme.warning}20` }]} onPress={() => navigation.navigate('KYC')}>
            <Ionicons name="shield-checkmark" size={13} color={kycTier >= 2 ? theme.success : theme.warning} />
            <Text style={[styles.tierPillText, { color: kycTier >= 2 ? theme.success : theme.warning }]}>
              Tier {kycTier} {kycTier >= 2 ? '· Verified' : user?.kycStatus === 'pending' ? '· Under Review' : '· Verify to upgrade'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>How people can pay you</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          <InfoRow theme={theme} icon="wallet-outline" label="Account Number" value={user?.accountNumber} copyable onCopy={() => copy(user.accountNumber, 'Account number')} />
          <InfoRow theme={theme} icon="call-outline" label="Phone Number (also works as an account number)" value={user?.phone} copyable onCopy={() => copy(user.phone, 'Phone number')} isLast />
        </View>

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Personal Information</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          <InfoRow theme={theme} icon="person-outline" label="Full Name" value={user?.name} />
          <InfoRow theme={theme} icon="mail-outline" label="Email Address" value={user?.email} />
          <InfoRow theme={theme} icon="calendar-outline" label="Date of Birth" value={formatDOB(user?.dateOfBirth)} />
          <InfoRow theme={theme} icon="male-female-outline" label="Gender" value={user?.gender} />
          <InfoRow theme={theme} icon="briefcase-outline" label="Occupation" value={user?.occupation} />
          <InfoRow theme={theme} icon="flag-outline" label="Nationality" value={user?.nationality} />
          <InfoRow theme={theme} icon="heart-outline" label="Marital Status" value={user?.maritalStatus} />
          <InfoRow theme={theme} icon="location-outline" label="Address" value={user?.address} isLast />
        </View>

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Identity & Next of Kin</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          <InfoRow theme={theme} icon="finger-print-outline" label="BVN" value={user?.bvn ? `••••••${user.bvn}` : null} />
          <InfoRow theme={theme} icon="person-add-outline" label="Next of Kin" value={user?.nextOfKinName} />
          <InfoRow theme={theme} icon="call-outline" label="Next of Kin Phone" value={user?.nextOfKinPhone} isLast />
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 10, gap: 12 }}>
          <GradientButton title="Edit Profile" onPress={() => navigation.navigate('ProfileInfoForm')} />
          {kycTier < 2 && (
            <TouchableOpacity style={[styles.verifyBtn, { borderColor: theme.primary }]} onPress={() => navigation.navigate('KYC')}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.primary} />
              <Text style={[styles.verifyBtnText, { color: theme.primary }]}>Complete Identity Verification</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  name: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  tierPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginTop: 10 },
  tierPillText: { fontSize: 11, fontWeight: '700', marginLeft: 6 },
  sectionHeading: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 8, marginTop: 10 },
  cardGroup: { marginHorizontal: 20, borderRadius: 16, paddingVertical: 4, marginBottom: 15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowLabel: { fontSize: 11, fontWeight: '600' },
  rowValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  verifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 14, borderWidth: 1.5 },
  verifyBtnText: { fontWeight: '700', marginLeft: 8 },
});
