-- Tabla de colección del usuario
CREATE TABLE IF NOT EXISTS collection (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 1,
  acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE
);

-- Unique para permitir UPSERT por card_id
CREATE UNIQUE INDEX IF NOT EXISTS ux_collection_card ON collection(card_id);
