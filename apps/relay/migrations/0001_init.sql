CREATE TABLE IF NOT EXISTS circles (
  id TEXT PRIMARY KEY,
  bearer_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS envelopes (
  cursor INTEGER PRIMARY KEY AUTOINCREMENT,
  circle TEXT NOT NULL,
  envelope TEXT NOT NULL,
  received_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS envelopes_by_circle ON envelopes (circle, cursor);
