import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '../context/AlertContext';

// NOT currently reachable from anywhere in AppNavigator — confirmed dead
// code as of the last audit. Left in place for future development, but
// hard-gated behind __DEV__ directly in this component (not just by
// omission from the navigator) as defense in depth: everything here is
// mock data — `apiKey` is a client-generated random hex string, not a
// real credential from any backend, and "Generate New Key" doesn't call
// any API. If this is ever wired into navigation without reading this
// comment first, it must NOT ship to production as-is: real API keys
// need to be backend-issued, scoped, revocable, and only ever shown once
// at creation time — never a value the client can invent for itself.
export default function DeveloperConsoleScreen({ navigation }) {
  const { alert } = useAlert();
  const [logs, setLogs] = useState([
    { time: '00:10:01', method: 'GET', path: '/api/v1/wallet/balance', status: 200 },
    { time: '00:10:02', method: 'POST', path: '/api/v1/auth/verify-otp', status: 200 }
  ]);
  const [apiKey, setApiKey] = useState('sk_live_••••••••••••••••••••');

  // Hooks stay unconditional above this line (rules-of-hooks) even though
  // __DEV__ never actually changes within a running app — the guard
  // itself just needs to run before any of this mock data is rendered.
  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="lock-closed-outline" size={32} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, marginTop: 12, textAlign: 'center' }}>
            This screen isn't available in this build.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const generateNewKey = () => {
    const randomHex = [...Array(24)].map(() => Math.floor(Math.random()*16).toString(16)).join('');
    setApiKey(`sk_live_${randomHex}`);
    
    setLogs(prev => [
      ...prev,
      { time: new Date().toTimeString().split(' ')[0], method: 'POST', path: '/api/v1/dev/keys/generate', status: 201 }
    ]);
    alert('API Key Generated', 'Your new production secret token has been provisioned successfully.');
  };

  const clearLogs = () => setLogs([]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <View style={styles.header}>
          <Text style={styles.title}>Developer Engine</Text>
          <Text style={styles.subtitle}>Mobile core sandbox instrumentation</Text>
        </View>

        <Text style={styles.sectionTitle}>Production API Credentials</Text>
        <View style={styles.keyBox}>
          <Text style={styles.keyText}>{apiKey}</Text>
          <TouchableOpacity onPress={generateNewKey} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.terminalHeader}>
          <Text style={styles.sectionTitle}>Live Webhook & Request Logs</Text>
          <TouchableOpacity onPress={clearLogs}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Terminal Window Graphic Component */}
        <View style={styles.terminal}>
          {logs.length === 0 ? (
            <Text style={styles.terminalGhost}>Listening for inbound connection objects...</Text>
          ) : (
            logs.map((log, index) => (
              <View key={index} style={styles.logRow}>
                <Text style={styles.logTime}>[{log.time}]</Text>
                <Text style={[styles.logMethod, { color: log.method === 'POST' ? '#00C2FF' : '#F5B700' }]}>{log.method}</Text>
                <Text style={styles.logPath}>{log.path}</Text>
                <Text style={[styles.logStatus, { color: log.status >= 200 && log.status < 300 ? '#00FF66' : '#FF3B30' }]}>{log.status}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
  scroll: { padding: 20 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  header: { marginBottom: 24, marginTop: 4 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textDark },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  keyBox: { backgroundColor: '#fff', borderRadius: 12, borderHorizontal: 1, borderColor: colors.border, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, borderWidth: 1 },
  keyText: { fontFamily: 'monospace', fontSize: 13, color: colors.textDark },
  refreshBtn: { backgroundColor: colors.primary, width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  terminalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clearText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  terminal: { backgroundColor: '#111', borderRadius: 14, padding: 16, minHeight: 220, fontFamily: 'monospace' },
  terminalGhost: { color: '#666', fontFamily: 'monospace', fontSize: 12, fontStyle: 'italic' },
  logRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'center' },
  logTime: { color: '#555', fontFamily: 'monospace', fontSize: 12, marginRight: 6 },
  logMethod: { fontWeight: '700', fontFamily: 'monospace', fontSize: 12, width: 45 },
  logPath: { color: '#EEE', fontFamily: 'monospace', fontSize: 12, flex: 1, paddingHorizontal: 4 },
  logStatus: { fontFamily: 'monospace', fontSize: 12, fontWeight: '600' }
});
