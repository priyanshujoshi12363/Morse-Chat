import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  AppState,
  Animated,
  Easing,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import { useMorseTransmitter } from '../../hooks/useMorseTransmitter';
import { useMorseReceiver } from '../../hooks/useMorseReceiver';
import {
  textToMorse,
  SPEED_PRESETS,
  SpeedName,
} from '../../utils/morse';
import {
  ChatSession,
  Message,
  saveSession,
  makeMessageId,
} from '../../utils/chatStorage';

const { height } = Dimensions.get('window');

const CENTER_REGION = 0.25;

const COLORS = {
  green: '#00ff00',
  greenDim: '#006400',
  greenBright: '#39ff14',
  amber: '#ffaa00',
  bg: '#000',
  panel: '#0a0a0a',
};

type Mode = 'send' | 'receive';

export default function ChatScreen() {
  const [mode, setMode] = useState<Mode>('send');
  const [speed, setSpeed] = useState<SpeedName>('NORMAL');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [cameraActive, setCameraActive] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const unitMs = SPEED_PRESETS[speed];
  const insets = useSafeAreaInsets();

  const sessionIdRef = useRef(`chat_${Date.now()}`);
  const flatListRef = useRef<FlatList<Message>>(null);

  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const { torchOn, isTransmitting, progress, transmit, cancel } =
    useMorseTransmitter(unitMs);

  const handleDecodedMessage = useCallback((text: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    const received: Message = {
      id: makeMessageId('rx'),
      type: 'received',
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, received]);
  }, []);

  const receiver = useMorseReceiver(handleDecodedMessage, { unitMs });
  const { pushSample, reset: resetReceiver } = receiver;

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) =>
      setCameraActive(s === 'active')
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (mode === 'receive') resetReceiver();
    else cancel();
  }, [mode, resetReceiver, cancel]);

  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => {
      setKeyboardVisible(true);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        50
      );
    });
    const hideSub = Keyboard.addListener(hideEvt, () =>
      setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    const session: ChatSession = {
      id: sessionIdRef.current,
      date: new Date().toISOString().split('T')[0],
      messages,
      preview: messages[messages.length - 1]?.text ?? '',
    };
    saveSession(session);
    requestAnimationFrame(() =>
      flatListRef.current?.scrollToEnd({ animated: true })
    );
  }, [messages]);

  const scanning = mode === 'receive' && cameraActive;

  const onBrightness = useCallback(
    (brightness: number) => pushSample(brightness, Date.now()),
    [pushSample]
  );
  const onBrightnessJS = useMemo(
    () => Worklets.createRunOnJS(onBrightness),
    [onBrightness]
  );
  const { resize } = useResizePlugin();

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (!scanning) return;

      const size = CENTER_REGION;
      const cropW = Math.floor(frame.width * size);
      const cropH = Math.floor(frame.height * size);
      const startX = Math.floor((frame.width - cropW) / 2);
      const startY = Math.floor((frame.height - cropH) / 2);

      const pixels = resize(frame, {
        crop: { x: startX, y: startY, width: cropW, height: cropH },
        scale: { width: 8, height: 8 },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });

      let total = 0;
      let count = 0;
      for (let i = 0; i < pixels.length; i += 3) {
        total += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        count++;
      }
      if (count > 0) onBrightnessJS(total / count);
    },
    [scanning, onBrightnessJS, resize]
  );

  const switchMode = useCallback(
    (next: Mode) => {
      if (isTransmitting) return;
      Haptics.selectionAsync().catch(() => {});
      setMode(next);
    },
    [isTransmitting]
  );

  const changeSpeed = useCallback(
    (next: SpeedName) => {
      if (isTransmitting || next === speed) return;
      Haptics.selectionAsync().catch(() => {});
      setSpeed(next);
      if (mode === 'receive') resetReceiver();
    },
    [isTransmitting, speed, mode, resetReceiver]
  );

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isTransmitting) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const sent: Message = {
      id: makeMessageId('tx'),
      type: 'sent',
      text: text.toUpperCase(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, sent]);
    setInputText('');
    transmit(text);
  }, [inputText, isTransmitting, transmit]);

  const handleClear = useCallback(() => {
    Alert.alert('Clear chat', 'Delete this conversation?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'DELETE',
        style: 'destructive',
        onPress: () => {
          setMessages([]);
          sessionIdRef.current = `chat_${Date.now()}`;
          resetReceiver();
        },
      },
    ]);
  }, [resetReceiver]);

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.gate}>
          <Text style={styles.gateGlyph}>🔦</Text>
          <Text style={styles.gateTitle}>CAMERA ACCESS REQUIRED</Text>
          <Text style={styles.gateText}>
            Morse-Chat needs the camera to receive light signals and the torch
            to send them.
          </Text>
          <TouchableOpacity style={styles.gateButton} onPress={requestPermission}>
            <Text style={styles.gateButtonText}>GRANT ACCESS</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (device == null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.gate}>
          <Text style={styles.gateGlyph}>📷</Text>
          <Text style={styles.gateTitle}>NO CAMERA FOUND</Text>
          <Text style={styles.gateText}>
            This device has no compatible back camera.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const sending = mode === 'send';
  const accent = sending ? COLORS.amber : COLORS.green;
  const active = sending ? isTransmitting : receiver.signalOn;
  const bottomInset = keyboardVisible ? 0 : insets.bottom;

  const statusLabel = sending
    ? isTransmitting
      ? 'TRANSMITTING'
      : 'READY TO SEND'
    : !receiver.isCalibrated
    ? 'CALIBRATING'
    : receiver.signalOn
    ? 'SIGNAL DETECTED'
    : 'SCANNING';

  const meterFill = receiver.isCalibrated
    ? Math.max(
        0,
        Math.min(1, (receiver.level - receiver.ambient) / 60)
      )
    : 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/history')} hitSlop={10}>
          <Text style={styles.headerIcon}>📁</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>MORSE·CHAT</Text>
          <Text style={[styles.headerSub, { color: accent }]}>
            {statusLabel}
          </Text>
        </View>
        <TouchableOpacity onPress={handleClear} hitSlop={10}>
          <Text style={styles.headerIcon}>🗑️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.modeSwitch}>
        <ModeButton
          label="SEND"
          glyph="🔦"
          active={sending}
          accent={COLORS.amber}
          disabled={isTransmitting}
          onPress={() => switchMode('send')}
        />
        <ModeButton
          label="RECEIVE"
          glyph="📷"
          active={!sending}
          accent={COLORS.green}
          disabled={isTransmitting}
          onPress={() => switchMode('receive')}
        />
      </View>

      <View style={styles.speedRow}>
        <Text style={styles.speedLabel}>SPEED</Text>
        {(['FAST', 'NORMAL', 'SAFE'] as SpeedName[]).map((name) => {
          const selected = speed === name;
          return (
            <TouchableOpacity
              key={name}
              style={[styles.speedChip, selected && styles.speedChipActive]}
              onPress={() => changeSpeed(name)}
              disabled={isTransmitting}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.speedChipText, selected && styles.speedChipTextActive]}
              >
                {name}
              </Text>
            </TouchableOpacity>
          );
        })}
        <Text style={styles.speedHint}>both phones must match</Text>
      </View>

      <View style={[styles.cameraContainer, { borderColor: accent }]}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={cameraActive}
          frameProcessor={frameProcessor}
          torch={sending && torchOn ? 'on' : 'off'}
          video={false}
          audio={false}
        />
        <View style={styles.cameraOverlay} pointerEvents="none">
          <View style={styles.overlayTop}>
            <View style={[styles.statusPill, { borderColor: accent }]}>
              <PulsingDot active={active} color={accent} />
              <Text style={[styles.statusPillText, { color: accent }]}>
                {statusLabel}
              </Text>
            </View>
            {!sending && receiver.isCalibrated && (
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>
                  AMB {receiver.ambient} · LVL {receiver.level}
                </Text>
              </View>
            )}
          </View>

          {!sending && (
            <View
              style={[
                styles.crosshair,
                { borderColor: receiver.signalOn ? COLORS.green : '#1f7a1f' },
              ]}
            />
          )}

          {sending && torchOn && (
            <View style={styles.torchBadge}>
              <Text style={styles.torchBadgeText}>🔦 FLASHING</Text>
            </View>
          )}

          <View style={styles.overlayBottom}>
            {!sending && receiver.liveText.length > 0 && (
              <Text style={styles.liveText} numberOfLines={1}>
                {receiver.liveText}
                <Text style={styles.liveCaret}>▋</Text>
              </Text>
            )}
            <View style={styles.meterTrack}>
              <View
                style={[
                  styles.meterFill,
                  {
                    backgroundColor: accent,
                    width: `${Math.round(
                      (sending ? progress : meterFill) * 100
                    )}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={[
            styles.messagesList,
            !sending && { paddingBottom: 16 + bottomInset },
          ]}
          ListEmptyComponent={<EmptyHint sending={sending} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {sending && (
          <View style={[styles.inputBar, { paddingBottom: 8 + bottomInset }]}>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, isTransmitting && styles.inputDisabled]}
                value={inputText}
                onChangeText={setInputText}
                placeholder={
                  isTransmitting ? 'TRANSMITTING…' : 'Type a message…'
                }
                placeholderTextColor={COLORS.greenDim}
                multiline
                maxLength={300}
                selectionColor={COLORS.green}
                editable={!isTransmitting}
              />
              {inputText.length > 0 && (
                <Text style={styles.counter}>{inputText.length}/300</Text>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isTransmitting) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || isTransmitting}
              activeOpacity={0.8}
            >
              <Text style={styles.sendButtonText}>
                {isTransmitting ? '…' : '➤'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ModeButton({
  label,
  glyph,
  active,
  accent,
  disabled,
  onPress,
}: {
  label: string;
  glyph: string;
  active: boolean;
  accent: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.modeButton,
        active && { borderColor: accent, backgroundColor: '#0d0d0d' },
        disabled && styles.modeButtonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.modeText, active && { color: accent }]}>
        {glyph} {label}
      </Text>
      {active && <View style={[styles.modeUnderline, { backgroundColor: accent }]} />}
    </TouchableOpacity>
  );
}

function PulsingDot({ active, color }: { active: boolean; color: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) {
      anim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 0.25,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, anim]);

  return (
    <Animated.View
      style={[
        styles.statusDot,
        { backgroundColor: active ? color : '#444', opacity: anim },
      ]}
    />
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isSent = message.type === 'sent';
  const morse = useMemo(
    () => (isSent ? textToMorse(message.text) : ''),
    [isSent, message.text]
  );
  return (
    <View
      style={[
        styles.bubbleRow,
        isSent ? styles.bubbleRowSent : styles.bubbleRowReceived,
      ]}
    >
      <View
        style={[styles.bubble, isSent ? styles.bubbleSent : styles.bubbleReceived]}
      >
        <Text style={styles.bubbleText}>{message.text}</Text>
        {!!morse && (
          <Text style={styles.bubbleMorse} numberOfLines={1}>
            {morse}
          </Text>
        )}
        <Text style={styles.bubbleTime}>
          {isSent ? '↑ ' : '↓ '}
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

function EmptyHint({ sending }: { sending: boolean }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyGlyph}>{sending ? '🔦' : '📡'}</Text>
      <Text style={styles.emptyText}>
        {sending
          ? 'Type a message and tap ➤ to flash it in Morse.'
          : 'Point at the other phone’s torch to receive.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },

  gate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  gateGlyph: { fontSize: 56, marginBottom: 20 },
  gateTitle: {
    color: COLORS.green,
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 1,
  },
  gateText: {
    color: '#009000',
    fontFamily: 'monospace',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  gateButton: {
    borderWidth: 2,
    borderColor: COLORS.green,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: COLORS.panel,
  },
  gateButtonText: {
    color: COLORS.green,
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0f2f0f',
    backgroundColor: COLORS.panel,
  },
  headerIcon: { fontSize: 20 },
  headerCenter: { alignItems: 'center' },
  headerTitle: {
    color: COLORS.green,
    fontFamily: 'monospace',
    fontSize: 17,
    letterSpacing: 4,
    fontWeight: 'bold',
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 2,
  },

  modeSwitch: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: COLORS.bg,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#143314',
    alignItems: 'center',
    backgroundColor: COLORS.panel,
    overflow: 'hidden',
  },
  modeButtonDisabled: { opacity: 0.4 },
  modeText: {
    color: '#3a7a3a',
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  modeUnderline: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    right: '25%',
    height: 2,
    borderRadius: 2,
  },

  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
  },
  speedLabel: {
    color: COLORS.greenDim,
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: 1,
    marginRight: 2,
  },
  speedChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#143314',
    backgroundColor: COLORS.panel,
  },
  speedChipActive: {
    borderColor: COLORS.green,
    backgroundColor: '#0d1f0d',
  },
  speedChipText: {
    color: '#3a7a3a',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  speedChipTextActive: { color: COLORS.green },
  speedHint: {
    color: '#2f6f2f',
    fontFamily: 'monospace',
    fontSize: 8,
    flex: 1,
    textAlign: 'right',
  },

  cameraContainer: {
    height: height * 0.26,
    marginHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: COLORS.bg,
    overflow: 'hidden',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 12,
    justifyContent: 'space-between',
  },
  overlayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  statusPillText: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  levelBadge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  levelBadgeText: {
    color: COLORS.green,
    fontFamily: 'monospace',
    fontSize: 10,
  },
  crosshair: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 54,
    height: 54,
    marginLeft: -27,
    marginTop: -27,
    borderWidth: 2,
    borderRadius: 27,
    opacity: 0.8,
  },
  torchBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.amber,
  },
  torchBadgeText: {
    color: COLORS.amber,
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  overlayBottom: { gap: 8 },
  liveText: {
    color: COLORS.greenBright,
    fontFamily: 'monospace',
    fontSize: 17,
    fontWeight: 'bold',
    letterSpacing: 2,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  liveCaret: { color: COLORS.green, opacity: 0.7 },
  meterTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  meterFill: { height: '100%', borderRadius: 2 },

  chatArea: { flex: 1, backgroundColor: COLORS.bg },
  messagesList: { padding: 12, paddingBottom: 16, flexGrow: 1 },

  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  emptyGlyph: { fontSize: 44, marginBottom: 16, opacity: 0.8 },
  emptyText: {
    color: COLORS.greenDim,
    fontFamily: 'monospace',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  bubbleRowSent: { justifyContent: 'flex-end' },
  bubbleRowReceived: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
  },
  bubbleSent: {
    borderColor: COLORS.greenBright,
    backgroundColor: '#0c160c',
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    borderColor: COLORS.greenDim,
    backgroundColor: '#0a330a',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: COLORS.green,
    fontFamily: 'monospace',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  bubbleMorse: {
    color: '#2f8f2f',
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 4,
    letterSpacing: 1,
  },
  bubbleTime: {
    color: COLORS.greenDim,
    fontFamily: 'monospace',
    fontSize: 9,
    alignSelf: 'flex-end',
    marginTop: 5,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 8 : 10,
    borderTopWidth: 1,
    borderTopColor: '#0f2f0f',
    backgroundColor: COLORS.panel,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1f7a1f',
    paddingRight: 12,
    justifyContent: 'center',
  },
  input: {
    color: COLORS.green,
    fontFamily: 'monospace',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
    paddingBottom: Platform.OS === 'ios' ? 12 : 8,
    maxHeight: 110,
    minHeight: 44,
  },
  inputDisabled: { color: '#666' },
  counter: {
    color: COLORS.greenDim,
    fontFamily: 'monospace',
    fontSize: 9,
    alignSelf: 'flex-end',
    paddingBottom: 6,
  },
  sendButton: {
    marginLeft: 8,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.green,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#143314',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: { color: '#000', fontSize: 19, fontWeight: 'bold' },
});
