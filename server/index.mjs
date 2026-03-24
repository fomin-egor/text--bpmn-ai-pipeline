import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8');
  return rawBody ? JSON.parse(rawBody) : {};
}

function resolveBaseUrl(connection) {
  if (connection.provider === 'openrouter') {
    return (connection.baseUrl || OPENROUTER_BASE_URL).replace(/\/$/, '');
  }

  if (!connection.baseUrl) {
    throw new Error('baseUrl is required for local provider');
  }

  return connection.baseUrl.replace(/\/$/, '');
}

function validateRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be an object');
  }

  const connection = body.connection;
  const messages = body.messages;

  if (!connection || typeof connection !== 'object') {
    throw new Error('connection is required');
  }

  if (connection.provider !== 'openrouter' && connection.provider !== 'local') {
    throw new Error('connection.provider must be openrouter or local');
  }

  if (typeof connection.apiKey !== 'string' || !connection.apiKey.trim()) {
    throw new Error('connection.apiKey is required');
  }

  if (typeof connection.model !== 'string' || !connection.model.trim()) {
    throw new Error('connection.model is required');
  }

  if (typeof connection.temperature !== 'number' || Number.isNaN(connection.temperature)) {
    throw new Error('connection.temperature must be a number');
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages must be a non-empty array');
  }
}

function extractAssistantContent(responseJson) {
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

function describeError(error) {
  if (!(error instanceof Error)) {
    return 'Unknown request error';
  }

  const parts = [error.message];
  const cause = error.cause;

  if (cause && typeof cause === 'object') {
    const code = 'code' in cause ? cause.code : undefined;
    const errno = 'errno' in cause ? cause.errno : undefined;
    const syscall = 'syscall' in cause ? cause.syscall : undefined;
    const host = 'host' in cause ? cause.host : undefined;

    if (code) parts.push(`code=${String(code)}`);
    if (errno) parts.push(`errno=${String(errno)}`);
    if (syscall) parts.push(`syscall=${String(syscall)}`);
    if (host) parts.push(`host=${String(host)}`);
  }

  return parts.join(' | ');
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 404, { error: { code: 'not_found', message: 'Route not found' } });
    return;
  }

  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && requestUrl.pathname === '/api/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === '/api/llm/chat') {
    try {
      const body = await readJsonBody(request);
      validateRequest(body);

      const { connection, messages } = body;
      const baseUrl = resolveBaseUrl(connection);
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${connection.apiKey}`,
      };

      if (connection.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'http://localhost:5173';
        headers['X-Title'] = 'BPMN Dagre Prototype';
      }

      let upstreamResponse;

      try {
        upstreamResponse = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: connection.model,
            temperature: connection.temperature,
            messages,
          }),
        });
      } catch (error) {
        const message = describeError(error);
        console.error('[llm-proxy] upstream network error', {
          provider: connection.provider,
          baseUrl,
          model: connection.model,
          message,
        });
        sendJson(response, 502, {
          error: {
            code: 'network_error',
            message,
          },
        });
        return;
      }

      const rawText = await upstreamResponse.text();
      let responseJson = null;

      try {
        responseJson = rawText ? JSON.parse(rawText) : null;
      } catch {
        responseJson = null;
      }

      if (!upstreamResponse.ok) {
        console.error('[llm-proxy] upstream responded with error', {
          provider: connection.provider,
          baseUrl,
          model: connection.model,
          status: upstreamResponse.status,
          body: responseJson ?? rawText,
        });
        sendJson(response, upstreamResponse.status, {
          error: {
            code: 'upstream_error',
            message: responseJson?.error?.message || rawText || 'LLM request failed',
          },
        });
        return;
      }

      const content = extractAssistantContent(responseJson);

      sendJson(response, 200, {
        message: {
          role: 'assistant',
          content,
        },
        raw: {
          provider: connection.provider,
          model: connection.model,
          transport: 'server',
        },
      });
    } catch (error) {
      const message = describeError(error);
      console.error('[llm-proxy] bad request', message);
      sendJson(response, 400, {
        error: {
          code: 'bad_request',
          message,
        },
      });
    }

    return;
  }

  sendJson(response, 404, { error: { code: 'not_found', message: 'Route not found' } });
});

server.listen(PORT, () => {
  console.log(`LLM proxy listening on http://localhost:${PORT}`);
});
