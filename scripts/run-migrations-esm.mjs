// scripts/run-migrations-esm.mjs
import { runMigrations } from '../electron/db/migrator.js';
await runMigrations();