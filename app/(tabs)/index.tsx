import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Dimensions,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CameraView from '../components/CameraView';
import ChatBubble from '../components/ChatBubble';
import ChatInput from '../components/ChatInput';
import { Message, ChatSession } from '../Types';
import { updateChatSession } from '../utils/storage';

const { height } = Dimensions.get('window');

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  // Load existing chat if opened from history
  useEffect(() => {
    if (params.sessionId && params.messages) {
      setSessionId(params.sessionId as string);
      setMessages(JSON.parse(params.messages as string));
    } else {
      // New chat session
      setSessionId(`chat_${Date.now()}`);
    }
  }, [params.sessionId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async (text: string) => {
    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'sent',
      text: text.toUpperCase(),
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);

    // Auto-reply after 1 second
    setTimeout(async () => {
      const reply: Message = {
        id: `msg_${Date.now() + 1}`,
        type: 'received',
        text: generateHackerReply(text),
        timestamp: Date.now(),
      };
      
      const finalMessages = [...updatedMessages, reply];
      setMessages(finalMessages);
      
      // Save to storage
      await updateChatSession(sessionId, finalMessages);
    }, 1000);
  };

  const generateHackerReply = (userMessage: string): string => {
    const replies = [
      'ACCESS GRANTED',
      'SCANNING NETWORK...',
      'FIREWALL BYPASSED',
      'ENCRYPTION CRACKED',
      'SYSTEM BREACH DETECTED',
      'TRACING IP...',
      'PROXY ROUTE ESTABLISHED',
      'DATA PACKET RECEIVED',
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  };

  const handleSignalDetected = () => {
    const signalMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'received',
      text: '⚡ SIGNAL DETECTED - ANALYZING...',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, signalMessage]);
  };

  const handleClearChat = () => {
    Alert.alert(
      'CLEAR CHAT',
      'Delete this conversation?',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            setSessionId(`chat_${Date.now()}`);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <CameraView 
          isScanning={isScanning}
          onSignalDetected={handleSignalDetected}
        />
        
        <View style={[styles.chatContainer, { paddingBottom: 0 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.push('/history')}>
              <Text style={styles.headerButton}>📁</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>SECURE CHAT v2.0</Text>
            <TouchableOpacity onPress={handleClearChat}>
              <Text style={styles.headerButton}>🗑️</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item }) => <ChatBubble message={item} />}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
          />

          <ChatInput onSend={handleSend} />
        </View>
      </KeyboardAvoidingView>
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
  },
  chatContainer: {
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
    fontSize: 20,
  },
  headerTitle: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 14,
    letterSpacing: 2,
  },
  messagesList: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    flexGrow: 1,
  },
});