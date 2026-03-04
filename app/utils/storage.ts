import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatSession } from '../Types';

const STORAGE_KEY = '@chat_history';

export const saveChatSession = async (session: ChatSession) => {
  try {
    const existing = await getChatSessions();
    const updated = [session, ...existing];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error('Error saving chat session:', error);
    return false;
  }
};

export const getChatSessions = async (): Promise<ChatSession[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading chat sessions:', error);
    return [];
  }
};

export const deleteChatSession = async (sessionId: string) => {
  try {
    const sessions = await getChatSessions();
    const filtered = sessions.filter(s => s.id !== sessionId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting chat session:', error);
    return false;
  }
};

export const updateChatSession = async (sessionId: string, messages: Message[]) => {
  try {
    const sessions = await getChatSessions();
    const updated = sessions.map(s => 
      s.id === sessionId 
        ? { ...s, messages, preview: messages[messages.length - 1]?.text }
        : s
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error('Error updating chat session:', error);
    return false;
  }
};