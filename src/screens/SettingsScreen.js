import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch, Platform, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { BiometricAuth } from '../services/biometricAuth';
import { loadJSON, saveJSON } from '../utils/storage';
import GradientButton from '../components/GradientButton';
import { useAlert } from '../context/AlertContext';

const PUSH_NOTES_KEY = 'zannypay:pushNotesEnabled';

const APPEARANCE_OPTIONS = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

export default function SettingsScreen({ navigation }) {
  const { alert } = useAlert();
  const { theme, mode, setMode } = useTheme();
  const { user, changePin, token } = useWallet();

  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [hasHardware, setHasHardware] = useState(false);
  const [pushNotes, setPushNotes] = useState(true);

  const [changePinVisible, setChangePinVisible] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      setHasHardware(compatible);
      if (user?.phone) {
        setBiometricsEnabled(await BiometricAuth.isEnabledFor(user.phone));
      }
      const savedPushPref = await loadJSON(PUSH_NOTES_KEY, true);
      setPushNotes(savedPushPref);
    })();
  }, [user?.phone]);

  const handleTogglePush = async (value) => {
    setPushNotes(value);
    await saveJSON(PUSH_NOTES_KEY, value);
  };

  const handleToggleBiometrics = async (newValue) => {
    if (newValue) {
      if (!user?.phone || !token) {
        alert('Error', 'You need an active session to enable biometric login.');
        setBiometricsEnabled(false);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable Biometric Login for ZannyPay',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) {
        // Enrollment stores the CURRENT session token, not the PIN — the
        // PIN is never asked for or cached here. See services/
        // biometricAuth.js for why this matters.
        await BiometricAuth.enroll(user.phone, token);
        setBiometricsEnabled(true);
        alert('Success', 'Biometric login is now enabled.');
      } else {
        setBiometricsEnabled(false);
        alert('Authentication Failed', 'We could not verify your identity.');
      }
    } else {
      if (user?.phone) await BiometricAuth.clearFor(user.phone);
      setBiometricsEnabled(false);
    }
  };

  const handleChangePin = async () => {
    if (oldPin.length !== 4 || newPin.length !== 4) {
      alert('Invalid PIN', 'PINs must be exactly 4 digits.');
      return;
    }
    if (newPin !== confirmPin) {
      alert('PINs do not match', 'Double-check your new PIN and try again.');
      return;
    }
    setPinLoading(true);
    const res = await changePin(oldPin, newPin);
    setPinLoading(false);

    if (!res.ok) {
      alert('Could not change PIN', res.error);
      return;
    }
    setChangePinVisible(false);
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    alert('PIN Updated', 'Your transaction PIN has been changed successfully.');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Appearance</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          <View style={styles.appearanceRow}>
            {APPEARANCE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.appearanceOption,
                  { borderColor: theme.border },
                  mode === opt.value && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => setMode(opt.value)}
              >
                <Ionicons name={opt.icon} size={20} color={mode === opt.value ? '#fff' : theme.text} />
                <Text style={[styles.appearanceLabel, { color: mode === opt.value ? '#fff' : theme.text }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Security</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          {hasHardware && (
            <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
              <View style={styles.rowLeft}>
                <Ionicons name={Platform.OS === 'ios' ? 'faceid' : 'finger-print-outline'} size={20} color={theme.primary} />
                <Text style={[styles.menuLabel, { color: theme.text }]}>Biometric Login</Text>
              </View>
              <Switch value={biometricsEnabled} onValueChange={handleToggleBiometrics} trackColor={{ true: theme.primary, false: theme.border }} />
            </View>
          )}
          <TouchableOpacity style={[styles.clickableMenu, { borderBottomWidth: 0 }]} onPress={() => setChangePinVisible(true)}>
            <Ionicons name="keypad-outline" size={20} color={theme.primary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Change Transaction PIN</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Services</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          <TouchableOpacity
            style={[styles.clickableMenu, { borderBottomWidth: 0 }]}
            onPress={() => navigation.navigate('ServiceStatus')}
          >
            <Ionicons name="pulse-outline" size={20} color={theme.primary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.menuLabel, { color: theme.text }]}>Service availability</Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 3 }}>
                See which payment and verification services are connected
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionHeading, { color: theme.textMuted }]}>Notifications</Text>
        <View style={[styles.cardGroup, { backgroundColor: theme.surface }]}>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLeft}>
              <Ionicons name="notifications-outline" size={20} color={theme.primary} />
              <Text style={[styles.menuLabel, { color: theme.text }]}>Push Alerts</Text>
            </View>
            <Switch value={pushNotes} onValueChange={handleTogglePush} trackColor={{ true: theme.primary, false: theme.border }} />
          </View>
        </View>

        <Text style={[styles.footerText, { color: theme.textMuted }]}>ZannyPay v2.1.0</Text>
        <Text style={[styles.footerCopyright, { color: theme.textMuted }]}>© {new Date().getFullYear()} ZannyPay. All rights reserved.</Text>
      </ScrollView>

      {/* Change Transaction PIN */}
      <Modal visible={changePinVisible} transparent animationType="slide" onRequestClose={() => setChangePinVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Change PIN</Text>
            <Text style={[styles.label, { color: theme.textMuted }]}>Current PIN</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              placeholder="••••"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              value={oldPin}
              onChangeText={setOldPin}
            />
            <Text style={[styles.label, { color: theme.textMuted }]}>New PIN</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              placeholder="••••"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              value={newPin}
              onChangeText={setNewPin}
            />
            <Text style={[styles.label, { color: theme.textMuted }]}>Confirm New PIN</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
              placeholder="••••"
              placeholderTextColor={theme.textMuted}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              value={confirmPin}
              onChangeText={setConfirmPin}
            />
            <GradientButton title="Update PIN" onPress={handleChangePin} loading={pinLoading} style={{ marginTop: 20 }} />
            <TouchableOpacity style={{ marginTop: 16, alignItems: 'center' }} onPress={() => setChangePinVisible(false)}>
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
  headerTitle: { fontSize: 20, fontWeight: '800' },
  sectionHeading: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 8, marginTop: 10 },
  cardGroup: { marginHorizontal: 20, borderRadius: 16, paddingVertical: 4, marginBottom: 15 },
  appearanceRow: { flexDirection: 'row', padding: 12 },
  appearanceOption: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, marginHorizontal: 4 },
  appearanceLabel: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  clickableMenu: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1 },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  menuLabel: { fontSize: 14, fontWeight: '500', marginLeft: 12 },
  footerText: { textAlign: 'center', fontSize: 11, marginTop: 16 },
  footerCopyright: { textAlign: 'center', fontSize: 10, marginTop: 4, opacity: 0.7 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, letterSpacing: 4, textAlign: 'center', borderWidth: 1 },
});
