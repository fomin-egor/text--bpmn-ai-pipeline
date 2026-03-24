# Mini-spec: LLM Client

## Purpose
LLM Client provides a single integration layer for OpenAI-compatible models used by the prototype.

Responsibilities:
- store and apply connection config
- execute chat completion requests
- return a stable response shape for the chat pipeline
- keep HTTP details separate from UI and process logic

## Supported providers
Two provider modes are supported:
- `openrouter`
- `local`

The UI and client code should keep one internal config shape.

## Connection model
```ts
export interface LlmConnectionConfig {
  provider: 'openrouter' | 'local';
  transport: 'server' | 'browser';
  baseUrl?: string;
  apiKey: string;
  model: string;
  temperature: number;
}
```

Notes:
- `transport` is meaningful only for `openrouter`
- `local` always uses server transport in MVP
- `browser` for `openrouter` is experimental
- `server` for `openrouter` is the recommended path

## Variant 1. OpenRouter
### Required fields
- `provider: 'openrouter'`
- `apiKey`
- `model`
- `temperature`

### Optional fields
- `baseUrl`
Default:
- `https://openrouter.ai/api/v1`

### Supported transports
1. `server`
Recommended.
The frontend calls local backend proxy, and the backend calls OpenRouter.

2. `browser`
Experimental.
The frontend calls OpenRouter directly from the browser.
This mode is useful for some VPN/network scenarios, but may fail in certain browsers or network policies.

## Variant 2. Local internal model
### Required fields
- `provider: 'local'`
- `baseUrl`
- `apiKey`
- `model`
- `temperature`

### MVP note
No additional local-model-specific fields are required in the first stage.

## Backend API
### Endpoint
`POST /api/llm/chat`

### Request
```json
{
  "connection": {
    "provider": "openrouter",
    "transport": "server",
    "apiKey": "...",
    "model": "openai/gpt-5-mini",
    "temperature": 0.2
  },
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ]
}
```

### Response
```json
{
  "message": {
    "role": "assistant",
    "content": "..."
  },
  "raw": {
    "provider": "openrouter",
    "model": "openai/gpt-5-mini",
    "transport": "server"
  }
}
```

## Error handling requirements
The client should distinguish at least:
- configuration error
- upstream API error
- network error
- malformed response
- timeout

Recommended error payload shape:
```json
{
  "error": {
    "code": "network_error",
    "message": "fetch failed | code=ECONNRESET | host=openrouter.ai"
  }
}
```

## Current implementation notes
Implemented in iteration 1:
- OpenRouter via local proxy
- OpenRouter via browser-direct experimental mode
- local OpenAI-compatible provider via proxy
- improved proxy diagnostics for upstream and network failures

## Non-functional requirements
- backend timeout should remain configurable later
- `temperature` should always be passed explicitly
- connection config should not be mixed with process data
- chat history should not be mixed with transport implementation details
- streaming may be added later without breaking the base contract
