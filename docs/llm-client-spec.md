# Mini-spec: LLM Client

## Назначение
LLM Client даёт единый интеграционный слой для OpenAI-compatible моделей, которые использует прототип.

Ответственность:
- хранение и применение connection config
- выполнение chat completion запросов
- возврат стабильного response shape для chat pipeline
- отделение HTTP-деталей от UI и process logic

## Поддерживаемые провайдеры
Поддерживаются два режима провайдера:
- `openrouter`
- `local`

UI и клиентский код должны использовать одну внутреннюю форму конфигурации.

## Модель подключения
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

Примечания:
- `transport` имеет смысл только для `openrouter`
- `local` в MVP всегда использует server transport
- `browser` для `openrouter` является экспериментальным режимом
- `server` для `openrouter` остаётся рекомендуемым сценарием

## Вариант 1. OpenRouter
### Обязательные поля
- `provider: 'openrouter'`
- `apiKey`
- `model`
- `temperature`

### Необязательные поля
- `baseUrl`
По умолчанию:
- `https://openrouter.ai/api/v1`

### Поддерживаемые транспорты
1. `server`
Рекомендуемый режим.
Frontend вызывает локальный backend proxy, а backend вызывает OpenRouter.

2. `browser`
Экспериментальный режим.
Frontend вызывает OpenRouter напрямую из браузера.
Этот режим полезен в некоторых VPN/network сценариях, но может ломаться в отдельных браузерах или при жёстких сетевых политиках.

## Вариант 2. Локальная внутренняя модель
### Обязательные поля
- `provider: 'local'`
- `baseUrl`
- `apiKey`
- `model`
- `temperature`

### Примечание для MVP
На первом этапе дополнительных local-specific полей не требуется.

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

## Требования к обработке ошибок
Клиент должен различать как минимум:
- configuration error
- upstream API error
- network error
- malformed response
- timeout

Рекомендуемый формат error payload:
```json
{
  "error": {
    "code": "network_error",
    "message": "fetch failed | code=ECONNRESET | host=openrouter.ai"
  }
}
```

## Что уже реализовано в итерации 1
- OpenRouter через local proxy
- OpenRouter через browser-direct experimental mode
- local OpenAI-compatible provider через proxy
- улучшенная proxy-диагностика для upstream и network ошибок

## Нефункциональные требования
- backend timeout должен оставаться конфигурируемым позже
- `temperature` должна всегда передаваться явно
- connection config не должен смешиваться с process data
- chat history не должна смешиваться с transport implementation details
- streaming можно добавить позже без ломки базового контракта
