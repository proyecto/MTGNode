// electron/db/connection.js (ESM)
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let _db;

export function getDbPath() {
  const base = path.join(os.homedir(), 'Library', 'Application Support', 'mtg-minimal', 'mtgnode');
  fs.mkdirSync(base, { recursive: true });
  return path.join(base, 'mtg.sqlite');
}

export function db() {
  if (_db) return _db;
  const DB_PATH = process.env.MTG_DB_PATH || getDbPath();
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  return _db;
}
