CREATE TABLE provider_views(
  provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(provider_id, day));
