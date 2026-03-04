🔦 Morse-Chat
A fun experimental mobile app that sends and receives text messages using light signals from a phone’s flashlight.
The receiving phone detects blinking patterns through the camera and decodes them into text in real time.

The interface is designed like a hacker terminal, with a live scanning camera and chat-style messaging in the same screen.

🚀 Features

🔦 Flashlight Signal Transmission
Convert text into blinking light signals.

📷 Live Camera Signal Detection
The receiver scans incoming light patterns through the camera.

🧠 Morse-style Decoding
Blink durations are decoded into dots and dashes, then converted back into text.

💬 Chat-style Interface
Messages appear in a WhatsApp-like layout:

Incoming messages on the left

Sent messages on the right

🖥 Hacker Terminal UI
Dark theme with neon-green terminal-style logs.

💾 Chat History
Messages are stored locally and displayed in a history panel similar to ChatGPT's mobile interface.

📡 Offline Communication
Works without internet — communication happens via light.

🧠 How It Works
Sender

User types a message.

Text is converted into Morse-style signals.

Flashlight blinks according to the encoded pattern.

Receiver

Camera continuously scans for brightness changes.

Blink durations are measured.

Patterns are converted into Morse signals.

Morse signals are decoded into readable text.

Message appears in the chat interface.

📱 App Interface
--------------------------------
|  LIVE CAMERA SCANNER         |
|  ● SCANNING FOR SIGNAL       |
|                              |
|  [ Camera Preview ]          |
--------------------------------
|  CHAT TERMINAL               |
|                              |
|  Incoming messages           |
|  Outgoing messages           |
|                              |
|  _                           |
--------------------------------
🛠 Tech Stack

Expo (React Native)

TypeScript (.tsx)

Expo Router

Expo Camera

AsyncStorage for local history

EAS Development Client