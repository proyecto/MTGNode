// electron/db/migrator.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureMigrationsTable(conn) {
  conn.prepare(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
}
function isApplied(conn, name) {
  return !!conn.prepare(`SELECT 1 FROM schema_migrations WHERE name=? LIMIT 1`).get(name);
}
function markApplied(conn, name) {
  conn.prepare(`INSERT INTO schema_migrations (name) VALUES (?)`).run(name);
}

export async function runMigrations() {
  const conn = db();
  ensureMigrationsTable(conn);

  const migrationsDir = path.join(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.toLowerCase().endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (isApplied(conn, file)) continue;
    const abs = path.join(migrationsDir, file);
    const sql = fs.readFileSync(abs, 'utf8');

    try {
      conn.exec(sql);
      markApplied(conn, file);
    } catch (e) {
      console.error('[MIGRATOR] failed:', file, e);
      throw e;
    }
  }
}
