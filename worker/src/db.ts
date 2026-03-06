export interface Endpoint {
  id: string;
  name: string | null;
  created_at: string;
  expires_at: string;
  request_count: number;
}

export interface Request {
  id: string;
  endpoint_id: string;
  received_at: string;
  method: string;
  path: string;
  headers: string; // JSON string
  body: string;
  content_type: string;
  source_ip: string;
}

export async function getEndpoint(db: D1Database, id: string): Promise<Endpoint | null> {
  const result = await db
    .prepare('SELECT * FROM endpoints WHERE id = ?')
    .bind(id)
    .first<Endpoint>();
  return result ?? null;
}

export async function listEndpoints(db: D1Database): Promise<Endpoint[]> {
  const result = await db
    .prepare('SELECT * FROM endpoints ORDER BY created_at DESC')
    .all<Endpoint>();
  return result.results;
}

export async function countActiveEndpoints(db: D1Database): Promise<number> {
  const now = new Date().toISOString();
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM endpoints WHERE expires_at > ?')
    .bind(now)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

export async function createEndpoint(
  db: D1Database,
  id: string,
  name: string | null,
  expiresAt: string
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare('INSERT INTO endpoints (id, name, created_at, expires_at, request_count) VALUES (?, ?, ?, ?, 0)')
    .bind(id, name, now, expiresAt)
    .run();
}

export async function updateEndpoint(
  db: D1Database,
  id: string,
  fields: { name?: string | null; expires_at?: string }
): Promise<void> {
  const setClauses: string[] = [];
  const bindings: unknown[] = [];

  if ('name' in fields) {
    setClauses.push('name = ?');
    bindings.push(fields.name ?? null);
  }
  if (fields.expires_at !== undefined) {
    setClauses.push('expires_at = ?');
    bindings.push(fields.expires_at);
  }

  if (setClauses.length === 0) return;

  bindings.push(id);
  await db
    .prepare(`UPDATE endpoints SET ${setClauses.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run();
}

export async function deleteEndpoint(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM endpoints WHERE id = ?').bind(id).run();
}

export async function purgeExpiredEndpoints(db: D1Database): Promise<{ endpoints: number; requests: number }> {
  const now = new Date().toISOString();

  // Count expired endpoints
  const epResult = await db
    .prepare('SELECT COUNT(*) as count FROM endpoints WHERE expires_at < ?')
    .bind(now)
    .first<{ count: number }>();
  const endpoints = epResult?.count ?? 0;

  // Count requests belonging to expired endpoints
  const rqResult = await db
    .prepare('SELECT COUNT(*) as count FROM requests WHERE endpoint_id IN (SELECT id FROM endpoints WHERE expires_at < ?)')
    .bind(now)
    .first<{ count: number }>();
  const requests = rqResult?.count ?? 0;

  // Delete requests first (no ON DELETE CASCADE guarantee in all D1 versions)
  await db
    .prepare('DELETE FROM requests WHERE endpoint_id IN (SELECT id FROM endpoints WHERE expires_at < ?)')
    .bind(now)
    .run();

  // Delete expired endpoints
  await db.prepare('DELETE FROM endpoints WHERE expires_at < ?').bind(now).run();

  return { endpoints, requests };
}

export async function insertRequest(db: D1Database, req: Omit<Request, 'endpoint_id'> & { endpoint_id: string }): Promise<void> {
  await db
    .prepare(
      'INSERT INTO requests (id, endpoint_id, received_at, method, path, headers, body, content_type, source_ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      req.id,
      req.endpoint_id,
      req.received_at,
      req.method,
      req.path,
      req.headers,
      req.body,
      req.content_type,
      req.source_ip
    )
    .run();
}

export async function incrementRequestCount(db: D1Database, endpointId: string): Promise<void> {
  await db
    .prepare('UPDATE endpoints SET request_count = request_count + 1 WHERE id = ?')
    .bind(endpointId)
    .run();
}

export async function countRequestsForEndpoint(db: D1Database, endpointId: string): Promise<number> {
  const result = await db
    .prepare('SELECT COUNT(*) as count FROM requests WHERE endpoint_id = ?')
    .bind(endpointId)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

export async function getOldestRequestId(db: D1Database, endpointId: string): Promise<string | null> {
  const result = await db
    .prepare('SELECT id FROM requests WHERE endpoint_id = ? ORDER BY received_at ASC LIMIT 1')
    .bind(endpointId)
    .first<{ id: string }>();
  return result?.id ?? null;
}

export async function deleteRequest(db: D1Database, requestId: string): Promise<void> {
  await db.prepare('DELETE FROM requests WHERE id = ?').bind(requestId).run();
}

export async function deleteRequestsForEndpoint(db: D1Database, endpointId: string): Promise<void> {
  await db.prepare('DELETE FROM requests WHERE endpoint_id = ?').bind(endpointId).run();
  await db.prepare('UPDATE endpoints SET request_count = 0 WHERE id = ?').bind(endpointId).run();
}

export async function listRequestsForEndpoint(db: D1Database, endpointId: string): Promise<Request[]> {
  const result = await db
    .prepare('SELECT * FROM requests WHERE endpoint_id = ? ORDER BY received_at DESC')
    .bind(endpointId)
    .all<Request>();
  return result.results;
}

export async function getRequest(db: D1Database, requestId: string): Promise<Request | null> {
  const result = await db
    .prepare('SELECT * FROM requests WHERE id = ?')
    .bind(requestId)
    .first<Request>();
  return result ?? null;
}
