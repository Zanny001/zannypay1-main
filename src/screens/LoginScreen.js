import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { colors, gradients } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { useWallet } from '../context/WalletContext';
import { BiometricAuth } from '../services/biometricAuth';
import { useAlert } from '../context/AlertContext';

export default function LoginScreen({ navigation }) {
  const { alert } = useAlert();
  const { user, login, loginWithBiometricToken } = useWallet();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const dotScales = useRef([0, 1, 2, 3].map(() => new Animated.Value(1))).current;

  const bumpDot = (index) => {
    Animated.sequence([
      Animated.timing(dotScales[index], { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.spring(dotScales[index], { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  const shakeDots = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleKeyPress = (digit) => {
    if (pin.length >= 4 || loading) return;
    bumpDot(pin.length);
    setPin((prev) => prev + digit);
  };

  const handleDelete = () => {
    if (loading) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const handleBiometricAuth = async () => {
    if (Platform.OS === 'web') {
      alert('Not Available', 'Biometric login only works on the iOS/Android app, not in a browser.', null, { type: 'info' });
      return;
    }
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return alert('Error', 'Biometrics not supported on this device.', null, { type: 'error' });

    const savedPhone = phone.trim() || (await BiometricAuth.getSavedPhone());
    if (!savedPhone) {
      alert('Not Set Up', 'Enable Biometric Login from Settings after your first PIN login.', null, { type: 'info' });
      return;
    }
    const savedToken = await BiometricAuth.getTokenForPhone(savedPhone);
    if (!savedToken) {
      alert('Not Set Up', 'Enable Biometric Login from Settings after your first PIN login.', null, { type: 'info' });
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Login to Zannypay',
      fallbackLabel: 'Use PIN',
    });
    if (!result.success) return;

    // Restores the session directly from the saved token — the PIN is
    // never recovered, shown, or resubmitted anywhere in this flow.
    setLoading(true);
    try {
      const res = await loginWithBiometricToken(savedToken);
      if (!res.ok) {
        alert('Session Expired', res.error || 'Please log in with your PIN.', null, { type: 'info' });
      } else if (!phone.trim()) {
        setPhone(savedPhone);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === 4) {
      if (!phone.trim()) {
        alert('Missing Info', 'Please enter your phone number first.', null, { type: 'warning' });
        setPin('');
        return;
      }

      const triggerLogin = async () => {
        setLoading(true);
        try {
          const res = await login(phone, pin);
          if (res && res.ok === false) {
            alert('Login failed', res.error || 'Invalid credentials', null, { type: 'error' });
            shakeDots();
            setPin('');
          }
        } catch (error) {
          alert('Login Error', error.message || 'Something went wrong.', null, { type: 'error' });
          shakeDots();
          setPin('');
        } finally {
          setLoading(false);
        }
      };

      triggerLogin();
    }
  }, [pin, phone, login, alert, shakeDots]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={gradients.dark} style={styles.heroBackdrop}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>Z</Text>
        </View>
        <Text style={styles.welcome}>Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</Text>
        <Text style={styles.subtitle}>Enter your phone number and PIN to continue</Text>
      </LinearGradient>

      <View style={styles.sheet}>
        <View style={styles.inputWrap}>
          <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Phone Number (e.g. 08012345678)"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={15}
            editable={!loading}
          />
        </View>

        <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
          {[0, 1, 2, 3].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                pin.length > i && styles.dotFilled,
                { transform: [{ scale: dotScales[i] }] },
              ]}
            />
          ))}
        </Animated.View>

        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'].map((key, i) => {
            if (key === 'bio') {
              return (
                <TouchableOpacity key={i} style={styles.key} onPress={handleBiometricAuth} disabled={loading}>
                  <View style={styles.keyCircle}>
                    <Ionicons name={Platform.OS === 'ios' ? 'scan-outline' : 'finger-print'} size={26} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              );
            }
            if (key === 'del') {
              return (
                <TouchableOpacity key={i} style={styles.key} onPress={handleDelete} disabled={loading}>
                  <View style={styles.keyCircle}>
                    <Ionicons name="backspace-outline" size={24} color={colors.textDark} />
                  </View>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity key={i} style={styles.key} onPress={() => handleKeyPress(key)} disabled={loading} activeOpacity={0.6}>
                <View style={styles.keyCircle}>
                  <Text style={styles.keyText}>{key}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.signupLink} onPress={() => navigation.replace('Signup')}>
          <Text style={styles.signupText}>
            No account yet? <Text style={styles.signupTextBold}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
  heroBackdrop: { alignItems: 'center', paddingTop: 20, paddingBottom: 36, paddingHorizontal: 24, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  brandMark: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  brandMarkText: { color: '#fff', fontFamily: fonts.extraBold, fontSize: 22 },
  welcome: { fontSize: 21, fontFamily: fonts.extraBold, color: '#fff', textAlign: 'center' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 8, textAlign: 'center' },

  sheet: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, marginBottom: 28 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 15, color: colors.textDark },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 32 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.primary, marginHorizontal: 8 },
  dotFilled: { backgroundColor: colors.primary },

  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  key: { width: '30%', aspectRatio: 1.3, alignItems: 'center', justifyContent: 'center' },
  keyCircle: {
    width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  keyText: { fontSize: 24, fontFamily: fonts.semiBold, color: colors.textDark },

  signupLink: { marginTop: 12, alignSelf: 'center' },
  signupText: { color: colors.textMuted, fontSize: 14 },
  signupTextBold: { color: colors.primary, fontFamily: fonts.bold },
});
