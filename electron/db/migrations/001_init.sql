-- Cards table + índice
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  edition TEXT,
  rarity TEXT,
  price_eur REAL DEFAULT 0,
  followed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);