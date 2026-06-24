import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  makeTiming,
  MorseDecoder,
  MorseTiming,
  DEFAULT_UNIT_MS,
} from "../utils/morse";

export type ReceiverConfig = {
  unitMs?: number;
  calibrationSamples?: number;
  onDelta?: number;
  hysteresis?: number;
  idleUnits?: number;
};

export type ReceiverState = {
  isCalibrated: boolean;
  ambient: number;
  level: number;
  signalOn: boolean;
  liveText: string;
  pushSample: (brightness: number, timestamp: number) => void;
  reset: () => void;
};

const DEFAULTS = {
  calibrationSamples: 24,
  onDelta: 40,
  hysteresis: 18,
  idleUnits: 10,
};

const LEVEL_UI_INTERVAL_MS = 100;

export function useMorseReceiver(
  onMessage: (text: string) => void,
  config: ReceiverConfig = {}
): ReceiverState {
  const unitMs = config.unitMs ?? DEFAULT_UNIT_MS;
  const calibrationSamples = config.calibrationSamples ?? DEFAULTS.calibrationSamples;
  const onDelta = config.onDelta ?? DEFAULTS.onDelta;
  const hysteresis = config.hysteresis ?? DEFAULTS.hysteresis;
  const idleUnits = config.idleUnits ?? DEFAULTS.idleUnits;

  const timing = useMemo<MorseTiming>(() => makeTiming(unitMs), [unitMs]);

  const [isCalibrated, setIsCalibrated] = useState(false);
  const [ambient, setAmbient] = useState(0);
  const [level, setLevel] = useState(0);
  const [signalOn, setSignalOn] = useState(false);
  const [liveText, setLiveText] = useState("");

  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLevelUiRef = useRef(0);

  const stateRef = useRef({
    calibrating: true,
    calibrationBuffer: [] as number[],
    ambient: 0,
    onThreshold: Number.POSITIVE_INFINITY,
    offThreshold: Number.POSITIVE_INFINITY,
    smoothed: 0,
    isOn: false,
  });

  const decoderRef = useRef<MorseDecoder | null>(null);
  if (decoderRef.current === null) {
    decoderRef.current = new MorseDecoder(timing, {
      onText: (text) => setLiveText(text),
    });
  }

  useEffect(() => {
    decoderRef.current = new MorseDecoder(timing, {
      onText: (text) => setLiveText(text),
    });
  }, [timing]);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const scheduleIdleFlush = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      const decoder = decoderRef.current;
      if (!decoder) return;
      const message = decoder.finalize();
      setLiveText("");
      if (message) onMessageRef.current(message);
    }, timing.unit * idleUnits);
  }, [clearIdleTimer, timing.unit, idleUnits]);

  const reset = useCallback(() => {
    clearIdleTimer();
    decoderRef.current?.reset();
    stateRef.current = {
      calibrating: true,
      calibrationBuffer: [],
      ambient: 0,
      onThreshold: Number.POSITIVE_INFINITY,
      offThreshold: Number.POSITIVE_INFINITY,
      smoothed: 0,
      isOn: false,
    };
    setIsCalibrated(false);
    setAmbient(0);
    setLevel(0);
    setSignalOn(false);
    setLiveText("");
  }, [clearIdleTimer]);

  const pushSample = useCallback(
    (brightness: number, timestamp: number) => {
      const s = stateRef.current;

      s.smoothed = s.smoothed === 0 ? brightness : s.smoothed * 0.6 + brightness * 0.4;
      const value = s.smoothed;

      if (timestamp - lastLevelUiRef.current >= LEVEL_UI_INTERVAL_MS) {
        lastLevelUiRef.current = timestamp;
        setLevel(Math.round(value));
      }

      if (s.calibrating) {
        s.calibrationBuffer.push(brightness);
        if (s.calibrationBuffer.length >= calibrationSamples) {
          const sum = s.calibrationBuffer.reduce((a, b) => a + b, 0);
          const avg = sum / s.calibrationBuffer.length;
          s.ambient = avg;
          s.onThreshold = avg + onDelta;
          s.offThreshold = avg + onDelta - hysteresis;
          s.calibrating = false;
          setAmbient(Math.round(avg));
          setIsCalibrated(true);
        }
        return;
      }

      let nextOn = s.isOn;
      if (!s.isOn && value >= s.onThreshold) nextOn = true;
      else if (s.isOn && value <= s.offThreshold) nextOn = false;

      if (nextOn !== s.isOn) {
        s.isOn = nextOn;
        setSignalOn(nextOn);
        decoderRef.current?.edge(nextOn, timestamp);
        scheduleIdleFlush();
      }
    },
    [calibrationSamples, onDelta, hysteresis, scheduleIdleFlush]
  );

  useEffect(() => clearIdleTimer, [clearIdleTimer]);

  return {
    isCalibrated,
    ambient,
    level,
    signalOn,
    liveText,
    pushSample,
    reset,
  };
}
