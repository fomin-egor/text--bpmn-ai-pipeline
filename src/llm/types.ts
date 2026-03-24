export type LlmProvider = 'openrouter' | 'local';
export type LlmTransport = 'browser' | 'server';

export interface LlmConnectionConfig {
  provider: LlmProvider;
  transport: LlmTransport;
  baseUrl?: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChatResponse {
  message: ChatMessage;
  raw: {
    provider: string;
    model: string;
    transport: LlmTransport;
  };
}
