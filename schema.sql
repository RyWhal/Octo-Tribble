-- D1 Schema for hooks.rjpw.space Webhook Inspector

CREATE TABLE IF NOT EXISTS endpoints (
  id           TEXT PRIMARY KEY,
  name         TEXT,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS requests (
  id           TEXT PRIMARY KEY,
  endpoint_id  TEXT NOT NULL,
  received_at  TEXT NOT NULL,
  method       TEXT NOT NULL,
  path         TEXT NOT NULL,
  headers      TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT '',
  source_ip    TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (endpoint_id) REFERENCES endpoints(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_requests_endpoint ON requests(endpoint_id, received_at DESC);
