import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Platform,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
  TextInput,
  Keyboard,
  Animated,
  Easing,
  AppState,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import textToMorse from '../../utils/morse';

const { height } = Dimensions.get('window');

type Message = {
  id: string;
  type: 'sent' | 'received';
  text: string;
  timestamp: number;
};

type ChatSession = {
  id: string;
  date: string;
  messages: Message[];
  preview?: string;
};

const STORAGE_KEY = '@chat_history';

const MORSE_TO_CHAR: { [key: string]: string } = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
  '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
  '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
  '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
  '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
  '--..': 'Z', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
  '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
  '-----': '0', '/': ' '
};

const PACKET_CONFIG = {
  START_MARKER: '###',
  END_MARKER: '###',
  MESSAGE_TIMEOUT: 3000,
  MIN_MESSAGE_LENGTH: 1,
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string>(`chat_${Date.now()}`);
  const [isScanning, setIsScanning] = useState(true);
  const [inputText, setInputText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [cameraActive, setCameraActive] = useState(true);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [signalDetected, setSignalDetected] = useState(false);
  const [decodedText, setDecodedText] = useState('');
  const [packetState, setPacketState] = useState<'idle' | 'receiving' | 'complete'>('idle');
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const cameraRef = useRef<Camera>(null);
  const signalTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const decodingState = useRef({
    isSignalOn: false,
    signalStartTime: 0,
    currentSymbol: '',
    currentLetter: '',
    decodedMessage: '',
    lastSignalTime: 0,
    prevBrightness: 0,
    rawMorseBuffer: '',
    packetBuffer: '',
    isReceivingPacket: false,
    lastCompleteMessage: '',
  });

  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const torchAnim = useRef(new Animated.Value(0)).current;
  
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setCameraActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        const keyboardHeight = event.endCoordinates.height;
        setKeyboardHeight(keyboardHeight);
        
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -keyboardHeight + (Platform.OS === 'ios' ? insets.bottom : 0),
            duration: Platform.OS === 'ios' ? 250 : 200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: Platform.OS === 'ios' ? 250 : 200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (signalTimeoutRef.current) {
        clearTimeout(signalTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    
    if (packetState === 'receiving') {
      messageTimeoutRef.current = setTimeout(() => {
        const state = decodingState.current;
        
        if (state.packetBuffer.length > 0) {
          handleCompleteMessage(state.packetBuffer);
        }
        
        state.isReceivingPacket = false;
        state.packetBuffer = '';
        setPacketState('idle');
      }, PACKET_CONFIG.MESSAGE_TIMEOUT);
    }
    
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, [packetState]);

  const handleSignalIndicator = useCallback(() => {
    if (signalTimeoutRef.current) {
      clearTimeout(signalTimeoutRef.current);
    }

    setSignalDetected(true);

    signalTimeoutRef.current = setTimeout(() => {
      setSignalDetected(false);
    }, 2000);
  }, []);

  const handleCompleteMessage = useCallback((message: string) => {
    if (!message || message.length < PACKET_CONFIG.MIN_MESSAGE_LENGTH) return;
    
    const cleanMessage = message
      .replace(new RegExp(PACKET_CONFIG.START_MARKER, 'g'), '')
      .replace(new RegExp(PACKET_CONFIG.END_MARKER, 'g'), '')
      .trim();
    
    if (!cleanMessage) return;
    
    const newMessage: Message = {
      id: `packet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'received',
      text: cleanMessage,
      timestamp: Date.now(),
    };
    
    setMessages(prev => [...prev, newMessage]);
    setPacketState('complete');
    
    setSignalDetected(true);
    setTimeout(() => setSignalDetected(false), 2000);
    
    const session: ChatSession = {
      id: sessionId,
      date: new Date().toISOString().split('T')[0],
      messages: [...messages, newMessage],
      preview: cleanMessage,
    };
    saveChatSession(session);
    
    setTimeout(() => {
      setPacketState('idle');
    }, 2000);
  }, [messages, sessionId]);

  const processMorsePacket = useCallback((decodedChar: string) => {
    const state = decodingState.current;
    
    state.packetBuffer += decodedChar;
    
    if (!state.isReceivingPacket && state.packetBuffer.includes(PACKET_CONFIG.START_MARKER)) {
      state.isReceivingPacket = true;
      setPacketState('receiving');
      
      const startIndex = state.packetBuffer.indexOf(PACKET_CONFIG.START_MARKER);
      state.packetBuffer = state.packetBuffer.substring(startIndex + PACKET_CONFIG.START_MARKER.length);
    }
    
    if (state.isReceivingPacket && state.packetBuffer.includes(PACKET_CONFIG.END_MARKER)) {
      const endIndex = state.packetBuffer.indexOf(PACKET_CONFIG.END_MARKER);
      const completeMessage = state.packetBuffer.substring(0, endIndex);
      
      handleCompleteMessage(completeMessage);
      
      state.isReceivingPacket = false;
      state.packetBuffer = '';
      setPacketState('idle');
    }
  }, [handleCompleteMessage]);

  const handleBrightnessChange = useCallback((brightness: number) => {
    const now = Date.now();
    const state = decodingState.current;
    
    const FLASH_THRESHOLD = 0.8;
    const MIN_FLASH_DURATION = 50;
    const SIGNAL_COOLDOWN = 100;
    const LETTER_GAP = 500;
    const BRIGHTNESS_CHANGE_THRESHOLD = 0.2;
    
    const prevBrightness = state.prevBrightness || 0;
    const delta = Math.abs(brightness - prevBrightness);
    state.prevBrightness = brightness;
    
    const isRealFlash = brightness > FLASH_THRESHOLD && delta > BRIGHTNESS_CHANGE_THRESHOLD;
    
    if (isRealFlash && !state.isSignalOn) {
      if (now - (state.lastSignalTime || 0) < SIGNAL_COOLDOWN) {
        return;
      }
      
      state.isSignalOn = true;
      state.signalStartTime = now;
      
      handleSignalIndicator();
    }
    else if (!isRealFlash && state.isSignalOn) {
      state.isSignalOn = false;
      const duration = now - state.signalStartTime;
      state.lastSignalTime = now;
      
      if (duration > MIN_FLASH_DURATION) {
        if (duration < 300) {
          state.currentSymbol += '.';
        } else {
          state.currentSymbol += '-';
        }
        
        setDecodedText(`Decoding: ${state.currentSymbol}`);
      }
    }
    
    if (!state.isSignalOn && state.currentSymbol) {
      const timeSinceLastSignal = now - (state.lastSignalTime || now);
      
      if (timeSinceLastSignal > LETTER_GAP) {
        const char = MORSE_TO_CHAR[state.currentSymbol] || '?';
        state.decodedMessage += char;
        state.currentSymbol = '';
        
        setDecodedText(state.decodedMessage);
        
        if (char !== '?') {
          processMorsePacket(char);
        }
        
        if (char === ' ') {
          const trimmedMessage = state.decodedMessage.trim();
          if (trimmedMessage && !state.isReceivingPacket) {
            const decodedMessage: Message = {
              id: `decoded_${Date.now()}_${Math.random()}`,
              type: 'received',
              text: trimmedMessage,
              timestamp: Date.now(),
            };
            setMessages(prev => [...prev, decodedMessage]);
          }
          state.decodedMessage = '';
          setDecodedText('');
        }
      }
    }
  }, [handleSignalIndicator, processMorsePacket]);

  const handleSignalIndicatorWorklet = Worklets.createRunOnJS(handleSignalIndicator);
  const handleBrightnessChangeWorklet = Worklets.createRunOnJS(handleBrightnessChange);

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';

    if (!isScanning) return;
    
    const now = frame.timestamp;
    const simulatedBrightness = Math.random() < 0.05 ? 0.9 : 0.3 + (Math.random() * 0.2);
    handleBrightnessChangeWorklet(simulatedBrightness);
    
    if (Math.random() < 0.01) {
      handleSignalIndicatorWorklet();
    }
  }, [isScanning]);

  const transmitMorse = async (message: string) => {
    if (isTransmitting) return;
    
    setIsTransmitting(true);
    
    const packetMessage = `${PACKET_CONFIG.START_MARKER}${message.toUpperCase()}${PACKET_CONFIG.END_MARKER}`;
    const morseSequence = textToMorse(packetMessage);
    
    const transmitMessage: Message = {
      id: `transmit_${Date.now()}_${Math.random()}`,
      type: 'sent',
      text: `📡 TRANSMITTING: ${message}`,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, transmitMessage]);

    const DOT_DURATION = 200;
    const DASH_DURATION = 600;
    const SYMBOL_GAP = 200;
    const LETTER_GAP = 600;

    let delay = 0;
    const timers: NodeJS.Timeout[] = [];

    for (const morse of morseSequence) {
      for (const symbol of morse) {
       
        const onTimer = setTimeout(() => {
          setIsTorchOn(true);
          Animated.sequence([
            Animated.timing(torchAnim, {
              toValue: 1,
              duration: 50,
              useNativeDriver: false,
            }),
          ]).start();
        }, delay);
        timers.push(onTimer);

        const symbolDuration = symbol === '.' ? DOT_DURATION : DASH_DURATION;
        const offTimer = setTimeout(() => {
          setIsTorchOn(false);
          Animated.timing(torchAnim, {
            toValue: 0,
            duration: 50,
            useNativeDriver: false,
          }).start();
        }, delay + symbolDuration);
        timers.push(offTimer);

        delay += symbolDuration + SYMBOL_GAP;
      }
      delay += LETTER_GAP - SYMBOL_GAP;
    }

    const completeTimer = setTimeout(() => {
      setIsTransmitting(false);
      const completeMessage: Message = {
        id: `complete_${Date.now()}_${Math.random()}`,
        type: 'sent',
        text: '✅ TRANSMISSION COMPLETE',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, completeMessage]);
    }, delay);
    timers.push(completeTimer);

    return () => timers.forEach(clearTimeout);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const messageText = inputText.trim();
    
    const newMessage: Message = {
      id: `msg_${Date.now()}_${Math.random()}`,
      type: 'sent',
      text: messageText.toUpperCase(),
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInputText('');
    
    transmitMorse(messageText);

    setTimeout(async () => {
      const reply: Message = {
        id: `reply_${Date.now()}_${Math.random()}`,
        type: 'received',
        text: generateHackerReply(messageText),
        timestamp: Date.now(),
      };
      
      const finalMessages = [...updatedMessages, reply];
      setMessages(finalMessages);
      
      const session: ChatSession = {
        id: sessionId,
        date: new Date().toISOString().split('T')[0],
        messages: finalMessages,
        preview: finalMessages[finalMessages.length - 1]?.text || '',
      };
      
      await saveChatSession(session);
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
            setDecodedText('');
            setPacketState('idle');
            decodingState.current = {
              isSignalOn: false,
              signalStartTime: 0,
              currentSymbol: '',
              currentLetter: '',
              decodedMessage: '',
              lastSignalTime: 0,
              prevBrightness: 0,
              rawMorseBuffer: '',
              packetBuffer: '',
              isReceivingPacket: false,
              lastCompleteMessage: '',
            };
          },
        },
      ]
    );
  };

  const saveChatSession = async (session: ChatSession) => {
    try {
      const existing = await getChatSessions();
      const index = existing.findIndex(s => s.id === session.id);
      
      if (index !== -1) {
        existing[index] = session;
      } else {
        existing.unshift(session);
      }
      
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      return true;
    } catch (error) {
      console.error('Error saving chat session:', error);
      return false;
    }
  };

  const getChatSessions = async (): Promise<ChatSession[]> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading chat sessions:', error);
      return [];
    }
  };

  const renderChatBubble = ({ item }: { item: Message }) => {
    const isSent = item.type === 'sent';
    
    return (
      <View style={[
        styles.bubbleContainer,
        isSent ? styles.sentContainer : styles.receivedContainer
      ]}>
        <View style={[
          styles.bubble,
          isSent ? styles.sentBubble : styles.receivedBubble
        ]}>
          <Text style={styles.messageText}>{item.text}</Text>
          <Text style={styles.timestamp}>
            {new Date(item.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>CAMERA ACCESS REQUIRED</Text>
          <Text style={styles.permissionText}>
            This app needs camera access for signal detection and Morse code transmission.
          </Text>
          <TouchableOpacity 
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>GRANT ACCESS</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (device == null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>NO CAMERA FOUND</Text>
          <Text style={styles.permissionText}>
            This device does not have a compatible camera.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={styles.camera}
            device={device}
            isActive={cameraActive}
            frameProcessor={frameProcessor}
            frameProcessorFps={5}
            torch={isTorchOn ? 'on' : 'off'}
            video={false}
            audio={false}
            enableZoomGesture={false}
          />
          
          <View style={styles.cameraOverlay}>
            <View style={styles.statusContainer}>
              <View style={[styles.indicator, isScanning && styles.indicatorActive]} />
              <Text style={styles.statusText}>
                {signalDetected ? '⚡ SIGNAL DETECTED' : isScanning ? '● SCANNING' : '● IDLE'}
              </Text>
            </View>
            
            {decodedText !== '' && (
              <View style={styles.decodedContainer}>
                <Text style={styles.decodedText}>📨 {decodedText}</Text>
              </View>
            )}
            
            {packetState !== 'idle' && (
              <View style={[
                styles.packetContainer,
                packetState === 'receiving' ? styles.packetReceiving : styles.packetComplete
              ]}>
                <Text style={styles.packetText}>
                  {packetState === 'receiving' ? '📥 RECEIVING PACKET...' : '📦 PACKET COMPLETE'}
                </Text>
              </View>
            )}
            
            {isTorchOn && (
              <Animated.View style={[styles.torchIndicator, { opacity: torchAnim }]}>
                <Text style={styles.torchText}>🔦 TRANSMITTING</Text>
              </Animated.View>
            )}
            
            <View style={styles.scanFrame} />
          </View>
        </View>

        <View style={styles.chatContainer}>
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
            renderItem={renderChatBubble}
            contentContainerStyle={[
              styles.messagesList,
              { paddingBottom: keyboardHeight > 0 ? 10 : 16 }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
          />

          <Animated.View 
            style={[
              styles.inputWrapper,
              {
                transform: [{ translateY }],
                opacity,
                marginBottom: Platform.OS === 'ios' ? 0 : insets.bottom,
              },
              keyboardHeight > 0 && styles.inputWrapperActive,
              isTransmitting && styles.inputWrapperDisabled,
            ]}
          >
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={[styles.input, isTransmitting && styles.inputDisabled]}
                value={inputText}
                onChangeText={setInputText}
                placeholder={isTransmitting ? "TRANSMITTING..." : "TYPE MESSAGE..."}
                placeholderTextColor={isTransmitting ? "#003300" : "#006400"}
                multiline
                maxLength={500}
                returnKeyType="default"
                blurOnSubmit={false}
                selectionColor="#00ff00"
                editable={!isTransmitting}
              />
              <TouchableOpacity 
                style={[
                  styles.sendButton, 
                  (!inputText.trim() || isTransmitting) && styles.sendButtonDisabled
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || isTransmitting}
                activeOpacity={0.7}
              >
                <Text style={styles.sendButtonText}>
                  {isTransmitting ? '⏳' : '>'}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#000',
  },
  permissionTitle: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionText: {
    color: '#006400',
    fontFamily: 'monospace',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  permissionButton: {
    borderWidth: 2,
    borderColor: '#00ff00',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#0a0a0a',
  },
  permissionButtonText: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraContainer: {
    height: height * 0.3,
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    padding: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#00ff00',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginRight: 8,
  },
  indicatorActive: {
    backgroundColor: '#00ff00',
    shadowColor: '#00ff00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  statusText: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  decodedContainer: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,255,0,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00ff00',
  },
  decodedText: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
  },
  packetContainer: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  packetReceiving: {
    backgroundColor: 'rgba(255,165,0,0.2)',
    borderColor: '#ffaa00',
  },
  packetComplete: {
    backgroundColor: 'rgba(0,255,0,0.2)',
    borderColor: '#00ff00',
  },
  packetText: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontSize: 12,
    textAlign: 'center',
  },
  torchIndicator: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,165,0,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ffaa00',
  },
  torchText: {
    color: '#ffaa00',
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: '#00ff00',
    alignSelf: 'center',
    marginBottom: 40,
    opacity: 0.5,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
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
    zIndex: 2,
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
  bubbleContainer: {
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
  inputWrapper: {
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#00ff00',
    zIndex: 1000,
    elevation: 1000,
    shadowColor: '#00ff00',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputWrapperActive: {
    borderTopWidth: 2,
    borderTopColor: '#39ff14',
    shadowOpacity: 0.3,
  },
  inputWrapperDisabled: {
    borderTopColor: '#ffaa00',
    opacity: 0.8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    paddingHorizontal: 12,
    backgroundColor: '#000',
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
  inputDisabled: {
    borderColor: '#ffaa00',
    color: '#666',
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
    shadowColor: '#00ff00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#0a330a',
    borderColor: '#006400',
    shadowOpacity: 0.1,
  },
  sendButtonText: {
    color: '#000',
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: 'bold',
  },
});