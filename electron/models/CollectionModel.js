import { db } from '../db/connection.js';

export function listCollection() {
  return db().prepare(`
    SELECT
      c.id            AS collection_id,
      c.card_id       AS card_id,
      c.quantity      AS quantity,
      c.acquired_at   AS acquired_at,
      cards.name      AS name,
      cards.edition   AS edition,
      cards.rarity    AS rarity,
      cards.price_eur AS price_eur
    FROM collection c
    JOIN cards ON cards.id = c.card_id
    ORDER BY c.acquired_at DESC
  `).all();
}

export function addToCollection(cardId, qty = 1) {
  const q = Number(qty) || 1;
  const stmt = db().prepare(`
    INSERT INTO collection (card_id, quantity) VALUES (?, ?)
    ON CONFLICT(card_id) DO UPDATE SET quantity = quantity + excluded.quantity
  `);
  const info = stmt.run(cardId, q);
  return { ok: info.changes >= 1 };
}

export function updateQuantity(cardId, qty) {
  const q = Math.max(0, Number(qty) || 0);
  if (q === 0) {
    const del = db().prepare(`DELETE FROM collection WHERE card_id = ?`).run(cardId);
    return { ok: del.changes === 1, removed: true };
  } else {
    const upd = db().prepare(`UPDATE collection SET quantity = ? WHERE card_id = ?`).run(q, cardId);
    return { ok: upd.changes === 1, removed: false };
  }
}

export function removeFromCollection(cardId) {
  const del = db().prepare(`DELETE FROM collection WHERE card_id = ?`).run(cardId);
  return { ok: del.changes === 1 };
}

export function upsertExactQuantity(cardId, qty) {
  const q = Math.max(0, Number(qty) || 0);
  if (q === 0) {
    const del = db().prepare(`DELETE FROM collection WHERE card_id = ?`).run(cardId);
    return { ok: true, removed: del.changes >= 1 };
  }
  const stmt = db().prepare(`
    INSERT INTO collection (card_id, quantity)
    VALUES (?, ?)
    ON CONFLICT(card_id) DO UPDATE SET quantity = excluded.quantity
  `);
  const info = stmt.run(cardId, q);
  // changes puede ser 1 (insert) o 1 (update). En better-sqlite3 update a mismo valor puede dar 0.
  return { ok: info.changes >= 0, removed: false };
}