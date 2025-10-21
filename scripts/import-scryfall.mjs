// scripts/import-scryfall.mjs
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import Database from 'better-sqlite3';
import fetch from 'node-fetch';

// CommonJS -> ESM interop (stream-json es CJS)
import StreamJson from 'stream-json';
import StreamArrayMod from 'stream-json/streamers/StreamArray.js';
const { parser } = StreamJson;
const { streamArray } = StreamArrayMod;

const DB_PATH = process.env.MTG_DB_PATH
  ? process.env.MTG_DB_PATH
  : path.join(process.cwd(), 'data', 'mtg.sqlite');

console.log('[import] DB_PATH:', DB_PATH);
const db = new Database(DB_PATH);
db.pragma('journal_mode = DELETE');

function ensureSchema() {
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_scry_cards_set  ON scry_cards(set_code);
  `);
}

async function getBulkUrl(type = 'default_cards') {
  const res = await fetch('https://api.scryfall.com/bulk-data');
  if (!res.ok) throw new Error('bulk-data fetch failed: ' + res.status);
  const json = await res.json();
  const item = json.data.find(x => x.type === type);
  if (!item) throw new Error('Bulk type not found: ' + type);
  return item.download_uri; // .json o .json.gz (transfer-encoding puede venir br/gzip)
}

function prepStatements() {
  const upsertSet = db.prepare(`
    INSERT INTO scry_sets(code, name, released_at) VALUES(?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET name=excluded.name, released_at=excluded.released_at
  `);

  // 17 columnas -> 17 placeholders
  const upsertCard = db.prepare(`
    INSERT INTO scry_cards
      (id, oracle_id, name, set_code, set_name, collector_number, released_at, rarity, lang,
       usd, usd_foil, eur, eur_foil, image_small, image_normal, type_line, oracle_text)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      oracle_id=excluded.oracle_id,
      name=excluded.name,
      set_code=excluded.set_code,
      set_name=excluded.set_name,
      collector_number=excluded.collector_number,
      released_at=excluded.released_at,
      rarity=excluded.rarity,
      lang=excluded.lang,
      usd=excluded.usd, usd_foil=excluded.usd_foil,
      eur=excluded.eur, eur_foil=excluded.eur_foil,
      image_small=excluded.image_small, image_normal=excluded.image_normal,
      type_line=excluded.type_line, oracle_text=excluded.oracle_text
  `);

  return { upsertSet, upsertCard };
}

function toNodeReadable(body) {
  // Si es WebStream (tiene getReader), conviértelo; si ya es Readable de Node, úsalo tal cual
  if (body && typeof body.getReader === 'function') {
    return Readable.fromWeb(body);
  }
  return body; // Node Readable
}

async function importDefaultCards() {
  ensureSchema();

  const url = await getBulkUrl('default_cards');
  console.log('[scryfall] bulk url:', url);

  const res = await fetch(url, { compress: false });
  if (!res.ok) throw new Error('download failed: ' + res.status);

  let source = toNodeReadable(res.body);

  // Descompresión según cabecera (br / gzip). La URL ya no indica compresión.
  const enc = (res.headers.get('content-encoding') || '').toLowerCase();
  if (enc.includes('br')) {
    source = source.pipe(zlib.createBrotliDecompress());
  } else if (enc.includes('gzip')) {
    source = source.pipe(zlib.createGunzip());
  }

  const { upsertSet, upsertCard } = prepStatements();
  const tx = db.transaction((rows) => {
    for (const c of rows) {
      if (c.set && c.set_name) {
        upsertSet.run(c.set, c.set_name, c.released_at || null);
      }
      const prices = c.prices || {};
      const imgs = c.image_uris || {};
      upsertCard.run(
        c.id, c.oracle_id || null, c.name, c.set || null, c.set_name || null, c.collector_number || null,
        c.released_at || null, c.rarity || null, c.lang || null,
        prices.usd ?? null, prices.usd_foil ?? null, prices.eur ?? null, prices.eur_foil ?? null,
        imgs.small ?? null, imgs.normal ?? null,
        c.type_line ?? null, c.oracle_text ?? null
      );
    }
  });

  const BATCH = 500;
  let buffer = [];

  await pipeline(
    source,
    parser(),
    streamArray(),
    async function * (stream) {
      for await (const { value } of stream) {
        buffer.push(value);
        if (buffer.length >= BATCH) {
          tx(buffer);
          buffer = [];
        }
      }
      if (buffer.length) tx(buffer);
    }
  );

  console.log('[scryfall] import done ✅');
}

importDefaultCards().catch(err => {
  console.error(err);
  process.exit(1);
});
