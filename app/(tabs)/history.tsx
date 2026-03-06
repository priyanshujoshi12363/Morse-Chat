import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

type ChatSession = {
  id: string;
  date: string;
  messages: {
    id: string;
    type: 'sent' | 'received';
    text: string;
    timestamp: number;
  }[];
  preview?: string;
};

const STORAGE_KEY = '@chat_history';

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [])
  );

  const loadSessions = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      setSessions(data ? JSON.parse(data) : []);
    } catch (error) {
      console.error('Error loading chat sessions:', error);
    }
  };

  const deleteChatSession = async (sessionId: string) => {
    try {
      const filtered = sessions.filter(s => s.id !== sessionId);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      setSessions(filtered);
    } catch (error) {
      console.error('Error deleting chat session:', error);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert(
      '🗑️ DELETE SESSION',
      'This conversation will be permanently deleted.',
      [
        { 
          text: 'CANCEL', 
          style: 'cancel',
          onPress: () => setSelectedId(null)
        },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: () => {
            deleteChatSession(sessionId);
            setSelectedId(null);
          },
        },
      ]
    );
  };

  const openSession = (session: ChatSession) => {
    // You can pass the session data back to the main chat
    router.back();
    // Optional: You can use events or state management to load the selected session
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPreviewText = (session: ChatSession) => {
    if (session.preview) return session.preview;
    if (session.messages.length > 0) {
      const lastMsg = session.messages[session.messages.length - 1];
      return lastMsg.text.length > 40 
        ? lastMsg.text.substring(0, 40) + '...' 
        : lastMsg.text;
    }
    return 'No messages';
  };

  const renderSession = ({ item, index }: { item: ChatSession; index: number }) => {
    const inputRange = [-1, 0, (index * 100), (index + 1) * 100];
    const scale = scrollY.interpolate({
      inputRange,
      outputRange: [1, 1, 1, 0.95]
    });

    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity 
          style={[
            styles.sessionItem,
            selectedId === item.id && styles.sessionItemSelected
          ]}
          onPress={() => openSession(item)}
          onLongPress={() => {
            setSelectedId(item.id);
            handleDeleteSession(item.id);
          }}
          activeOpacity={0.7}
          delayLongPress={500}
        >
          {/* Decorative Matrix Line */}
          <View style={styles.matrixLine} />
          
          <View style={styles.sessionHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.sessionDate}>{formatDate(item.date)}</Text>
              <View style={styles.messageCountContainer}>
                <Text style={styles.messageCount}>
                  {item.messages.length} MSG
                </Text>
              </View>
            </View>
            {item.messages.length > 0 && (
              <Text style={styles.lastMessageTime}>
                {formatTime(item.messages[item.messages.length - 1].timestamp)}
              </Text>
            )}
          </View>

          <View style={styles.previewContainer}>
            <Text style={styles.previewPrefix}>{'>'}</Text>
            <Text style={styles.sessionPreview} numberOfLines={2}>
              {getPreviewText(item)}
            </Text>
          </View>

          <View style={styles.sessionFooter}>
            <Text style={styles.sessionId}>
              SESSION_{item.id.slice(-8).toUpperCase()}
            </Text>
            <View style={styles.footerBadge}>
              <Text style={styles.footerBadgeText}>
                {item.messages.filter(m => m.type === 'received').length} RX
              </Text>
            </View>
          </View>

          {/* Glitch Effect Overlay (shows when selected) */}
          {selectedId === item.id && (
            <View style={styles.glitchOverlay}>
              <Text style={styles.glitchText}>DELETING</Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const ListHeaderComponent = () => (
    <View style={styles.listHeader}>
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          TOTAL SESSIONS: {sessions.length}
        </Text>
        <Text style={styles.statsText}>
          TOTAL MSGS: {sessions.reduce((acc, s) => acc + s.messages.length, 0)}
        </Text>
      </View>
    </View>
  );

  const ListEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyGlitchBox}>
        <Text style={styles.emptyGlitchText}>📁</Text>
      </View>
      <Text style={styles.emptyText}>NO SESSIONS FOUND</Text>
      <Text style={styles.emptySubtext}>Initialize new chat to begin</Text>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
        activeOpacity={0.8}
      >
        <Text style={styles.backButtonText}>← INITIALIZE CONNECTION</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.container}>
        {/* Header with Glitch Effect */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backButtonHeader}
            activeOpacity={0.7}
          >
            <Text style={styles.headerButton}>←</Text>
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>CHAT_HISTORY</Text>
            <View style={styles.headerGlitch} />
          </View>
          
          <TouchableOpacity 
            onPress={loadSessions}
            style={styles.refreshButton}
            activeOpacity={0.7}
          >
            <Text style={styles.refreshButtonText}>↻</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <Animated.FlatList
          data={sessions}
          keyExtractor={item => item.id}
          renderItem={renderSession}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={sessions.length > 0 ? ListHeaderComponent : null}
          ListEmptyComponent={ListEmptyComponent}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />

        {/* Matrix Rain Effect (Decorative) */}
        <View style={styles.matrixRain} pointerEvents="none">
          <Text style={styles.matrixRainText}>01001110 01001111 01000100 01000101</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop:30,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#00ff00',
    backgroundColor: '#0a0a0a',
    position: 'relative',
    zIndex: 10,
    shadowColor: '#00ff00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  backButtonHeader: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#00ff00',
    backgroundColor: '#001100',
    shadowColor: '#00ff00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  headerButton: {
    color: '#00ff00',
    fontSize: 28,
    fontWeight: 'bold',
    transform: [{ scale: 1.2 }],
  },
  headerTitleContainer: {
    position: 'relative',
    paddingHorizontal: 12,
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: width < 375 ? 16 : 18,
    letterSpacing: 6,
    fontWeight: 'bold',
    textShadowColor: '#00ff00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  headerGlitch: {
    position: 'absolute',
    top: 2,
    left: 15,
    right: 15,
    bottom: 0,
    backgroundColor: 'rgba(0,255,0,0.15)',
    transform: [{ skewX: '-8deg' }],
    borderRadius: 2,
  },
  refreshButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#00ff00',
    backgroundColor: '#001100',
    shadowColor: '#00ff00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  refreshButtonText: {
    color: '#00ff00',
    fontSize: 28,
    fontWeight: 'bold',
    transform: [{ scale: 1.2 }],
  },
  list: {
    padding: width * 0.04,
    paddingBottom: 100,
    paddingTop: 20, // Added top padding for list
  },
  listHeader: {
    marginBottom: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: '#00ff00',
    backgroundColor: '#0a1a0a',
    borderRadius: 8,
    shadowColor: '#00ff00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: width < 375 ? 11 : 13,
    fontWeight: '500',
    letterSpacing: 1,
  },
  sessionItem: {
    backgroundColor: '#0a0a0a',
    borderWidth: 2,
    borderColor: '#00ff00',
    borderRadius: 16,
    padding: width * 0.05,
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#00ff00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sessionItemSelected: {
    borderColor: '#ff0000',
    shadowColor: '#ff0000',
    shadowOpacity: 0.4,
    borderWidth: 3,
  },
  matrixLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#00ff00',
    opacity: 0.4,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sessionDate: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: width < 375 ? 13 : 15,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  messageCountContainer: {
    backgroundColor: '#003300',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#00ff00',
  },
  messageCount: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: width < 375 ? 9 : 11,
    fontWeight: '600',
  },
  lastMessageTime: {
    color: '#00cc00',
    fontFamily: 'monospace',
    fontSize: width < 375 ? 9 : 11,
    fontWeight: '500',
  },
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    backgroundColor: '#001100',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#00aa00',
  },
  previewPrefix: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 18,
    marginRight: 10,
    opacity: 0.6,
  },
  sessionPreview: {
    flex: 1,
    color: '#39ff14',
    fontFamily: 'monospace',
    fontSize: width < 375 ? 14 : 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  sessionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1.5,
    borderTopColor: '#00aa00',
    paddingTop: 12,
  },
  sessionId: {
    color: '#00aa00',
    fontFamily: 'monospace',
    fontSize: width < 375 ? 9 : 11,
    letterSpacing: 1.5,
    fontWeight: '500',
  },
  footerBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#00ff00',
  },
  footerBadgeText: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: width < 375 ? 9 : 11,
    fontWeight: '600',
  },
  glitchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glitchText: {
    color: '#ff0000',
    fontFamily: 'monospace',
    fontSize: 24,
    fontWeight: 'bold',
    transform: [{ skewX: '-12deg' }],
    textShadowColor: '#ff0000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: width * 0.1,
    minHeight: height * 0.7,
  },
  emptyGlitchBox: {
    borderWidth: 3,
    borderColor: '#00ff00',
    padding: 35,
    marginBottom: 28,
    transform: [{ skewX: '-8deg' }],
    backgroundColor: '#0a0a0a',
    shadowColor: '#00ff00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  emptyGlitchText: {
    color: '#00ff00',
    fontSize: 56,
    transform: [{ skewX: '8deg' }],
  },
  emptyText: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: width < 375 ? 18 : 20,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 3,
    fontWeight: 'bold',
    textShadowColor: '#00ff00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  emptySubtext: {
    color: '#00cc00',
    fontFamily: 'monospace',
    fontSize: width < 375 ? 13 : 15,
    marginBottom: 40,
    textAlign: 'center',
    letterSpacing: 1,
  },
  backButton: {
    borderWidth: 2.5,
    borderColor: '#00ff00',
    paddingHorizontal: 30,
    paddingVertical: 18,
    borderRadius: 12,
    backgroundColor: '#0a0a0a',
    shadowColor: '#00ff00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  backButtonText: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: width < 375 ? 13 : 15,
    letterSpacing: 3,
    fontWeight: '600',
  },
  matrixRain: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.15,
  },
  matrixRainText: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
  },
});