import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import SuccessCheck from './SuccessCheck';
import GradientButton from './GradientButton';

// The shared "money moved" success screen — wraps the SuccessCheck
// animation (built earlier, never wired into any screen) with a message
// and a dismiss action. Used after transfers, bill payments, airtime/data
// purchases, and wallet funding, replacing what used to be a plain
// Alert.alert() with no visual flourish for the single most emotionally
// important moment in a payments app: confirmation that money safely moved.
export default function SuccessModal({ visible, title, message, onClose, buttonLabel = 'Done', secondaryLabel, onSecondary }) {
  const { theme } = useTheme();
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <SuccessCheck size={88} />
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {!!message && <Text style={[styles.message, { color: theme.textMuted }]}>{message}</Text>}
          <GradientButton title={buttonLabel} onPress={onClose} style={{ marginTop: 24, width: '100%' }} />
          {!!secondaryLabel && (
            <TouchableOpacity onPress={onSecondary} style={{ marginTop: 14 }}>
              <Text style={[styles.secondaryText, { color: theme.primary }]}>{secondaryLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', borderRadius: 24, padding: 28, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '800', marginTop: 18, textAlign: 'center' },
  message: { fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 19 },
  secondaryText: { fontSize: 13, fontWeight: '700' },
});
