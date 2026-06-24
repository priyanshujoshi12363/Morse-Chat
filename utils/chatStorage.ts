import AsyncStorage from "@react-native-async-storage/async-storage";

export type Message = {
  id: string;
  type: "sent" | "received";
  text: string;
  timestamp: number;
};

export type ChatSession = {
  id: string;
  date: string;
  messages: Message[];
  preview?: string;
};

const STORAGE_KEY = "@morsechat/sessions";

export async function getSessions(): Promise<ChatSession[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ChatSession[]) : [];
  } catch (error) {
    console.error("Failed to load chat sessions:", error);
    return [];
  }
}

export async function saveSession(session: ChatSession): Promise<void> {
  try {
    const sessions = await getSessions();
    const index = sessions.findIndex((s) => s.id === session.id);
    if (index >= 0) sessions[index] = session;
    else sessions.unshift(session);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to save chat session:", error);
  }
}

export async function deleteSession(sessionId: string): Promise<ChatSession[]> {
  try {
    const sessions = await getSessions();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (error) {
    console.error("Failed to delete chat session:", error);
    return getSessions();
  }
}

export function makeMessageId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
