CREATE TABLE IF NOT EXISTS community_funding_goal (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  current_cents INTEGER NOT NULL DEFAULT 0 CHECK (current_cents >= 0),
  target_cents INTEGER NOT NULL CHECK (target_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (currency IN ('USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD')),
  contribution_url TEXT NOT NULL,
  updated_by_discord_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(title) BETWEEN 1 AND 80),
  CHECK (length(description) BETWEEN 1 AND 240),
  CHECK (length(contribution_url) BETWEEN 1 AND 500)
);

INSERT OR IGNORE INTO community_funding_goal (
  id,
  enabled,
  title,
  description,
  current_cents,
  target_cents,
  currency,
  contribution_url
) VALUES (
  1,
  1,
  'Community server fund',
  'Help cover hosting, backups, and the tools that keep Cozy Crafters running.',
  0,
  10000,
  'USD',
  '/store.html'
);
