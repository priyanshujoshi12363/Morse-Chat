import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { CameraView as ExpoCameraView, useCameraPermissions } from 'expo-camera';

const { height } = Dimensions.get('window');

interface CameraViewProps {
  isScanning: boolean;
  onSignalDetected?: () => void;
}

export default function CameraView({ isScanning, onSignalDetected }: CameraViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [signalDetected, setSignalDetected] = useState(false);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  // Simulate signal detection for demo
  useEffect(() => {
    if (isScanning) {
      const interval = setInterval(() => {
        if (Math.random() > 0.7) {
          setSignalDetected(true);
          onSignalDetected?.();
          setTimeout(() => setSignalDetected(false), 2000);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [isScanning]);

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>NO CAMERA ACCESS</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoCameraView 
        style={styles.camera}
        facing="back"
        mute={true}
        responsiveOrientationWhenOrientationLocked
      />
      {/* Overlay using absolute positioning instead of children */}
      <View style={styles.overlay}>
        <View style={styles.statusContainer}>
          <View style={[styles.indicator, isScanning && styles.indicatorActive]} />
          <Text style={styles.statusText}>
            {signalDetected ? '⚡ SIGNAL DETECTED' : isScanning ? '● SCANNING' : '● IDLE'}
          </Text>
        </View>
        <View style={styles.scanFrame} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: height * 0.3, // 30% of screen height
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
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
  scanFrame: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: '#00ff00',
    alignSelf: 'center',
    marginBottom: 40,
    opacity: 0.5,
  },
  text: {
    color: '#00ff00',
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: 20,
  },
});