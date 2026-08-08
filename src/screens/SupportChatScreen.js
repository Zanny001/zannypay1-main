import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { colors } from '../theme/colors';
import { apiGet, apiPost } from '../services/apiClient';
import { formatDate } from '../utils/format';

// No websocket layer here by design — a short poll while this screen is
// actively focused (and only then; it stops the moment you navigate away)
// is a proportionate amount of infrastructure for a support inbox. See
// the app-wide audit notes on polling: this follows the same "only when
// the screen is actually open" principle already used elsewhere.
const POLL_INTERVAL_MS = 6000;

export default function SupportChatScreen({ navigation }) {
  const { theme } = useTheme();
  const { alert } = useAlert();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState(null); // { dataUri, mimeType } staged before send
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewUri, setPreviewUri] = useState(null); // full-screen tap-to-view
  const listRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    try {
      const data = await apiGet('/support/conversation');
      setMessages(data.messages || []);
    } catch (e) {
      // Silent on purpose — a background poll failing shouldn't interrupt
      // someone mid-conversation with an error banner every 6 seconds.
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
      const interval = setInterval(() => load(true), POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }, [load])
  );

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert('Permission needed', 'Please allow photo library access to share a photo in this chat.', null, { type: 'warning' });
      return;
    }
    // Same quality setting already used for profile photo upload elsewhere
    // in the app — keeps the base64 payload comfortably under the
    // backend's per-message size cap without needing a separate
    // compression library.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.4,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${asset.base64}`;

    if (dataUri.length > 2_800_000) {
      alert('Image Too Large', 'Please choose a smaller photo — this one is too large to send.', null, { type: 'warning' });
      return;
    }
    setPendingImage({ dataUri, mimeType });
  };

  const handleSend = async () => {
    const body = input.trim();
    if ((!body && !pendingImage) || sending) return;

    const attachment = pendingImage;
    setInput('');
    setPendingImage(null);
    setSending(true);

    // Optimistic append so sending feels instant; reconciled against the
    // real list on the next successful load() either way.
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        senderType: 'CUSTOMER',
        body: body || null,
        attachmentData: attachment?.dataUri || null,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      await apiPost('/support/messages', {
        body: body || undefined,
        attachmentData: attachment?.dataUri,
        attachmentMimeType: attachment?.mimeType,
      });
      await load(true);
    } catch (e) {
      // Leave the optimistic bubble in place rather than silently dropping
      // what they sent — worst case it looks unsent-but-visible, which is
      // recoverable, versus vanishing entirely.
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>ZannyPay Support</Text>
          <Text style={[styles.headerSub, { color: theme.textMuted }]}>Usually replies within a few hours</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="chatbubbles-outline" size={32} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Tell us what's going on — a real person will reply here.
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isMine = item.senderType === 'CUSTOMER';
            return (
              <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : { backgroundColor: theme.surface }, item.attachmentData && styles.bubbleWithImage]}>
                  {item.attachmentData && (
                    <TouchableOpacity onPress={() => setPreviewUri(item.attachmentData)} activeOpacity={0.85}>
                      <Image source={{ uri: item.attachmentData }} style={styles.attachmentImage} resizeMode="cover" />
                    </TouchableOpacity>
                  )}
                  {!!item.body && (
                    <Text style={[isMine ? styles.bubbleTextMine : { color: theme.text, fontSize: 14, lineHeight: 20 }, item.attachmentData && { marginTop: 8 }]}>
                      {item.body}
                    </Text>
                  )}
                </View>
                <Text style={[styles.bubbleTime, { color: theme.textMuted }]}>{formatDate(item.createdAt)}</Text>
              </View>
            );
          }}
        />

        {pendingImage && (
          <View style={[styles.pendingImageBar, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
            <Image source={{ uri: pendingImage.dataUri }} style={styles.pendingImageThumb} />
            <Text style={[styles.pendingImageText, { color: theme.textMuted }]}>Photo ready to send</Text>
            <TouchableOpacity onPress={() => setPendingImage(null)} style={{ padding: 6 }}>
              <Ionicons name="close-circle" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputRow, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={handlePickImage} style={styles.attachBtn}>
            <Ionicons name="image-outline" size={22} color={theme.textMuted} />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: theme.text }]}
            placeholder="Type a message…"
            placeholderTextColor={theme.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={(!input.trim() && !pendingImage) || sending}
            style={[styles.sendBtn, (!input.trim() && !pendingImage || sending) && { opacity: 0.4 }]}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPreviewUri(null)}>
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 1 },
  listContent: { padding: 16, flexGrow: 1 },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 19 },
  bubbleRow: { marginBottom: 14, maxWidth: '80%' },
  bubbleRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleWithImage: { padding: 6 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTextMine: { color: '#fff', fontSize: 14, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 4, marginHorizontal: 4 },
  attachmentImage: { width: 200, height: 200, borderRadius: 12 },
  pendingImageBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, gap: 10 },
  pendingImageThumb: { width: 36, height: 36, borderRadius: 8 },
  pendingImageText: { flex: 1, fontSize: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1, gap: 8 },
  attachBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, maxHeight: 100, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '80%' },
});
