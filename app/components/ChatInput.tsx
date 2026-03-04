import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Keyboard } from 'react-native';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim()) {
      onSend(inputText.trim());
      setInputText('');
      Keyboard.dismiss();
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={inputText}
        onChangeText={setInputText}
        placeholder="TYPE MESSAGE..."
        placeholderTextColor="#006400"
        editable={!disabled}
        multiline
        maxLength={500}
      />
      <TouchableOpacity 
        style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!inputText.trim() || disabled}
      >
        <Text style={styles.sendButtonText}></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 8,
    paddingHorizontal: 12,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#00ff00',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00ff00',
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    marginLeft: 8,
    marginBottom: 2,
    backgroundColor: '#00ff00',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#39ff14',
  },
  sendButtonDisabled: {
    backgroundColor: '#0a330a',
    borderColor: '#006400',
  },
  sendButtonText: {
    color: '#000',
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: 'bold',
  },
});