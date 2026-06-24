import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildTransmitPlan,
  makeTiming,
  MorseTiming,
  DEFAULT_UNIT_MS,
} from "../utils/morse";

export type TransmitterState = {
  torchOn: boolean;
  isTransmitting: boolean;
  progress: number;
  transmit: (text: string) => Promise<void>;
  cancel: () => void;
};

export function useMorseTransmitter(
  unitMs: number = DEFAULT_UNIT_MS
): TransmitterState {
  const [torchOn, setTorchOn] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const timingRef = useRef<MorseTiming>(makeTiming(unitMs));

  useEffect(() => {
    timingRef.current = makeTiming(unitMs);
  }, [unitMs]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    setTorchOn(false);
    setIsTransmitting(false);
    setProgress(0);
  }, [clearTimers]);

  const transmit = useCallback(
    (text: string): Promise<void> => {
      const message = text.trim();
      if (!message) return Promise.resolve();

      clearTimers();

      const { events, duration } = buildTransmitPlan(message, timingRef.current);
      if (events.length === 0) return Promise.resolve();

      setIsTransmitting(true);
      setProgress(0);

      return new Promise<void>((resolve) => {
        events.forEach((event) => {
          const timer = setTimeout(() => {
            setTorchOn(event.on);
            setProgress(duration > 0 ? event.time / duration : 1);
          }, event.time);
          timersRef.current.push(timer);
        });

        const endTimer = setTimeout(() => {
          setTorchOn(false);
          setIsTransmitting(false);
          setProgress(1);
          resolve();
        }, duration + timingRef.current.unit);
        timersRef.current.push(endTimer);
      });
    },
    [clearTimers]
  );

  useEffect(() => clearTimers, [clearTimers]);

  return { torchOn, isTransmitting, progress, transmit, cancel };
}
