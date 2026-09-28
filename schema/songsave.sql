CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  year TEXT,
  audio_url TEXT,
  video_url TEXT,
  credits TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
CREATE INDEX IF NOT EXISTS idx_songs_year ON songs(year);
