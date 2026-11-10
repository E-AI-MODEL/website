CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  filename TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'published'
);
CREATE INDEX IF NOT EXISTS idx_uploads_created ON uploads(created_at DESC);
CREATE TABLE IF NOT EXISTS upload_limits (
  visitor_hash TEXT NOT NULL,
  hour TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (visitor_hash, hour)
);
