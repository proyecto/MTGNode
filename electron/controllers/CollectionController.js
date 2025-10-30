import * as Collection from "../models/CollectionModel.js";
import * as Card from "../models/CardModel.js";
import { db } from "../db/connection.js";

function ensureSchema(conn) {
  // Crea la tabla si no existe (ajusta tipos/claves si usas otro diseño)
  conn
    .prepare(
      `
    CREATE TABLE IF NOT EXISTS collection (
      card_id TEXT PRIMARY KEY,
      qty INTEGER NOT NULL DEFAULT 1,
      paid_eur REAL
    )
  `
    )
    .run();

  const cols = conn.prepare(`PRAGMA table_info(collection)`).all();
  const hasQty = cols.some((c) => c.name === "qty");
  const hasPaid = cols.some((c) => c.name === "paid_eur");

  if (!hasQty) {
    conn
      .prepare(
        `ALTER TABLE collection ADD COLUMN qty INTEGER NOT NULL DEFAULT 1`
      )
      .run();
    // Opcional: si tenías otra columna con cantidades, aquí podrías migrar datos.
    // conn.prepare(`UPDATE collection SET qty = cantidad_anterior`).run(); // si existiera
  }
  if (!hasPaid) {
    conn.prepare(`ALTER TABLE collection ADD COLUMN paid_eur REAL`).run();
  }
}

export const CollectionController = {
  async list() {
    try {
      return Collection.listCollection();
    } catch (e) {
      return [];
    }
  },
  async add(cardId, qty = 1) {
    try {
      return Collection.addToCollection(cardId, qty);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },
  async updateQty(cardId, qty) {
    try {
      return Collection.updateQuantity(cardId, qty);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },
  async remove(cardId) {
    try {
      return Collection.removeFromCollection(cardId);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async addFromScry(payload, qty = 1) {
    try {
      const ensured = Card.ensureFromScry(payload);
      if (!ensured.ok) return ensured;
      return Collection.addToCollection(ensured.id, qty);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async upsertExact(cardId, qty) {
    try {
      return Collection.upsertExactQuantity(cardId, qty);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },
  stats() {
    const conn = db();
    ensureSchema(conn);
    const row = conn
      .prepare(
        `
      SELECT 
        COALESCE(SUM(COALESCE(c.qty,1)), 0) AS totalCards,
        COALESCE(SUM(COALESCE(c.paid_eur, 0) * COALESCE(c.qty,1)), 0) AS invested,
        COALESCE(SUM(COALESCE(s.eur, 0) * COALESCE(c.qty,1)), 0) AS current
      FROM collection c
      LEFT JOIN scry_cards s ON s.id = c.card_id
    `
      )
      .get();
    return { ok: true, data: row };
  },
  listDetailed() {
    const conn = db();
    ensureSchema(conn);
    const items = conn
      .prepare(
        `
      SELECT 
        c.card_id,
        COALESCE(c.qty,1)        AS qty,
        c.paid_eur,
        s.name,
        s.set_name,
        s.collector_number,
        s.rarity,
        s.eur,
        s.eur_foil,
        s.image_normal
      FROM collection c
      LEFT JOIN scry_cards s ON s.id = c.card_id
      ORDER BY s.name ASC
    `
      )
      .all();
    return { ok: true, items };
  },

  updatePaid(cardId, paid_eur) {
    const conn = db();
    ensureSchema(conn);
    if (!cardId) return { ok: false, error: "cardId requerido" };
    if (paid_eur == null || Number.isNaN(Number(paid_eur))) {
      conn
        .prepare(`UPDATE collection SET paid_eur = NULL WHERE card_id = ?`)
        .run(cardId);
    } else {
      conn
        .prepare(`UPDATE collection SET paid_eur = ? WHERE card_id = ?`)
        .run(Number(paid_eur), cardId);
    }
    return { ok: true };
  },
};
