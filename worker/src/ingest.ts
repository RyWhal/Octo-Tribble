import {
  getEndpoint,
  insertRequest,
  incrementRequestCount,
  countRequestsForEndpoint,
  getOldestRequestId,
  deleteRequest,
} from './db';

export interface Env {
  DB: D1Database;
  MAX_BODY_BYTES?: string;
  MAX_REQUESTS_PER_ENDPOINT?: string;
}

function nanoid(size = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(size);
  crypto.getRandomValues(array);
  for (const byte of array) {
    result += chars[byte % chars.length];
  }
  return result;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleIngest(request: Request, env: Env, endpointId: string): Promise<Response> {
  const maxBodyBytes = parseInt(env.MAX_BODY_BYTES ?? '262144', 10);
  const maxRequests = parseInt(env.MAX_REQUESTS_PER_ENDPOINT ?? '500', 10);

  // Check Content-Length header for early rejection
  const contentLengthHeader = request.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const contentLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(contentLength) && contentLength > maxBodyBytes) {
      return jsonResponse({ error: 'Payload too large' }, 413);
    }
  }

  // Look up endpoint
  const endpoint = await getEndpoint(env.DB, endpointId);
  if (!endpoint) {
    return jsonResponse({ error: 'Endpoint not found or expired' }, 410);
  }

  // Check expiry
  const now = new Date();
  if (new Date(endpoint.expires_at) <= now) {
    return jsonResponse({ error: 'Endpoint not found or expired' }, 410);
  }

  // Read body with size limit
  let body = '';
  if (request.body) {
    try {
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxBodyBytes) {
          reader.cancel();
          return jsonResponse({ error: 'Payload too large' }, 413);
        }
        chunks.push(value);
      }

      const combined = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      body = new TextDecoder('utf-8', { fatal: false }).decode(combined);
    } catch {
      body = '';
    }
  }

  // Capture headers (excluding sensitive CF internal headers)
  const headersObj: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    headersObj[key] = value;
  }

  const url = new URL(request.url);
  const path = url.pathname + (url.search ? url.search : '');
  const contentType = request.headers.get('content-type') ?? '';
  const sourceIp = request.headers.get('cf-connecting-ip') ?? '';

  const requestId = nanoid(32);
  const receivedAt = now.toISOString();

  // Enforce max requests per endpoint (FIFO eviction)
  const currentCount = await countRequestsForEndpoint(env.DB, endpointId);
  if (currentCount >= maxRequests) {
    const oldestId = await getOldestRequestId(env.DB, endpointId);
    if (oldestId) {
      await deleteRequest(env.DB, oldestId);
    }
  }

  await insertRequest(env.DB, {
    id: requestId,
    endpoint_id: endpointId,
    received_at: receivedAt,
    method: request.method,
    path,
    headers: JSON.stringify(headersObj),
    body,
    content_type: contentType,
    source_ip: sourceIp,
  });

  await incrementRequestCount(env.DB, endpointId);

  return jsonResponse({ status: 'ok', request_id: requestId });
}
