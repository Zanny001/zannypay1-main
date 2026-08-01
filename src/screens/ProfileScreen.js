import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import Avatar from '../components/Avatar';
import { useAlert } from '../context/AlertContext';

export default function ProfileScreen() {
  const { alert } = useAlert();
  const { theme } = useTheme();
  const { user, logout } = useWallet();
  const navigation = useNavigation();

  const handleLogout = () => {
    alert('Secure Logout', 'Are you sure you want to end this session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  const copyAccountNumber = async () => {
    if (!user?.accountNumber) return;
    await Clipboard.setStringAsync(user.accountNumber);
    alert('Copied', 'Account number copied to clipboard.');
  };

  const copyPhone = async () => {
    if (!user?.phone) return;
    await Clipboard.setStringAsync(user.phone);
    alert('Copied', 'Phone number copied to clipboard.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Modern 'Me' Header */}
        <TouchableOpacity style={styles.header} activeOpacity={0.8} onPress={() => navigation.navigate('ProfileInfo')}>
          <Avatar uri={user?.profileImage} name={user?.name} size={64} />
          <View style={styles.headerTextWrap}>
            <Text style={[styles.name, { color: theme.text }]}>{user?.name || 'Zannypay Member'}</Text>
            <View style={styles.tierBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#00C48C" />
              <Text style={styles.tierText}>Verified · Tier {user?.kycTier || 1}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TouchableOpacity style={[styles.qrBtn, { backgroundColor: theme.surface }]} onPress={() => navigation.navigate('QRPay')}>
            <Ionicons name="qr-code" size={20} color={theme.text} />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Account Number & Phone — both work as a transfer destination */}
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          <TouchableOpacity style={[styles.settingRow, { borderBottomColor: theme.border }]} onPress={copyAccountNumber}>
            <View style={styles.rowLeft}>
              <Ionicons name="wallet-outline" size={20} color={theme.primary} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.smallLabel, { color: theme.textMuted }]}>Account Number</Text>
                <Text style={[styles.bigValue, { color: theme.text }]}>{user?.accountNumber || '—'}</Text>
              </View>
            </View>
            <Ionicons name="copy-outline" size={18} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingRow, { borderBottomWidth: 0 }]} onPress={copyPhone}>
            <View style={styles.rowLeft}>
              <Ionicons name="call-outline" size={20} color={theme.primary} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.smallLabel, { color: theme.textMuted }]}>Phone Number (also works as your account number)</Text>
                <Text style={[styles.bigValue, { color: theme.text }]}>{user?.phone || '—'}</Text>
              </View>
            </View>
            <Ionicons name="copy-outline" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Account</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('ProfileInfo')}>
            <Ionicons name="person-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Profile Details</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Settings</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomWidth: 0 }]} onPress={() => navigation.navigate('Security')}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Security Center</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Verification</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomWidth: 0 }]} onPress={() => navigation.navigate('KYC')}>
            <Ionicons name="finger-print-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Identity Verification</Text>
            <View style={[styles.tierBadgeSmall, { backgroundColor: (user?.kycTier || 1) >= 2 ? `${theme.success}20` : `${theme.warning}20` }]}>
              <Text style={[styles.tierBadgeSmallText, { color: (user?.kycTier || 1) >= 2 ? theme.success : theme.warning }]}>Tier {user?.kycTier || 1}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Features</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Beneficiaries')}>
            <Ionicons name="people-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Saved Recipients</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Referral')}>
            <Ionicons name="gift-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Refer & Earn</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Cards')}>
            <Ionicons name="card-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Zanny Cards</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Invoice')}>
            <Ionicons name="document-text-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Create Invoice</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Insights')}>
            <Ionicons name="stats-chart-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Insights & Analytics</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Budget')}>
            <Ionicons name="wallet-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Spending Budgets</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomWidth: 0 }]} onPress={() => navigation.navigate('Statement')}>
            <Ionicons name="document-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Account Statement</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Support</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Support')}>
            <Ionicons name="help-circle-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Help Center</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomWidth: 0 }]} onPress={() => navigation.navigate('Disputes')}>
            <Ionicons name="shield-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>My Disputes</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#FF4B4B" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={[styles.footerText, { color: theme.textMuted }]}>Secured by Zannypay · v2.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20, marginTop: 10 },
  headerTextWrap: { flex: 1, marginLeft: 16 },
  name: { fontSize: 18, fontWeight: '700' },
  tierBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 196, 140, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  tierText: { fontSize: 11, color: '#00C48C', fontWeight: '600', marginLeft: 4 },
  qrBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  smallLabel: { fontSize: 11, fontWeight: '600' },
  bigValue: { fontSize: 16, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },

  sectionHeading: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 8, marginTop: 10 },
  cardGroup: { marginHorizontal: 20, borderRadius: 16, paddingVertical: 4, marginBottom: 15 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  clickableMenu: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  menuLabel: { fontSize: 14, fontWeight: '500', marginLeft: 12, flex: 1 },
  tierBadgeSmall: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tierBadgeSmallText: { fontSize: 11, fontWeight: '700' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, paddingVertical: 16, borderRadius: 14, backgroundColor: 'rgba(255, 75, 75, 0.1)', marginTop: 20 },
  logoutText: { color: '#FF4B4B', fontWeight: '700', marginLeft: 8 },
  footerText: { textAlign: 'center', fontSize: 11, marginTop: 16, marginBottom: 40 },
});
