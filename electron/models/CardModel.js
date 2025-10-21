// electron/models/CardModel.js
import { db, getDbPath } from '../db/connection.js';

export function countCards() {
  const row = db().prepare('SELECT COUNT(*) AS n FROM cards').get();
  return row?.n ?? 0;
}

export function listCards() {
  return db().prepare(`
    SELECT id, name, edition, rarity, price_eur, followed
    FROM cards
    ORDER BY name ASC
  `).all();
}

export function addCard({ name, edition = '', rarity = '', price_eur = 0, followed = false }) {
  if (!name || !String(name).trim()) {
    return { ok: false, error: 'El nombre es obligatorio' };
  }
  const info = db().prepare(`
    INSERT INTO cards (name, edition, rarity, price_eur, followed)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    String(name).trim(),
    String(edition || '').trim(),
    String(rarity || '').trim(),
    Number(price_eur) || 0,
    followed ? 1 : 0
  );
  return { ok: info.changes === 1, id: info.lastInsertRowid };
}

export function toggleFollow(cardId) {
  const row = db().prepare(`SELECT followed FROM cards WHERE id = ?`).get(cardId);
  if (!row) return { ok: false, error: 'Carta no encontrada' };
  const newVal = row.followed ? 0 : 1;
  const info = db().prepare(`UPDATE cards SET followed = ? WHERE id = ?`).run(newVal, cardId);
  return { ok: info.changes === 1, followed: !!newVal };
}

export function setFollow(cardId, val) {
  const info = db().prepare(`UPDATE cards SET followed = ? WHERE id = ?`).run(val ? 1 : 0, cardId);
  return { ok: info.changes === 1, followed: !!val };
}

// 👇 NUEVO: busca o crea en 'cards' a partir de datos de Scryfall
export function ensureFromScry({ name, set_name, rarity, eur }) {
  if (!name) return { ok: false, error: 'name requerido' };
  const edition = set_name || ''; // usamos set_name como "edición" visible

  const found = db().prepare(`
    SELECT id FROM cards WHERE name = ? AND edition = ? LIMIT 1
  `).get(String(name).trim(), String(edition).trim());

  if (found?.id) return { ok: true, id: found.id, created: false };

  const price = Number(eur) || 0;
  const ins = db().prepare(`
    INSERT INTO cards (name, edition, rarity, price_eur, followed)
    VALUES (?, ?, ?, ?, 0)
  `).run(String(name).trim(), String(edition).trim(), String(rarity || '').trim(), price);

  return { ok: true, id: ins.lastInsertRowid, created: true };
}

export function seedDemo() {
  const n = countCards();
  if (n > 0) return { ok: true, message: 'Ya existe contenido' };

  const insert = db().prepare(`
    INSERT INTO cards (name, edition, rarity, price_eur, followed)
    VALUES (@name, @edition, @rarity, @price_eur, @followed)
  `);

  const demo = [
    { name: 'Black Lotus',    edition: 'Alpha', rarity: 'Rare',     price_eur: 200000, followed: 1 },
    { name: 'Lightning Bolt', edition: 'Alpha', rarity: 'Common',   price_eur: 2.5,    followed: 1 },
    { name: 'Counterspell',   edition: 'Alpha', rarity: 'Uncommon', price_eur: 5.0,    followed: 0 }
  ];

  const tx = db().transaction(rows => rows.forEach(r => insert.run(r)));
  tx(demo);

  return { ok: true, inserted: demo.length };
}

export function debugInfo() {
  return { ok: true, cards: countCards(), dbPath: getDbPath() };
}
