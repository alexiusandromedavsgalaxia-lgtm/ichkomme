CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  year TEXT,
  source_url TEXT NOT NULL UNIQUE,
  object_key TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size_bytes INTEGER,
  license_note TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
CREATE INDEX IF NOT EXISTS idx_songs_year ON songs(year);
