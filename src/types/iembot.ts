export interface IEMBotMessage {
  seqnum: number;
  timestamp: string; // "2026-04-27 14:26:44" (UTC)
  author: string;
  productId: string;
  message: string; // HTML content
  room: string;
  read: boolean;
}

export interface IEMBotRawMessage {
  seqnum: number;
  ts: string;
  author: string;
  product_id: string;
  message: string;
}

export interface IEMBotConfig {
  rooms: string[];
  pollInterval: number; // ms (default 10000)
  enabled: boolean;
  telegramNotify: boolean;
}
