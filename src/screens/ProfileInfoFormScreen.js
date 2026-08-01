import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useWallet } from '../context/WalletContext';
import { useAlert } from '../context/AlertContext';
import Avatar from '../components/Avatar';
import GradientButton from '../components/GradientButton';

const GENDERS = ['Male', 'Female', 'Prefer not to say'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed', 'Prefer not to say'];

function parseDOB(iso) {
  if (!iso) return { day: '', month: '', year: '' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { day: '', month: '', year: '' };
  return { day: String(d.getDate()), month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
}

export default function ProfileInfoFormScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const { user, updateProfile } = useWallet();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState(user?.address || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || null);

  const initialDOB = parseDOB(user?.dateOfBirth);
  const [dobDay, setDobDay] = useState(initialDOB.day);
  const [dobMonth, setDobMonth] = useState(initialDOB.month);
  const [dobYear, setDobYear] = useState(initialDOB.year);

  const [gender, setGender] = useState(user?.gender || '');
  const [occupation, setOccupation] = useState(user?.occupation || '');
  const [nationality, setNationality] = useState(user?.nationality || '');
  const [maritalStatus, setMaritalStatus] = useState(user?.maritalStatus || '');

  const [saving, setSaving] = useState(false);

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert('Permission needed', 'Please allow photo library access to update your profile picture.', null, { type: 'warning' });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.4,
      base64: true,
    });

    if (!result.canceled && result.assets?.[0]?.base64) {
      const asset = result.assets[0];
      const mime = asset.mimeType || 'image/jpeg';
      setProfileImage(`data:${mime};base64,${asset.base64}`);
    }
  };

  const buildDOBIso = () => {
    if (!dobDay || !dobMonth || !dobYear) return undefined;
    const day = dobDay.padStart(2, '0');
    const month = dobMonth.padStart(2, '0');
    if (dobYear.length !== 4) return undefined;
    return `${dobYear}-${month}-${day}T00:00:00.000Z`;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Name required', 'Please enter your full name.', null, { type: 'warning' });
      return;
    }
    if (!email.trim() || !isValidEmail(email)) {
      alert('Invalid email', 'Please enter a valid email address.', null, { type: 'warning' });
      return;
    }

    const dobIso = buildDOBIso();
    if ((dobDay || dobMonth || dobYear) && !dobIso) {
      alert('Invalid Date of Birth', 'Please complete day, month, and a 4-digit year, or leave all three blank.', null, { type: 'warning' });
      return;
    }

    setSaving(true);
    const res = await updateProfile({
      name: name.trim(),
      email: email.trim(),
      address: address.trim(),
      profileImage,
      ...(dobIso ? { dateOfBirth: dobIso } : {}),
      ...(gender ? { gender } : {}),
      ...(occupation.trim() ? { occupation: occupation.trim() } : {}),
      ...(nationality.trim() ? { nationality: nationality.trim() } : {}),
      ...(maritalStatus ? { maritalStatus } : {}),
    });
    setSaving(false);

    if (!res.ok) {
      alert('Could not save', res.error, null, { type: 'error' });
      return;
    }
    alert('Profile Updated', 'Your changes have been saved.', [
      { text: 'Done', onPress: () => navigation.goBack() },
    ], { type: 'success' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <View style={styles.avatarWrap}>
          <Avatar uri={profileImage} name={name} size={100} fontSize={38} />
          <TouchableOpacity style={[styles.changePhotoBtn, { backgroundColor: theme.primary }]} onPress={handlePickImage}>
            <Ionicons name="camera" size={16} color="#fff" />
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Basic Information</Text>

        <Text style={[styles.label, { color: theme.textMuted }]}>Full Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Your full name"
          placeholderTextColor={theme.textMuted}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.label, { color: theme.textMuted }]}>Email Address</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="you@example.com"
          placeholderTextColor={theme.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={[styles.label, { color: theme.textMuted }]}>Address</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="Street, City, State"
          placeholderTextColor={theme.textMuted}
          value={address}
          onChangeText={setAddress}
        />

        <Text style={[styles.label, { color: theme.textMuted }]}>Phone Number</Text>
        <View style={[styles.input, styles.disabledInput, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Text style={{ color: theme.textMuted }}>{user?.phone}</Text>
        </View>
        <Text style={[styles.hint, { color: theme.textMuted }]}>
          Your phone number is your login ID and doubles as your account number for transfers, so it can't be changed here.
        </Text>

        <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 24 }]}>About You</Text>

        <Text style={[styles.label, { color: theme.textMuted }]}>Date of Birth</Text>
        <View style={styles.dobRow}>
          <TextInput
            style={[styles.input, styles.dobInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="DD"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            maxLength={2}
            value={dobDay}
            onChangeText={setDobDay}
          />
          <TextInput
            style={[styles.input, styles.dobInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="MM"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            maxLength={2}
            value={dobMonth}
            onChangeText={setDobMonth}
          />
          <TextInput
            style={[styles.input, styles.dobInputYear, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
            placeholder="YYYY"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            maxLength={4}
            value={dobYear}
            onChangeText={setDobYear}
          />
        </View>

        <Text style={[styles.label, { color: theme.textMuted }]}>Gender</Text>
        <View style={styles.chipsRow}>
          {GENDERS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.chip, { borderColor: theme.border }, gender === g && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setGender(gender === g ? '' : g)}
            >
              <Text style={[styles.chipText, { color: theme.text }, gender === g && { color: '#fff' }]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { color: theme.textMuted }]}>Occupation</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="e.g. Software Engineer"
          placeholderTextColor={theme.textMuted}
          value={occupation}
          onChangeText={setOccupation}
        />

        <Text style={[styles.label, { color: theme.textMuted }]}>Nationality</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
          placeholder="e.g. Nigerian"
          placeholderTextColor={theme.textMuted}
          value={nationality}
          onChangeText={setNationality}
        />

        <Text style={[styles.label, { color: theme.textMuted }]}>Marital Status</Text>
        <View style={styles.chipsRow}>
          {MARITAL_STATUSES.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.chip, { borderColor: theme.border }, maritalStatus === m && { backgroundColor: theme.primary, borderColor: theme.primary }]}
              onPress={() => setMaritalStatus(maritalStatus === m ? '' : m)}
            >
              <Text style={[styles.chipText, { color: theme.text }, maritalStatus === m && { color: '#fff' }]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.hint, { color: theme.textMuted, marginTop: 10 }]}>
          Want to add your BVN or next of kin for identity verification? Head to Identity Verification from your Profile.
        </Text>

        <GradientButton title="Save Changes" onPress={handleSave} loading={saving} style={{ marginTop: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  avatarWrap: { alignItems: 'center', marginBottom: 16 },
  changePhotoBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginTop: 14 },
  changePhotoText: { color: '#fff', fontWeight: '700', fontSize: 12, marginLeft: 6 },
  sectionLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, borderWidth: 1 },
  disabledInput: { justifyContent: 'center' },
  hint: { fontSize: 11, marginTop: 8, lineHeight: 16 },
  dobRow: { flexDirection: 'row', gap: 10 },
  dobInput: { flex: 1, textAlign: 'center' },
  dobInputYear: { flex: 1.6, textAlign: 'center' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, marginRight: 8, marginBottom: 8 },
  chipText: { fontSize: 12, fontWeight: '600' },
});
