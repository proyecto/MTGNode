// ESM – se ejecuta en proceso principal
import { app } from 'electron';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(app.getPath('userData'), 'mtgnode');
const DB_PATH = path.join(DATA_DIR, 'mtg.sqlite');
const MIGRATIONS_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'migrations');

export function getDbPath() {
  return DB_PATH;
}

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function openDb() {
  ensureDirs();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = DELETE'); // visible al instante en el .sqlite
  return db;
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare(`SELECT name FROM schema_migrations`).all().map(r => r.name)
  );

  if (!fs.existsSync(MIGRATIONS_DIR)) return;

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const insertMig = db.prepare(`INSERT INTO schema_migrations (name) VALUES (?)`);

  const tx = db.transaction(() => {
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      db.exec(sql);
      insertMig.run(file);
      // console.log('[MIGRATION] applied', file);
    }
  });
  tx();
}

let _db;
export function db() {
  if (_db) return _db;
  _db = openDb();
  runMigrations(_db);
  return _db;
}
