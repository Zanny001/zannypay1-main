import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, Share, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import QRCode from 'react-native-qrcode-svg';
import { colors } from '../theme/colors';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import { maskAccount } from '../utils/format';
import GradientButton from '../components/GradientButton';
import FadeInView from '../components/FadeInView';
import { haptic } from '../theme/motion';

const isValidZannyPayPayload = (payload) => {
  if (!payload || typeof payload !== 'object' || payload.app !== 'ZannyPay') return false;
  if (typeof payload.account !== 'string' || !/^\d{10,11}$/.test(payload.account)) return false;
  if (payload.name !== undefined && typeof payload.name !== 'string') return false;
  if (payload.amount !== undefined && payload.amount !== null) {
    if (typeof payload.amount !== 'number' || !Number.isFinite(payload.amount) || payload.amount <= 0) {
      return false;
    }
  }
  return true;
};

function MyCodeTab({ user }) {
  const accountNumber = user?.accountNumber || user?.phone || null;
  const [requestAmount, setRequestAmount] = useState('');
  const pulse = useRef(new Animated.Value(0)).current;
  const codeCardRef = useRef(null);
  const amountValue = requestAmount.trim() ? Number(requestAmount) : null;
  const amountIsValid = amountValue === null || (Number.isFinite(amountValue) && amountValue > 0);

  const qrPayload = JSON.stringify({
    app: 'ZannyPay',
    account: accountNumber || '',
    name: user?.name || 'ZannyPay Member',
    amount: amountValue,
  });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });

  const handleShare = async () => {
    if (!accountNumber || !/^\d{10,11}$/.test(accountNumber) || !amountIsValid) {
      return;
    }
    try {
      const uri = await captureRef(codeCardRef.current, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share my ZannyPay QR code',
        });
        return;
      }
    } catch (e) {
      // Fall back to a text share if image capture or native sharing is unavailable.
    }

    const amountLine = amountValue ? `\nRequested Amount: ₦${amountValue}` : '';
    await Share.share({
      message: `Pay ${user?.name || 'ZannyPay User'}\nAccount: ${accountNumber}${amountLine}\n\nOpen ZannyPay and send to this account number.`,
    });
  };

  return (
    <FadeInView style={styles.scroll}>
      <View style={styles.codeWrap}>
        <Animated.View style={[styles.glow, { transform: [{ scale: glowScale }], opacity: glowOpacity }]} />
        <View ref={codeCardRef} collapsable={false} style={styles.codeCard}>
          {accountNumber && /^\d{10,11}$/.test(accountNumber) ? (
            <QRCode value={qrPayload} size={180} color={colors.textDark} backgroundColor="white" />
          ) : (
            <View style={styles.qrUnavailable}>
              <Ionicons name="qr-code-outline" size={56} color={colors.textMuted} />
              <Text style={styles.codeCaption}>Your account code is not available yet</Text>
            </View>
          )}
          <Text style={styles.codeCaption}>Scan to pay instantly</Text>
        </View>
      </View>

      <View style={styles.identityBlock}>
        <Text style={styles.name}>{user?.name || 'ZannyPay Member'}</Text>
        <Text style={styles.account}>{accountNumber ? maskAccount(accountNumber) : 'Account pending'} · ZannyPay</Text>
      </View>

      <View style={styles.requestBlock}>
        <Text style={styles.label}>Request a specific amount (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="₦0.00"
          keyboardType="decimal-pad"
          value={requestAmount}
          onChangeText={(value) => setRequestAmount(value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
        />
        {!amountIsValid && <Text style={styles.validationText}>Enter a valid amount greater than zero.</Text>}
      </View>

      <GradientButton
        title="Share My QR Code"
        onPress={handleShare}
        disabled={!accountNumber || !/^\d{10,11}$/.test(accountNumber) || !amountIsValid}
        style={{ marginTop: 24 }}
      />
    </FadeInView>
  );
}

function ScanTab({ navigation, ownIdentifiers }) {
  const { alert } = useAlert();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarcodeScanned = useCallback(
    ({ data }) => {
      if (scanned) return;
      setScanned(true);
      haptic.medium();

      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        parsed = null;
      }

      if (!isValidZannyPayPayload(parsed)) {
        alert('Not a ZannyPay Code', "This QR code isn't a valid ZannyPay payment code.", [
          { text: 'Try Again', onPress: () => setScanned(false) },
        ]);
        return;
      }

      if (ownIdentifiers.includes(parsed.account)) {
        alert('That’s Your Own Code', "You can't pay yourself — share this code with someone else instead.", [
          { text: 'OK', onPress: () => setScanned(false) },
        ]);
        return;
      }

      navigation.navigate('Transfer', {
        prefillAccount: parsed.account,
        ...(parsed.amount !== null && parsed.amount !== undefined ? { prefillAmount: String(parsed.amount) } : {}),
      });
    },
    [scanned, ownIdentifiers, navigation, alert]
  );

  if (!permission) {
    return <View style={styles.scanContainer} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.scanContainer, styles.permissionState]}>
        <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionBody}>ZannyPay needs your camera to scan a Pay QR code.</Text>
        <GradientButton title="Enable Camera" onPress={requestPermission} style={{ marginTop: 20, width: '100%' }} />
      </View>
    );
  }

  return (
    <View style={styles.scanContainer}>
      <View style={styles.cameraFrame}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View style={styles.scanCorners} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>
      <Text style={styles.scanHint}>Line up the QR code within the frame</Text>
    </View>
  );
}

export default function QRPayScreen({ navigation }) {
  const { user } = useWallet();
  const [activeTab, setActiveTab] = useState('mycode');
  const ownIdentifiers = [user?.accountNumber, user?.phone].filter(Boolean).map(String);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Zanny Code</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'mycode' && styles.tabBtnActive]}
          onPress={() => setActiveTab('mycode')}
        >
          <Text style={[styles.tabText, activeTab === 'mycode' && styles.tabTextActive]}>My Code</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'scan' && styles.tabBtnActive]}
          onPress={() => setActiveTab('scan')}
        >
          <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>Scan to Pay</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'mycode' ? (
        <MyCodeTab user={user} />
      ) : (
        <ScanTab navigation={navigation} ownIdentifiers={ownIdentifiers} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.textDark },
  tabBar: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 14, padding: 4, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  tabTextActive: { color: '#fff' },
  scroll: { padding: 24, alignItems: 'center' },
  codeWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 24 },
  glow: { position: 'absolute', width: 240, height: 240, borderRadius: 28, backgroundColor: colors.primary },
  codeCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  codeCaption: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 16, textAlign: 'center' },
  qrUnavailable: { width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  validationText: { color: '#C62828', fontSize: 12, marginTop: 6 },
  identityBlock: { alignItems: 'center', marginBottom: 20 },
  name: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  account: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  requestBlock: { width: '100%', marginTop: 10 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textDark, marginBottom: 8 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: colors.border, color: colors.textDark, width: '100%' },
  scanContainer: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  cameraFrame: { width: '100%', aspectRatio: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000' },
  scanCorners: { ...StyleSheet.absoluteFillObject },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: colors.accent, borderWidth: 4 },
  cornerTL: { top: 24, left: 24, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 24, right: 24, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 24, left: 24, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 24, right: 24, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanHint: { marginTop: 20, fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  permissionState: { backgroundColor: '#fff', borderRadius: 20, padding: 30 },
  permissionTitle: { fontSize: 16, fontWeight: '700', color: colors.textDark, marginTop: 14 },
  permissionBody: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});
