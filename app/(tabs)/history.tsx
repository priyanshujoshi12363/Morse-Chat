import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import {
  ChatSession,
  Message,
  getSessions,
  deleteSession,
} from '../../utils/chatStorage';

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [active, setActive] = useState<ChatSession | null>(null);
  const insets = useSafeAreaInsets();

  useFocusEffect(
    useCallback(() => {
      getSessions().then(setSessions);
    }, [])
  );

  const handleDelete = (sessionId: string) => {
    Alert.alert('Delete session', 'This conversation will be removed.', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'DELETE',
        style: 'destructive',
        onPress: async () => setSessions(await deleteSession(sessionId)),
      },
    ]);
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const previewOf = (session: ChatSession) => {
    if (session.preview) return session.preview;
    const last = session.messages[session.messages.length - 1];
    return last ? last.text : 'No messages';
  };

  const renderSession = ({ item }: { item: ChatSession }) => (
    <TouchableOpacity
      style={styles.sessionItem}
      onPress={() => setActive(item)}
      onLongPress={() => handleDelete(item.id)}
      delayLongPress={400}
      activeOpacity={0.7}
    >
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionDate}>{formatDate(item.date)}</Text>
        <Text style={styles.sessionCount}>{item.messages.length} MSG</Text>
      </View>
      <Text style={styles.sessionPreview} numberOfLines={2}>
        {'> '}
        {previewOf(item)}
      </Text>
      <Text style={styles.sessionId}>
        SESSION_{item.id.slice(-8).toUpperCase()} · tap to open · hold to delete
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>HISTORY</Text>
        <View style={styles.headerBtn} />
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📁</Text>
            <Text style={styles.emptyText}>NO SESSIONS YET</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.back()}
            >
              <Text style={styles.emptyButtonText}>← START CHATTING</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal
        visible={active !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setActive(null)}
      >
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setActive(null)}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {active ? formatDate(active.date) : ''}
            </Text>
            <View style={styles.headerBtn} />
          </View>
          <FlatList
            data={active?.messages ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }: { item: Message }) => (
              <View
                style={[
                  styles.bubbleRow,
                  item.type === 'sent'
                    ? styles.bubbleRowSent
                    : styles.bubbleRowReceived,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    item.type === 'sent'
                      ? styles.bubbleSent
                      : styles.bubbleReceived,
                  ]}
                >
                  <Text style={styles.bubbleText}>{item.text}</Text>
                  <Text style={styles.bubbleTime}>
                    {formatTime(item.timestamp)}
                  </Text>
                </View>
              </View>
            )}
            contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 16 },
          ]}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const GREEN = '#00ff00';

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GREEN,
    backgroundColor: '#0a0a0a',
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerBtnText: { color: GREEN, fontSize: 26, fontWeight: 'bold' },
  headerTitle: {
    color: GREEN,
    fontFamily: 'monospace',
    fontSize: 16,
    letterSpacing: 4,
    fontWeight: 'bold',
  },

  list: { padding: 12, flexGrow: 1 },

  sessionItem: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: GREEN,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionDate: {
    color: GREEN,
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sessionCount: {
    color: GREEN,
    fontFamily: 'monospace',
    fontSize: 11,
    borderWidth: 1,
    borderColor: '#006400',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sessionPreview: {
    color: '#39ff14',
    fontFamily: 'monospace',
    fontSize: 14,
    marginBottom: 8,
  },
  sessionId: {
    color: '#006400',
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 1,
  },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyText: {
    color: GREEN,
    fontFamily: 'monospace',
    fontSize: 18,
    letterSpacing: 2,
    marginBottom: 24,
  },
  emptyButton: {
    borderWidth: 2,
    borderColor: GREEN,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: GREEN,
    fontFamily: 'monospace',
    fontSize: 14,
    letterSpacing: 2,
  },

  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  bubbleRowSent: { justifyContent: 'flex-end' },
  bubbleRowReceived: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 10, borderRadius: 14, borderWidth: 1 },
  bubbleSent: { borderColor: '#39ff14', backgroundColor: '#0a0a0a' },
  bubbleReceived: { borderColor: '#006400', backgroundColor: '#0a330a' },
  bubbleText: {
    color: GREEN,
    fontFamily: 'monospace',
    fontSize: 14,
    marginBottom: 4,
  },
  bubbleTime: {
    color: '#006400',
    fontFamily: 'monospace',
    fontSize: 10,
    alignSelf: 'flex-end',
  },
});
