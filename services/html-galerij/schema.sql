CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  filename TEXT NOT NULL,
  html_content TEXT NOT NULL,
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

-- Login attempts are counted per hashed client and globally in fixed 15-minute windows.
CREATE TABLE IF NOT EXISTS gallery_login_attempts (
  bucket TEXT NOT NULL,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window)
);
CREATE TABLE IF NOT EXISTS gallery_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gallery_sessions_expiry ON gallery_sessions(expires_at);

-- Auditable administration. Never include passwords, cookie tokens, IPs, or uploaded HTML.
CREATE TABLE IF NOT EXISTS site_admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_site_admin_audit_created ON site_admin_audit(created_at DESC);

CREATE TABLE IF NOT EXISTS ict_editor_grants (
  grant_hash TEXT PRIMARY KEY,
  session_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  redeemed INTEGER NOT NULL DEFAULT 0
);
