import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GradientButton from '../components/GradientButton';
import { colors, gradients } from '../theme/colors';
import { fonts } from '../theme/fonts';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';

const STEPS = ['Your Details', 'Secure Your Account', 'Almost Done'];

export default function SignupScreen({ navigation }) {
  const { alert } = useAlert();
  const { signup } = useWallet();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [step, fadeAnim, slideAnim]);

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const goNext = () => {
    if (step === 0) {
      if (!name.trim()) {
        alert('Name required', 'Please enter your full name.', null, { type: 'warning' });
        return;
      }
      if (!phone.trim() || phone.trim().length < 10) {
        alert('Phone required', 'Please enter a valid phone number.', null, { type: 'warning' });
        return;
      }
      // The backend stores email as a required, unique column, so a valid
      // address is mandatory for account creation to succeed.
      if (!email || !isValidEmail(email)) {
        alert('Email required', 'Please enter a valid email address.', null, { type: 'warning' });
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (pin.length !== 4) {
        alert('PIN required', 'Create a 4-digit transaction PIN.', null, { type: 'warning' });
        return;
      }
      if (pin !== confirmPin) {
        alert("PINs don't match", 'Please make sure both PINs are identical.', null, { type: 'warning' });
        return;
      }
      setStep(2);
      return;
    }
  };

  const goBack = () => {
    if (step === 0) {
      navigation.replace('Login');
      return;
    }
    setStep(step - 1);
  };

  const handleSignup = async () => {
    setLoading(true);
    const res = await signup({ name, email, phone, pin, referredByCode: referralCode });
    setLoading(false);
    if (!res.ok) {
      alert('Sign up failed', res.error || 'Something went wrong. Please try again.', null, { type: 'error' });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={gradients.dark} style={styles.heroBackdrop}>
          <View style={styles.heroContent}>
            <TouchableOpacity onPress={goBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandMarkText}>Z</Text>
              </View>
              <Text style={styles.brandName}>Zannypay</Text>
            </View>

            <View style={styles.progressRow}>
              {STEPS.map((label, idx) => (
                <View key={label} style={styles.progressItem}>
                  <View style={[styles.progressDot, idx <= step && styles.progressDotActive]}>
                    {idx < step ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : (
                      <Text style={[styles.progressDotText, idx <= step && styles.progressDotTextActive]}>{idx + 1}</Text>
                    )}
                  </View>
                  {idx < STEPS.length - 1 && <View style={[styles.progressLine, idx < step && styles.progressLineActive]} />}
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <Text style={styles.stepTitle}>{STEPS[step]}</Text>

            {step === 0 && (
              <>
                <Text style={styles.stepSubtitle}>Let's get your account set up — it takes less than a minute.</Text>

                <View style={styles.inputWrap}>
                  <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />
                </View>
                <View style={styles.inputWrap}>
                  <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={colors.textMuted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                </View>
                <View style={styles.inputWrap}>
                  <Ionicons name="call-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="Phone number" placeholderTextColor={colors.textMuted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={11} />
                </View>
              </>
            )}

            {step === 1 && (
              <>
                <Text style={styles.stepSubtitle}>Choose a 4-digit PIN. You'll use this to confirm every transaction.</Text>

                <View style={styles.inputWrap}>
                  <Ionicons name="keypad-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.pinInput]}
                    placeholder="Create PIN"
                    placeholderTextColor={colors.textMuted}
                    value={pin}
                    onChangeText={setPin}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
                <View style={styles.inputWrap}>
                  <Ionicons name="checkmark-done-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.pinInput]}
                    placeholder="Confirm PIN"
                    placeholderTextColor={colors.textMuted}
                    value={confirmPin}
                    onChangeText={setConfirmPin}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>

                <View style={styles.pinDotsPreview}>
                  {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={[styles.previewDot, pin.length > i && styles.previewDotFilled]} />
                  ))}
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.stepSubtitle}>Have a referral code? Add it below to help a friend earn rewards.</Text>

                <View style={styles.inputWrap}>
                  <Ionicons name="gift-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Referral code (optional)"
                    placeholderTextColor={colors.textMuted}
                    value={referralCode}
                    onChangeText={setReferralCode}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Name</Text>
                    <Text style={styles.summaryValue}>{name}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Phone</Text>
                    <Text style={styles.summaryValue}>{phone}</Text>
                  </View>
                  <View style={[styles.summaryRow, { marginBottom: 0 }]}>
                    <Text style={styles.summaryLabel}>Email</Text>
                    <Text style={styles.summaryValue}>{email}</Text>
                  </View>
                </View>
              </>
            )}
          </Animated.View>

          <GradientButton
            title={step === 2 ? 'Create Account' : 'Continue'}
            onPress={step === 2 ? handleSignup : goNext}
            loading={loading}
            style={{ marginTop: 28 }}
          />

          {step === 0 && (
            <TouchableOpacity style={styles.loginLink} onPress={() => navigation.replace('Login')}>
              <Text style={styles.loginText}>
                Already have an account? <Text style={styles.loginTextBold}>Log in</Text>
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight },
  heroBackdrop: { paddingTop: 10, paddingBottom: 30, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  heroContent: { paddingHorizontal: 24 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 24 },
  brandMark: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  brandMarkText: { color: '#fff', fontFamily: fonts.extraBold, fontSize: 16 },
  brandName: { color: '#fff', fontFamily: fonts.bold, fontSize: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  progressItem: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  progressDot: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  progressDotActive: { backgroundColor: colors.accent },
  progressDotText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: fonts.bold },
  progressDotTextActive: { color: '#1A1523' },
  progressLine: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },
  progressLineActive: { backgroundColor: colors.accent },

  sheet: { padding: 24, paddingTop: 28 },
  stepTitle: { fontSize: 22, fontFamily: fonts.extraBold, color: colors.textDark },
  stepSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 6, marginBottom: 24, lineHeight: 19 },

  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, marginBottom: 14 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 15, fontSize: 15, color: colors.textDark },
  pinInput: { letterSpacing: 6, fontFamily: fonts.bold },

  pinDotsPreview: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  previewDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: colors.primary, marginHorizontal: 6 },
  previewDotFilled: { backgroundColor: colors.primary },

  summaryCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 18, marginTop: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontSize: 12, color: colors.textMuted },
  summaryValue: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.textDark },

  loginLink: { marginTop: 24, alignItems: 'center' },
  loginText: { color: colors.textMuted, fontSize: 14 },
  loginTextBold: { color: colors.primary, fontFamily: fonts.bold },
});
