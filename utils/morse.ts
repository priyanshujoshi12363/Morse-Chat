export const MORSE_CODE: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",

  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  "0": "-----",

  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  "_": "..--.-",
  '"': ".-..-.",
  "@": ".--.-.",
};

export const MORSE_TO_CHAR: Record<string, string> = Object.entries(
  MORSE_CODE
).reduce<Record<string, string>>((acc, [char, code]) => {
  acc[code] = char;
  return acc;
}, {});

export const WORD_SEPARATOR = "/";

export const DEFAULT_UNIT_MS = 140;

export const SPEED_PRESETS = {
  FAST: 100,
  NORMAL: 140,
  SAFE: 200,
} as const;

export type SpeedName = keyof typeof SPEED_PRESETS;

export type MorseTiming = {
  unit: number;
  dot: number;
  dash: number;
  symbolGap: number;
  letterGap: number;
  wordGap: number;
};

export function makeTiming(unit: number = DEFAULT_UNIT_MS): MorseTiming {
  return {
    unit,
    dot: unit,
    dash: unit * 3,
    symbolGap: unit,
    letterGap: unit * 3,
    wordGap: unit * 7,
  };
}

export function textToMorse(text: string): string {
  return text
    .toUpperCase()
    .split("")
    .map((char) => (char === " " ? WORD_SEPARATOR : MORSE_CODE[char] ?? ""))
    .filter((code) => code !== "")
    .join(" ");
}

export function morseToText(morse: string): string {
  return morse
    .trim()
    .split(/\s*\/\s*/)
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .map((code) => MORSE_TO_CHAR[code] ?? "")
        .join("")
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export default textToMorse;

export type TorchEvent = {
  time: number;
  on: boolean;
};

export function buildTransmitPlan(
  text: string,
  timing: MorseTiming = makeTiming()
): { events: TorchEvent[]; duration: number } {
  const events: TorchEvent[] = [];
  let t = 0;

  const words = text.toUpperCase().trim().split(/\s+/).filter(Boolean);

  words.forEach((word, wordIndex) => {
    if (wordIndex > 0) t += timing.wordGap;

    const letters = word.split("").filter((c) => MORSE_CODE[c]);

    letters.forEach((letter, letterIndex) => {
      if (letterIndex > 0) t += timing.letterGap;

      const symbols = MORSE_CODE[letter];
      symbols.split("").forEach((symbol, symbolIndex) => {
        if (symbolIndex > 0) t += timing.symbolGap;
        events.push({ time: t, on: true });
        t += symbol === "." ? timing.dot : timing.dash;
        events.push({ time: t, on: false });
      });
    });
  });

  return { events, duration: t };
}

export type DecoderCallbacks = {
  onSymbol?: (symbol: "." | "-") => void;
  onText?: (text: string) => void;
};

export class MorseDecoder {
  private timing: MorseTiming;
  private callbacks: DecoderCallbacks;

  private isOn = false;
  private onStart = 0;
  private lastFall = 0;
  private currentSymbol = "";
  private text = "";

  private readonly minSymbolRatio = 0.35;

  constructor(timing: MorseTiming = makeTiming(), callbacks: DecoderCallbacks = {}) {
    this.timing = timing;
    this.callbacks = callbacks;
  }

  edge(on: boolean, t: number): void {
    if (on === this.isOn) return;
    this.isOn = on;
    if (on) this.handleRise(t);
    else this.handleFall(t);
  }

  private handleRise(t: number): void {
    if (this.lastFall > 0) {
      this.classifyGap(t - this.lastFall);
    }
    this.onStart = t;
  }

  private handleFall(t: number): void {
    const duration = t - this.onStart;
    if (duration < this.timing.unit * this.minSymbolRatio) {
      return;
    }
    const symbol = duration < this.timing.unit * 2 ? "." : "-";
    this.currentSymbol += symbol;
    this.callbacks.onSymbol?.(symbol);
    this.lastFall = t;
  }

  private classifyGap(gap: number): void {
    if (gap < this.timing.unit * 2) {
      return;
    }
    this.commitLetter();
    if (gap >= this.timing.unit * 5) {
      if (this.text.length > 0 && !this.text.endsWith(" ")) {
        this.text += " ";
        this.callbacks.onText?.(this.text);
      }
    }
  }

  private commitLetter(): void {
    if (!this.currentSymbol) return;
    const char = MORSE_TO_CHAR[this.currentSymbol];
    this.currentSymbol = "";
    if (char) {
      this.text += char;
      this.callbacks.onText?.(this.text);
    }
  }

  finalize(): string {
    this.commitLetter();
    const result = this.text.trim();
    this.reset();
    return result;
  }

  hasPending(): boolean {
    return this.currentSymbol.length > 0 || this.text.length > 0;
  }

  getText(): string {
    return (this.text + this.currentSymbolPreview()).trim();
  }

  private currentSymbolPreview(): string {
    if (!this.currentSymbol) return "";
    return MORSE_TO_CHAR[this.currentSymbol] ?? "";
  }

  reset(): void {
    this.isOn = false;
    this.onStart = 0;
    this.lastFall = 0;
    this.currentSymbol = "";
    this.text = "";
  }
}
