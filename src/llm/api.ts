import type { ChatMessage, LlmChatResponse, LlmConnectionConfig } from './types';

interface LlmChatRequest {
  connection: LlmConnectionConfig;
  messages: ChatMessage[];
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

function extractAssistantContent(responseJson: any): string {
  const content = responseJson?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => typeof part?.text === 'string')
      .map((part) => part.text)
      .join('');
  }

  throw new Error('LLM response does not contain assistant content');
}

async function sendViaServer(request: LlmChatRequest): Promise<LlmChatResponse> {
  const response = await fetch('/api/llm/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'LLM request failed');
  }

  return payload as LlmChatResponse;
}

async function sendOpenRouterDirect(request: LlmChatRequest): Promise<LlmChatResponse> {
  const baseUrl = (request.connection.baseUrl || OPENROUTER_BASE_URL).replace(/\/$/, '');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${request.connection.apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'BPMN Dagre Prototype',
    },
    body: JSON.stringify({
      model: request.connection.model,
      temperature: request.connection.temperature,
      messages: request.messages,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'OpenRouter request failed');
  }

  return {
    message: {
      role: 'assistant',
      content: extractAssistantContent(payload),
    },
    raw: {
      provider: request.connection.provider,
      model: request.connection.model,
      transport: request.connection.transport,
    },
  };
}

export async function sendLlmChatRequest(request: LlmChatRequest): Promise<LlmChatResponse> {
  if (request.connection.provider === 'openrouter' && request.connection.transport === 'browser') {
    return sendOpenRouterDirect(request);
  }

  return sendViaServer(request);
}
