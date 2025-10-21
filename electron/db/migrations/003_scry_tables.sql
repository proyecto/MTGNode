CREATE TABLE IF NOT EXISTS scry_sets (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  released_at TEXT
);

CREATE TABLE IF NOT EXISTS scry_cards (
  id TEXT PRIMARY KEY,
  oracle_id TEXT,
  name TEXT NOT NULL,
  set_code TEXT,
  set_name TEXT,
  collector_number TEXT,
  released_at TEXT,
  rarity TEXT,
  lang TEXT,
  usd REAL, usd_foil REAL, eur REAL, eur_foil REAL,
  image_small TEXT,
  image_normal TEXT,
  type_line TEXT,
  oracle_text TEXT
);

CREATE INDEX IF NOT EXISTS idx_scry_cards_name ON scry_cards(name);
CREATE INDEX IF NOT EXISTS idx_scry_cards_set ON scry_cards(set_code);
