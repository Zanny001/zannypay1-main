import React from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import Card from '../components/Card';

export default function SupportScreen({ navigation }) {
  const openLink = (url) => {
    Linking.openURL(url).catch(() => alert('Could not launch communication protocol.'));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How can we assist you?</Text>
      <Text style={styles.subtitle}>Chat with our team, or reach us directly below.</Text>

      <TouchableOpacity style={styles.chatCard} onPress={() => navigation.navigate('SupportChat')} activeOpacity={0.85}>
        <View style={styles.chatIconWrap}>
          <Ionicons name="chatbubbles" size={24} color="#fff" />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.chatTitle}>Chat with us</Text>
          <Text style={styles.chatDesc}>Message a real person — usually replies within a few hours</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </TouchableOpacity>

      <Card style={{ paddingVertical: 6 }}>
        <TouchableOpacity style={styles.row} onPress={() => openLink('mailto:support@zannypay.com')}>
          <Ionicons name="mail-outline" size={22} color={colors.primary} />
          <View style={styles.textBlock}>
            <Text style={styles.rowTitle}>Email Support</Text>
            <Text style={styles.rowDesc}>support@zannypay.com</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => openLink('tel:+2348000000000')}>
          <Ionicons name="call-outline" size={22} color={colors.primary} />
          <View style={styles.textBlock}>
            <Text style={styles.rowTitle}>Priority Phone Hotline</Text>
            <Text style={styles.rowDesc}>Toll-free voice connection</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgLight, padding: 20 },
  title: { fontSize: 20, fontWeight: '800', color: colors.textDark, marginTop: 10 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 24, marginTop: 4 },
  chatCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: 16, padding: 16, marginBottom: 20 },
  chatIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  chatTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  chatDesc: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  textBlock: { flex: 1, marginLeft: 14 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.textDark },
  rowDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});

