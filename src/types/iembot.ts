export interface IEMBotMessage {
  id: string;
  channel: string;
  source: string;
  text: string;
  timestamp: Date;
  product?: string;
  wfo?: string;
  phenomena?: string;
  significance?: string;
  eventId?: string;
}

export interface IEMBotChannel {
  id: string;
  name: string;
  description: string;
}
