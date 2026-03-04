import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { ChatSession } from '../Types';
import { getChatSessions, deleteChatSession } from '../utils/storage';

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [])
  );

  const loadSessions = async () => {
    const loaded = await getChatSessions();
    setSessions(loaded);
  };

  const handleDeleteSession = async (sessionId: string) => {
    Alert.alert(
      'DELETE SESSION',
      'This conversation will be permanently deleted.',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: async () => {
            await deleteChatSession(sessionId);
            await loadSessions();
          },
        },
      ]
    );
  };

  const openSession = (session: ChatSession) => {
    router.push({
      pathname: '/',
      params: {
        sessionId: session.id,
        messages: JSON.stringify(session.messages),
      },
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderSession = ({ item }: { item: ChatSession }) => (
    <TouchableOpacity 
      style={styles.sessionItem}
      onPress={() => openSession(item)}
      onLongPress={() => handleDeleteSession(item.id)}
    >
      <View style={styles.sessionHeader}>
        <Text style={styles.sessionDate}>{formatDate(item.date)}</Text>
        <Text style={styles.sessionTime}>
          {item.messages.length} messages
        </Text>
      </View>
      <Text style={styles.sessionPreview} numberOfLines={1}>
        {item.preview || 'No messages'}
      </Text>
      <View style={styles.sessionFooter}>
        <Text style={styles.sessionId}>ID: {item.id.slice(-8)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CHAT HISTORY</Text>
        <View style={{ width: 40 }} />
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📁</Text>
          <Text style={styles.emptyText}>NO SESSIONS FOUND</Text>
          <Text style={styles.emptySubtext}>Start a new chat to begin</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.id}
          renderItem={renderSession}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#00ff00',
    backgroundColor: '#0a0a0a',
  },
  headerButton: {
    color: '#00ff00',
    fontSize: 24,
  },
  headerTitle: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 16,
    letterSpacing: 2,
  },
  list: {
    padding: 16,
  },
  sessionItem: {
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#00ff00',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sessionDate: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  sessionTime: {
    color: '#006400',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  sessionPreview: {
    color: '#39ff14',
    fontFamily: 'monospace',
    fontSize: 16,
    marginBottom: 8,
  },
  sessionFooter: {
    borderTopWidth: 1,
    borderTopColor: '#00ff00',
    paddingTop: 8,
  },
  sessionId: {
    color: '#006400',
    fontFamily: 'monospace',
    fontSize: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    color: '#00ff00',
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#006400',
    fontFamily: 'monospace',
    fontSize: 14,
  },
});