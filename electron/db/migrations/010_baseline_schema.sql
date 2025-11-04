-- 010_baseline_schema.sql
-- Baseline: Esquema canónico de MTGNode (collection, scry_cards, cards)
-- NOTA: Esta baseline recrea tablas. Haz copia/CSV si necesitas conservar datos.

PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;

-- Crea la tabla de sets de Scryfall si no existe
CREATE TABLE IF NOT EXISTS scry_sets (
  code            TEXT PRIMARY KEY,        -- p.ej. "lea"
  name            TEXT NOT NULL,           -- p.ej. "Limited Edition Alpha"
  released_at     TEXT,                    -- "1993-08-05"
  card_count      INTEGER DEFAULT 0,
  set_type        TEXT,                    -- "core", "expansion", etc.
  parent_set_code TEXT,                    -- para sets con variantes
  digital         INTEGER DEFAULT 0,       -- 0/1
  foil_only       INTEGER DEFAULT 0,       -- 0/1
  nonfoil_only    INTEGER DEFAULT 0        -- 0/1
);

CREATE INDEX IF NOT EXISTS idx_scry_sets_release ON scry_sets(released_at);
CREATE INDEX IF NOT EXISTS idx_scry_sets_name_ci ON scry_sets(LOWER(name));

-- ========== SCRYFALL CARDS (referencial / solo-lectura para la app) ==========
CREATE TABLE IF NOT EXISTS scry_cards (
  id                TEXT PRIMARY KEY,             -- UUID scryfall
  name              TEXT NOT NULL,
  set_name          TEXT NOT NULL,
  set_code          TEXT,                         -- opcional si lo usas
  collector_number  TEXT,
  rarity            TEXT,
  eur               REAL DEFAULT 0,               -- precio 'eur' unitario
  usd               REAL DEFAULT 0,               -- precio 'usd' unitario
  image_uri         TEXT,
  image_small       TEXT,
  image_normal      TEXT,
  image_large       TEXT,
  image_png         TEXT,
  image_art         TEXT, 
  image_art_crop    TEXT,
  type_line         TEXT,
  usd_foil          REAL DEFAULT 0,               -- precio 'usd' foil unitario
  eur_foil          REAL DEFAULT 0,               -- precio 'eur' foil unitario
  lang              TEXT,
  released_at       TEXT,
  oracle_id         TEXT,
  oracle_text       TEXT,
  mtgo_id           INTEGER,
  tcgplayer_id      INTEGER,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scry_name_set ON scry_cards(LOWER(name), LOWER(set_name));
CREATE INDEX IF NOT EXISTS idx_scry_set_code  ON scry_cards(set_code);
CREATE INDEX IF NOT EXISTS idx_scry_eur       ON scry_cards(eur);

-- =================== COLLECTION (tu “Mi Colección”) ==========================
-- Si existe y no te importa resetear, la eliminamos para garantizar el esquema
DROP TABLE IF EXISTS collection;

CREATE TABLE collection (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id           TEXT UNIQUE,                  -- id interno si lo usas
  scry_id           TEXT,                         -- FK a scry_cards.id (no forzamos FK por simplicidad)
  name              TEXT,                         -- redundante para búsquedas rápidas
  set_name          TEXT,                         -- redundante para búsquedas rápidas
  rarity            TEXT,                         -- redundante para UI
  collector_number  TEXT,                         -- útil para identificar impresión exacta
  qty               INTEGER NOT NULL DEFAULT 1,   -- cantidad
  paid_eur          REAL    NOT NULL DEFAULT 0,   -- precio pagado unitario
  last_eur          REAL    NOT NULL DEFAULT 0,   -- último precio conocido (snapshot)
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_collection_scry   ON collection(scry_id);
CREATE INDEX IF NOT EXISTS idx_collection_name   ON collection(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_collection_set    ON collection(LOWER(set_name));

-- ======================= CARDS (si la usas aún) ==============================
-- Tabla “modelo” antigua (opcional). Si la app la usa, garantizamos lo mínimo.
CREATE TABLE IF NOT EXISTS cards (
  id        TEXT PRIMARY KEY,
  name      TEXT,
  set_name  TEXT,
  rarity    TEXT
);
CREATE INDEX IF NOT EXISTS idx_cards_name_set ON cards(LOWER(name), LOWER(set_name));

COMMIT;
PRAGMA foreign_keys = ON;
