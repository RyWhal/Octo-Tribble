import {
  listEndpoints,
  getEndpoint,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  listRequestsForEndpoint,
  deleteRequest,
  deleteRequestsForEndpoint,
  countActiveEndpoints,
} from './db';

export interface Env {
  DB: D1Database;
  MAX_ENDPOINTS?: string;
}

function nanoid8(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const array = new Uint8Array(8);
  crypto.getRandomValues(array);
  for (const byte of array) {
    result += chars[byte % chars.length];
  }
  return result;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function notFound(): Response {
  return json({ error: 'Not found' }, 404);
}

function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

const EXPIRY_DURATIONS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '48h': 48 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

export async function handleApi(request: Request, env: Env, pathname: string): Promise<Response> {
  const maxEndpoints = parseInt(env.MAX_ENDPOINTS ?? '20', 10);
  const method = request.method.toUpperCase();

  // OPTIONS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // POST /api/endpoints — create endpoint
  if (method === 'POST' && pathname === '/api/endpoints') {
    const activeCount = await countActiveEndpoints(env.DB);
    if (activeCount >= maxEndpoints) {
      return badRequest(`Maximum of ${maxEndpoints} active endpoints reached`);
    }

    let body: { name?: string; expiry?: string } = {};
    try {
      const text = await request.text();
      if (text) body = JSON.parse(text);
    } catch {
      return badRequest('Invalid JSON body');
    }

    const expiryDuration = EXPIRY_DURATIONS[body.expiry ?? '48h'] ?? EXPIRY_DURATIONS['48h'];
    const expiresAt = new Date(Date.now() + expiryDuration).toISOString();
    const id = nanoid8();
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;

    await createEndpoint(env.DB, id, name, expiresAt);
    const endpoint = await getEndpoint(env.DB, id);
    return json(endpoint, 201);
  }

  // GET /api/endpoints — list all endpoints
  if (method === 'GET' && pathname === '/api/endpoints') {
    const endpoints = await listEndpoints(env.DB);
    return json(endpoints);
  }

  // PATCH /api/endpoints/:id — update endpoint
  const patchEndpointMatch = pathname.match(/^\/api\/endpoints\/([^/]+)$/);
  if (method === 'PATCH' && patchEndpointMatch) {
    const endpointId = patchEndpointMatch[1];
    const endpoint = await getEndpoint(env.DB, endpointId);
    if (!endpoint) return notFound();

    let body: { name?: string | null; expiry?: string; expires_at?: string } = {};
    try {
      const text = await request.text();
      if (text) body = JSON.parse(text);
    } catch {
      return badRequest('Invalid JSON body');
    }

    const fields: { name?: string | null; expires_at?: string } = {};
    if ('name' in body) {
      fields.name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
    }
    if (body.expiry && EXPIRY_DURATIONS[body.expiry]) {
      fields.expires_at = new Date(Date.now() + EXPIRY_DURATIONS[body.expiry]).toISOString();
    } else if (body.expires_at) {
      fields.expires_at = body.expires_at;
    }

    await updateEndpoint(env.DB, endpointId, fields);
    const updated = await getEndpoint(env.DB, endpointId);
    return json(updated);
  }

  // DELETE /api/endpoints/:id — delete endpoint
  const deleteEndpointMatch = pathname.match(/^\/api\/endpoints\/([^/]+)$/);
  if (method === 'DELETE' && deleteEndpointMatch) {
    const endpointId = deleteEndpointMatch[1];
    const endpoint = await getEndpoint(env.DB, endpointId);
    if (!endpoint) return notFound();

    await deleteEndpoint(env.DB, endpointId);
    return json({ ok: true });
  }

  // GET /api/endpoints/:id/requests — list requests for endpoint
  const listRequestsMatch = pathname.match(/^\/api\/endpoints\/([^/]+)\/requests$/);
  if (method === 'GET' && listRequestsMatch) {
    const endpointId = listRequestsMatch[1];
    const endpoint = await getEndpoint(env.DB, endpointId);
    if (!endpoint) return notFound();

    const requests = await listRequestsForEndpoint(env.DB, endpointId);
    return json(requests);
  }

  // DELETE /api/endpoints/:id/requests — clear all requests for endpoint
  if (method === 'DELETE' && listRequestsMatch) {
    const endpointId = listRequestsMatch[1];
    const endpoint = await getEndpoint(env.DB, endpointId);
    if (!endpoint) return notFound();

    await deleteRequestsForEndpoint(env.DB, endpointId);
    return json({ ok: true });
  }

  // DELETE /api/requests/:id — delete a single request
  const deleteRequestMatch = pathname.match(/^\/api\/requests\/([^/]+)$/);
  if (method === 'DELETE' && deleteRequestMatch) {
    const requestId = deleteRequestMatch[1];
    await deleteRequest(env.DB, requestId);
    return json({ ok: true });
  }

  return notFound();
}
