#!/usr/bin/env bash
set -euo pipefail

echo "[reset] Killing Electron…"
pkill -f Electron || true

echo "[reset] Removing builds and caches…"
rm -rf dist out build release
rm -rf node_modules node_modules/.vite .parcel-cache .turbo .cache 2>/dev/null || true

echo "[reset] npm ci…"
npm ci

echo "[reset] Rebuild natives (better-sqlite3)…"
npx @electron/rebuild -f -w better-sqlite3

DB_DIR="$HOME/Library/Application Support/mtg-minimal/mtgnode"
echo "[reset] Removing DB dir: $DB_DIR"
rm -rf "$DB_DIR"

echo "[reset] Cleaning Electron caches…"
rm -rf ~/Library/Caches/electron ~/Library/Caches/electron-builder || true

echo "[reset] Running migrations…"
if npm run db:migrate >/dev/null 2>&1; then
  npm run db:migrate
else
  echo "[reset] No db:migrate script, migrations will run on app boot."
fi

echo "[reset] Done. Start dev with: npm run dev"