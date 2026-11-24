import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { apiGet } from '../services/apiClient';

const INTEGRATIONS = [
  { key: 'phoneOtp', title: 'Phone OTP delivery', icon: 'chatbubble-ellipses-outline' },
  { key: 'emailVerification', title: 'Email verification', icon: 'mail-outline' },
  { key: 'bankAccountNameVerification', title: 'Bank account verification', icon: 'business-outline' },
  { key: 'externalBankPayouts', title: 'External bank payouts', icon: 'swap-horizontal-outline' },
  { key: 'bvnNinAndLiveness', title: 'BVN, NIN & liveness checks', icon: 'shield-checkmark-outline' },
  { key: 'virtualCardIssuing', title: 'Virtual card issuing', icon: 'card-outline' },
  { key: 'airtimeDataAndBills', title: 'Airtime, data & bills', icon: 'phone-portrait-outline' },
  { key: 'loans', title: 'Lending & credit', icon: 'wallet-outline' },
  { key: 'savingsInterest', title: 'Savings interest', icon: 'trending-up-outline' },
];

function getStatusMeta(status) {
  if (status === 'configured') {
    return { label: 'Configured · test required', color: '#168A62' };
  }
  if (status === 'missing_credentials') {
    return { label: 'Needs configuration', color: '#B7791F' };
  }
  if (status === 'not_integrated') {
    return { label: 'Not integrated', color: '#8A929D' };
  }
  return { label: 'Status unavailable', color: '#8A929D' };
}

export default function ServiceStatusScreen({ navigation }) {
  const { theme } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiGet('/system/integrations/status');
      setData(result);
    } catch (err) {
      setError(err?.message || 'Could not load service availability.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6, marginRight: 12 }}>
          <Ionicons name="arrow-back" size={23} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>Service availability</Text>
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 3 }}>ZannyPay integration readiness</Text>
        </View>
        <TouchableOpacity onPress={loadStatus} disabled={loading} style={{ padding: 8 }}>
          <Ionicons name="refresh" size={21} color={loading ? theme.textMuted : theme.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}>
        <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: 16, padding: 16, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="information-circle-outline" size={19} color={theme.primary} />
            <Text style={{ color: theme.text, fontWeight: '700', marginLeft: 8 }}>What these statuses mean</Text>
          </View>
          <Text style={{ color: theme.textMuted, lineHeight: 19, fontSize: 13 }}>
            Configuration status only. “Configured” does not prove provider approval, successful delivery, or live transaction capability. We only mark a service ready after its real-world checks pass.
          </Text>
        </View>

        {loading && !data ? (
          <View style={{ alignItems: 'center', paddingVertical: 36 }}>
            <ActivityIndicator color={theme.primary} />
            <Text style={{ color: theme.textMuted, marginTop: 12 }}>Checking service status…</Text>
          </View>
        ) : error && !data ? (
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, padding: 18 }}>
            <Ionicons name="cloud-offline-outline" size={28} color={theme.textMuted} />
            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16, marginTop: 12 }}>Status not available</Text>
            <Text style={{ color: theme.textMuted, lineHeight: 20, marginTop: 6 }}>{error}</Text>
            <TouchableOpacity onPress={loadStatus} style={{ marginTop: 16, alignSelf: 'flex-start' }}>
              <Text style={{ color: theme.primary, fontWeight: '700' }}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 16 }}>
            {INTEGRATIONS.map((item, index) => {
              const status = data?.integrations?.[item.key];
              const meta = getStatusMeta(status?.status);
              return (
                <View
                  key={item.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    paddingVertical: 16,
                    borderBottomWidth: index === INTEGRATIONS.length - 1 ? 0 : 1,
                    borderBottomColor: theme.border,
                  }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: theme.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name={item.icon} size={18} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: 14 }}>{item.title}</Text>
                    <Text style={{ color: meta.color, fontSize: 12, fontWeight: '700', marginTop: 4 }}>{meta.label}</Text>
                    {status?.note ? (
                      <Text style={{ color: theme.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5 }}>{status.note}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
