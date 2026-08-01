import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { getLoginActivity } from '../utils/loginActivity';
import { formatDate } from '../utils/format';
import FadeInView from '../components/FadeInView';

export default function SecurityScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useWallet();
  const [activity, setActivity] = useState([]);

  useFocusEffect(
    useCallback(() => {
      getLoginActivity().then(setActivity);
    }, [])
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Security Center</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <FadeInView>
          <View style={[styles.currentDeviceCard, { backgroundColor: theme.surface }]}>
            <View style={[styles.shieldWrap, { backgroundColor: `${theme.success}20` }]}>
              <Ionicons name="shield-checkmark" size={26} color={theme.success} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.deviceTitle, { color: theme.text }]}>This Device</Text>
              <Text style={[styles.deviceSub, { color: theme.textMuted }]}>
                {Platform.OS === 'ios' ? 'iPhone' : 'Android device'} · Active now
              </Text>
            </View>
            <View style={[styles.activeBadge, { backgroundColor: `${theme.success}20` }]}>
              <Text style={[styles.activeBadgeText, { color: theme.success }]}>Active</Text>
            </View>
          </View>
        </FadeInView>

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Account Protections</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          <View style={[styles.row, { borderBottomColor: theme.border }]}>
            <Ionicons name="key-outline" size={20} color={theme.primary} />
            <Text style={[styles.rowLabel, { color: theme.text }]}>Transaction PIN</Text>
            <TouchableOpacity style={styles.rowAction} onPress={() => navigation.navigate('Settings')}>
              <Text style={[styles.rowActionText, { color: theme.primary }]}>Change</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 0 }]} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="finger-print-outline" size={20} color={theme.primary} />
            <Text style={[styles.rowLabel, { color: theme.text }]}>Biometric Login</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} style={styles.rowAction} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Recent Login Activity</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          {activity.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No recent activity recorded on this device yet.</Text>
          ) : (
            activity.map((entry, idx) => (
              <View key={entry.id} style={[styles.activityRow, idx !== activity.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                <Ionicons name="log-in-outline" size={18} color={theme.textMuted} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[styles.activityDevice, { color: theme.text }]}>{entry.device}</Text>
                  <Text style={[styles.activityTime, { color: theme.textMuted }]}>{formatDate(entry.timestamp)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
        <Text style={[styles.footnote, { color: theme.textMuted }]}>
          This activity log is stored only on this device and reflects logins made from it.
        </Text>

        <TouchableOpacity style={[styles.reportBtn, { backgroundColor: `${theme.danger}15` }]} onPress={() => navigation.navigate('Support')}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
          <Text style={[styles.reportBtnText, { color: theme.danger }]}>Report Suspicious Activity</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  currentDeviceCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, borderRadius: 18, padding: 16, marginBottom: 20 },
  shieldWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  deviceTitle: { fontSize: 15, fontWeight: '700' },
  deviceSub: { fontSize: 12, marginTop: 2 },
  activeBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  activeBadgeText: { fontSize: 11, fontWeight: '700' },
  sectionHeading: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 8, marginTop: 6 },
  cardGroup: { marginHorizontal: 20, borderRadius: 16, paddingVertical: 4, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 16, borderBottomWidth: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600', marginLeft: 12, flex: 1 },
  rowAction: { marginLeft: 'auto' },
  rowActionText: { fontSize: 13, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  activityRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  activityDevice: { fontSize: 13, fontWeight: '600' },
  activityTime: { fontSize: 11, marginTop: 2 },
  footnote: { fontSize: 11, paddingHorizontal: 20, marginTop: 4, marginBottom: 24, lineHeight: 16 },
  reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, paddingVertical: 15, borderRadius: 14 },
  reportBtnText: { fontWeight: '700', marginLeft: 8 },
});
