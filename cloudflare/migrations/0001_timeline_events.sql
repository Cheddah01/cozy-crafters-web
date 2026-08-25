CREATE TABLE IF NOT EXISTS timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  description TEXT,
  r2_key TEXT UNIQUE,
  mime_type TEXT,
  file_size INTEGER,
  created_by_discord_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(title) BETWEEN 1 AND 80),
  CHECK (length(event_date) = 10),
  CHECK (event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CHECK (description IS NULL OR length(description) <= 280),
  CHECK (
    (r2_key IS NULL AND mime_type IS NULL AND file_size IS NULL)
    OR
    (r2_key IS NOT NULL AND mime_type IS NOT NULL AND file_size > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_date
ON timeline_events (event_date, id);
