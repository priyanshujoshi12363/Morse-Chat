<div align="center">

# 🔦 Morse-Chat

**Talk between two phones using light — no internet, no Bluetooth, no SIM.**

One phone blinks your message in Morse code with its torch.
The other phone watches through its camera, decodes the blinks, and shows the text.

</div>

---

## What it is

Morse-Chat turns the flashlight + camera that every phone already has into a
short-range optical link. Type a message, and the torch flashes it as Morse
code; point a second phone's camera at that torch and the message is decoded
back into text in real time. It works fully offline — the only thing travelling
between the phones is light.

The interface is a dark, terminal-style chat: sent messages on the right,
decoded messages on the left, with a live camera scanner and signal meter on top.

## How it works

Each phone is in one of two modes, so it's either talking or listening:

| Mode | Torch | Camera | Role |
|------|:-----:|:------:|------|
| 🔦 **SEND** | blinks the message | off | transmitter |
| 📷 **RECEIVE** | off | scanning | receiver |

Splitting the two is what makes the link reliable: a phone never decodes its
own torch, and the camera and torch never fight over the hardware.

**Chat between two phones:**

1. Phone A → **SEND**, Phone B → **RECEIVE**.
2. Make sure **both phones are set to the same SPEED**.
3. Hold A's torch a few centimetres from B's back camera and keep it steady.
4. Type on A and tap ➤. B calibrates to the room light for a moment, then
   decodes the flashes into text.
5. Swap modes to reply.

### The timing model

Morse is measured in *units*, where one unit is the length of a dot. The sender
and receiver agree on this exactly:

```
dot        = 1 unit (on)      symbol gap = 1 unit (off, within a letter)
dash       = 3 units (on)     letter gap = 3 units (off, between letters)
                              word gap   = 7 units (off, between words)
```

The decoder classifies every interval with **midpoint thresholds** (a pulse is a
dot below 2 units and a dash above; a gap continues a letter, ends a letter, or
ends a word). Because every interval is classified as *something*, no signal is
silently dropped.

## Speed

A **SPEED** control on the main screen trades transmission time for robustness.
Both phones must use the **same** preset.

| Preset | Unit | "HELLO" | Best for |
|--------|:----:|:-------:|----------|
| ⚡ FAST | 100 ms | ~5 s | a steady 30 fps camera, close range |
| ● NORMAL | 140 ms | ~7 s | the reliable default |
| 🛡 SAFE | 200 ms | ~10 s | dim light, shaky hands, slower cameras |

In a transmit→decode simulation, FAST and NORMAL decode 100 % within one frame
of timing jitter (±33 ms at 30 fps); NORMAL still holds ~96 % at ±50 ms, where
FAST begins to drop — which is why NORMAL is the default.

## Features

- 🔦 Flashlight Morse transmission with a precise on/off schedule
- 📷 Live camera decoding with ambient-light calibration and a signal meter
- ⚡ Three selectable speeds
- 💬 Terminal-style chat UI with the Morse shown under each sent message
- 📳 Haptic feedback on send, mode switch, and message received
- 💾 Local chat history (tap to reopen a conversation, hold to delete)
- 📡 Fully offline — no network permission needed to communicate
- 📱 Responsive layout that respects notches and on-screen nav bars

## Tech stack

- **Expo** (React Native) + **Expo Router**, written in **TypeScript**
- **react-native-vision-camera** — camera, frame processor, and torch control
- **vision-camera-resize-plugin** — crops the frame centre for brightness sampling
- **AsyncStorage** — local chat history
- **expo-haptics** — tactile feedback

## Project structure

```
utils/
  morse.ts              Alphabet, text<->morse, timing model, MorseDecoder
  chatStorage.ts        AsyncStorage chat persistence (shared types)
hooks/
  useMorseTransmitter.ts  Torch blink scheduler
  useMorseReceiver.ts     Brightness -> calibrate -> decode -> message
app/(tabs)/
  index.tsx             Main screen: SEND / RECEIVE modes + chat
  history.tsx           Saved conversations
```

`utils/morse.ts` is framework-agnostic and the single source of truth for all
Morse logic.

## Getting started

This app uses native camera modules, so it needs a **development build** — it
does **not** run in Expo Go.

```bash
npm install

# Android (with a device/emulator connected):
npx expo run:android

# or build in the cloud with EAS:
npx eas build --profile development --platform android

# then start the dev server and open it in the dev client:
npm start
```

## Troubleshooting

- **Nothing decodes:** make sure both phones are on the **same SPEED**, the
  torch points straight at the receiver's back camera, and you're holding steady.
- **Garbled text:** move to **NORMAL** or **SAFE**, or reduce the distance.
- **Bright room:** decoding needs the torch to clearly outshine the background.
  The light-detection thresholds (`onDelta` / `hysteresis`) live in
  `useMorseReceiver`, and the speed presets in `SPEED_PRESETS` in `utils/morse.ts`.

## Privacy

Everything happens on the device. Morse-Chat uses the camera only to read light
in real time — frames are never stored or uploaded — and chat history is saved
locally on your phone. No data leaves the device.
