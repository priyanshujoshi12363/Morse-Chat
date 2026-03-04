export type Message = {
  id: string;
  type: 'sent' | 'received';
  text: string;
  timestamp: number;
};

export type ChatSession = {
  id: string;
  date: string;
  messages: Message[];
  preview?: string;
};