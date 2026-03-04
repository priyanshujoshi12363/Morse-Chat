import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '../Types';
interface ChatBubbleProps {
  message: Message;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isSent = message.type === 'sent';
  
  return (
    <View style={[
      styles.container,
      isSent ? styles.sentContainer : styles.receivedContainer
    ]}>
      <View style={[
        styles.bubble,
        isSent ? styles.sentBubble : styles.receivedBubble
      ]}>
        <Text style={styles.messageText}>{message.text}</Text>
        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    marginVertical: 4,
    flexDirection: 'row',
  },
  sentContainer: {
    justifyContent: 'flex-end',
  },
  receivedContainer: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#000',
    borderWidth: 1,
  },
  sentBubble: {
    borderColor: '#39ff14',
    backgroundColor: '#0a0a0a',
  },
  receivedBubble: {
    borderColor: '#006400',
    backgroundColor: '#0a330a',
  },
  messageText: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 14,
    marginBottom: 4,
  },
  timestamp: {
    color: '#006400',
    fontFamily: 'monospace',
    fontSize: 10,
    alignSelf: 'flex-end',
  },
});