// electron/controllers/CollectionController.js
import * as Collection from "../models/CollectionModel.js";
import { db } from "../db/connection.js";
import { dialog } from "electron";
import fs from "node:fs";

/* ===================== Utilidades de introspección ===================== */

function tableInfo(conn, table) {
  try {
    return conn.prepare(`PRAGMA table_info(${table})`).all();
  } catch {
    return [];
  }
}

function hasColumn(conn, table, col) {
  return tableInfo(conn, table).some((r) => r.name === col);
}

function isNotNull(conn, table, col) {
  const info = tableInfo(conn, table).find((r) => r.name === col);
  return !!(info && info.notnull === 1);
}

/* ===================== Resolver/crear card_id si existe cards ===================== */

function getOrCreateCardId(conn, payload) {
  if (!payload?.name) return null;

  const cardsCols = tableInfo(conn, "cards").map((c) => c.name);
  const hasCards = cardsCols.length > 0;
  if (!hasCards) return null;

  const canName = cardsCols.includes("name");
  const canSet = cardsCols.includes("set_name");
  const canNumber = cardsCols.includes("collector_number");
  const canRarity = cardsCols.includes("rarity");
  const canEur = cardsCols.includes("eur");

  const where = [];
  const args = [];
  if (canName) { where.push("LOWER(name)=LOWER(?)"); args.push(payload.name); }
  if (canSet && payload.set_name) { where.push("LOWER(set_name)=LOWER(?)"); args.push(payload.set_name); }
  if (canNumber && payload.collector_number) { where.push("collector_number=?"); args.push(String(payload.collector_number)); }

  let row;
  if (where.length) {
    const sqlSel = `SELECT id FROM cards WHERE ${where.join(" AND ")} LIMIT 1`;
    row = conn.prepare(sqlSel).get(args);
  }
  if (row?.id) return row.id;

  // Insert con columnas disponibles
  const cols = [], qms = [], vals = [];
  if (canName) { cols.push("name"); qms.push("?"); vals.push(payload.name); }
  if (canSet && payload.set_name) { cols.push("set_name"); qms.push("?"); vals.push(payload.set_name); }
  if (canNumber && payload.collector_number) { cols.push("collector_number"); qms.push("?"); vals.push(String(payload.collector_number)); }
  if (canRarity && payload.rarity) { cols.push("rarity"); qms.push("?"); vals.push(payload.rarity); }
  if (canEur && Number.isFinite(Number(payload.eur))) { cols.push("eur"); qms.push("?"); vals.push(Number(payload.eur)); }

  if (!cols.length) return null;

  const sqlIns = `INSERT INTO cards (${cols.join(",")}) VALUES (${qms.join(",")})`;
  const info = conn.prepare(sqlIns).run(vals);
  return info.lastInsertRowid || null;
}

/* ===================== Constantes ===================== */

const ALLOWED_CONDITIONS = new Set(["M", "NM", "EX", "GD", "LP", "PL", "PO"]);

/* ===================== Controlador ===================== */

export const CollectionController = {
  /* --------- Diagnóstico --------- */
  diag() {
    const conn = db();
    const has = (c) => hasColumn(conn, "collection", c);

    const total = conn.prepare(`SELECT COUNT(*) AS n FROM collection`).get().n;

    let withScry = 0, withoutScry = 0;
    if (has("scry_id")) {
      withScry = conn
        .prepare(`SELECT COUNT(*) AS n FROM collection WHERE scry_id IS NOT NULL AND scry_id <> ''`)
        .get().n;
      withoutScry = total - withScry;
    }

    const canName = has("name"), canSet = has("set_name");
    const joinHits = conn
      .prepare(`
        SELECT COUNT(*) AS n
        FROM collection c
        LEFT JOIN scry_cards s
          ON (${has("scry_id") ? "s.id = c.scry_id" : "0"})
          OR (${canName && canSet ? "LOWER(s.name)=LOWER(c.name) AND LOWER(s.set_name)=LOWER(c.set_name)" : "0"})
        WHERE s.id IS NOT NULL
      `)
      .get().n;

    const missingName = canName
      ? conn.prepare(`SELECT COUNT(*) AS n FROM collection WHERE name IS NULL OR TRIM(name)=''`).get().n
      : null;

    return { ok: true, total, withScry, withoutScry, joinHits, missingName };
  },

  repairMeta() {
    const conn = db();
    const has = (c) => hasColumn(conn, "collection", c);
    const canName = has("name");
    const canSet = has("set_name");
    const canRarity = has("rarity");
    const canLast = has("last_eur");
    const canScry = has("scry_id");

    let fixedByNameSet = 0;
    let fixedFromCards = 0;
    let fixedFromScryId = 0;

    // 1) Completar desde scry_id
    if (canScry && (canName || canSet || canRarity)) {
      const rows = conn.prepare(`SELECT id, scry_id FROM collection WHERE scry_id IS NOT NULL AND TRIM(scry_id) <> ''`).all();
      const sel = conn.prepare(`SELECT name, set_name, rarity, CAST(COALESCE(eur,0) AS REAL) AS eur FROM scry_cards WHERE id = ? LIMIT 1`);
      const upd = conn.prepare(`
        UPDATE collection SET
          ${canName ? "name = COALESCE(NULLIF(name, ''), @name)," : ""}
          ${canSet ? "set_name = COALESCE(NULLIF(set_name, ''), @set_name)," : ""}
          ${canRarity ? "rarity = COALESCE(NULLIF(rarity, ''), @rarity)," : ""}
          ${canLast ? "last_eur = COALESCE(last_eur, @eur)" : "last_eur = @eur"}
        WHERE id = @id
      `);

      for (const r of rows) {
        const s = sel.get(r.scry_id);
        if (!s) continue;
        upd.run({ id: r.id, name: s.name, set_name: s.set_name, rarity: s.rarity, eur: s.eur });
        fixedFromScryId++;
      }
    }

    // 2) Emparejar por name+set_name
    if (canName && canSet && canScry) {
      const rows = conn.prepare(`
        SELECT id, name, set_name
        FROM collection
        WHERE (scry_id IS NULL OR TRIM(scry_id) = '')
          AND name IS NOT NULL AND TRIM(name) <> ''
          AND set_name IS NOT NULL AND TRIM(set_name) <> ''
      `).all();

      const sel = conn.prepare(`
        SELECT id AS sid, rarity, CAST(COALESCE(eur,0) AS REAL) AS eur
        FROM scry_cards
        WHERE LOWER(name)=LOWER(?) AND LOWER(set_name)=LOWER(?)
        LIMIT 1
      `);

      const upd = conn.prepare(`
        UPDATE collection
           SET scry_id = @sid
               ${canRarity ? ", rarity = COALESCE(rarity, @rarity)" : ""}
               ${canLast ? ", last_eur = COALESCE(last_eur, @eur)" : ""}
         WHERE id = @id
      `);

      for (const r of rows) {
        const s = sel.get(r.name, r.set_name);
        if (s?.sid) {
          upd.run({ id: r.id, sid: s.sid, rarity: s.rarity, eur: s.eur });
          fixedByNameSet++;
        }
      }
    }

    // 3) Completar desde cards (si hay relación)
    if (has("card_id")) {
      const cardsCols = tableInfo(conn, "cards").map((c) => c.name);
      const canCardsName = cardsCols.includes("name");
      const canCardsRar = cardsCols.includes("rarity");

      if (canCardsName || canCardsRar) {
        const rows = conn.prepare(`
          SELECT c.id AS cid, k.name AS kname, k.rarity AS krar
          FROM collection c
          JOIN cards k ON k.id = c.card_id
          WHERE ${canName ? "(c.name IS NULL OR TRIM(c.name)='')" : "1=1"}
             OR ${canRarity ? "(c.rarity IS NULL OR TRIM(c.rarity)='')" : "1=1"}
        `).all();

        const upd = conn.prepare(`
          UPDATE collection
             SET
               ${canName ? "name = COALESCE(NULLIF(name, ''), @kname)," : ""}
               ${canRarity ? "rarity = COALESCE(NULLIF(rarity, ''), @krar)" : ""}
           WHERE id=@cid
        `);

        for (const r of rows) {
          upd.run({ cid: r.cid, kname: r.kname, krar: r.krar });
          fixedFromCards++;
        }
      }
    }

    return { ok: true, fixedByNameSet, fixedFromCards, fixedFromScryId };
  },

  /* --------- Operaciones básicas delegadas al modelo --------- */
  async list() {
    try { return Collection.listCollection(); }
    catch { return []; }
  },
  async add(cardId, qty = 1) {
    try { return Collection.addToCollection(cardId, qty); }
    catch (e) { return { ok: false, error: e.message }; }
  },
  async updateQty(cardId, qty) {
    try { return Collection.updateQuantity(cardId, qty); }
    catch (e) { return { ok: false, error: e.message }; }
  },

  /* --------- Eliminar --------- */
  remove(cardId) {
    const conn = db();
    const stmt = conn.prepare(`
      DELETE FROM collection
      WHERE id = ? OR card_id = ? OR scry_id = ?
    `);
    const info = stmt.run(cardId, cardId, cardId);
    return { ok: true, changes: info.changes };
  },

  /* --------- Añadir desde scry (set, etc.) --------- */
  addFromScry(payload, qty = 1) {
    const conn = db();
    const needsCardId =
      hasColumn(conn, "collection", "card_id") &&
      isNotNull(conn, "collection", "card_id");

    let cardId = null;
    if (hasColumn(conn, "collection", "card_id")) {
      cardId = getOrCreateCardId(conn, payload);
      if (needsCardId && !cardId) {
        throw new Error("No se pudo resolver card_id (cards inexistente o sin columnas mínimas)");
      }
    }

    const cols = [], qms = [], vals = [];
    const QTY = Number(qty) || 1;

    if (hasColumn(conn, "collection", "qty")) { cols.push("qty"); qms.push("?"); vals.push(QTY); }
    if (hasColumn(conn, "collection", "card_id")) { cols.push("card_id"); qms.push("?"); vals.push(cardId || null); }
    if (hasColumn(conn, "collection", "scry_id") && payload?.id) { cols.push("scry_id"); qms.push("?"); vals.push(payload.id); }
    if (hasColumn(conn, "collection", "name") && payload?.name) { cols.push("name"); qms.push("?"); vals.push(payload.name); }
    if (hasColumn(conn, "collection", "set_name") && payload?.set_name) { cols.push("set_name"); qms.push("?"); vals.push(payload.set_name); }
    if (hasColumn(conn, "collection", "rarity") && payload?.rarity) { cols.push("rarity"); qms.push("?"); vals.push(payload.rarity); }
    if (hasColumn(conn, "collection", "last_eur")) {
      const eur = Number(payload?.eur);
      cols.push("last_eur"); qms.push("?"); vals.push(Number.isFinite(eur) ? eur : null);
    }

    if (!cols.length) {
      const info = conn.prepare(`INSERT INTO collection DEFAULT VALUES`).run();
      return { ok: info.changes > 0, id: info.lastInsertRowid, merged: false };
    }

    const sqlInsert = `INSERT INTO collection (${cols.join(",")}) VALUES (${qms.join(",")})`;

    try {
      const info = conn.prepare(sqlInsert).run(vals);
      return { ok: info.changes > 0, id: info.lastInsertRowid, merged: false };
    } catch (err) {
      // UNIQUE(card_id) → sumamos qty (upsert manual)
      if (
        String(err?.code) === "SQLITE_CONSTRAINT_UNIQUE" &&
        hasColumn(conn, "collection", "card_id") &&
        cardId != null
      ) {
        const updates = [];
        const uvals = [];

        if (hasColumn(conn, "collection", "qty")) {
          updates.push("qty = COALESCE(qty,0) + ?");
          uvals.push(QTY);
        }
        if (hasColumn(conn, "collection", "last_eur")) {
          const eur = Number(payload?.eur);
          if (Number.isFinite(eur)) {
            updates.push("last_eur = ?");
            uvals.push(eur);
          }
        }

        if (updates.length) {
          uvals.push(cardId);
          const sqlUpd = `UPDATE collection SET ${updates.join(", ")} WHERE card_id = ?`;
          const infoU = conn.prepare(sqlUpd).run(uvals);
          return { ok: infoU.changes > 0, merged: true, card_id: cardId };
        }
        return { ok: true, merged: true, card_id: cardId };
      }
      throw err;
    }
  },

  async upsertExact(cardId, qty) {
    try { return Collection.upsertExactQuantity(cardId, qty); }
    catch (e) { return { ok: false, error: e.message }; }
  },

  /* --------- Stats agregadas --------- */
  stats() {
    const conn = db();
    const totals = conn.prepare(`
      SELECT
        COUNT(*)                                       AS total,
        SUM(c.qty * COALESCE(c.paid_eur, 0.0))         AS invested,
        SUM(c.qty * COALESCE(c.last_eur, s.eur, 0.0))  AS current
      FROM collection c
      LEFT JOIN scry_cards s ON s.id = c.scry_id
    `).get();

    const invested = Number(totals?.invested || 0);
    const current  = Number(totals?.current  || 0);
    return {
      ok: true,
      total: Number(totals?.total || 0),
      invested,
      current,
      delta: current - invested,
    };
  },

  /* --------- Listado detallado (unión con scry_cards) --------- */
  listDetailed() {
    const conn = db();

    const cCols = tableInfo(conn, "collection").map((c) => c.name);
    const hasCollectorNumC = cCols.includes("collector_number");
    const hasPaid = cCols.includes("paid_eur");
    const hasCond = cCols.includes("condition");

    const collectorExpr = hasCollectorNumC
      ? `COALESCE(c.collector_number, s.collector_number, '')`
      : `COALESCE(s.collector_number, '')`;

    const paidExpr = hasPaid ? "c.paid_eur" : "NULL AS paid_eur";
    const condExpr = hasCond ? "c.condition" : "NULL AS condition";

    const sql = `
      SELECT
        c.id,
        c.qty,
        COALESCE(NULLIF(c.name, ''), s.name, '—')         AS name,
        COALESCE(NULLIF(c.set_name, ''), s.set_name, '—') AS set_name,
        COALESCE(NULLIF(c.rarity, ''), s.rarity, '—')     AS rarity,
        COALESCE(c.last_eur, s.eur, 0.0)                  AS eur,
        ${collectorExpr}                                  AS collector_number,
        (c.qty * COALESCE(c.last_eur, s.eur, 0.0))        AS current_row,
        ${paidExpr},
        ${condExpr}
      FROM collection c
      LEFT JOIN scry_cards s ON s.id = c.scry_id
      ORDER BY COALESCE(s.name, c.name) COLLATE NOCASE ASC
    `;

    const rows = conn.prepare(sql).all();
    return { ok: true, items: rows };
  },

  // 👇 NUEVO: exportar colección a CSV
  exportCSV() {
    const conn = db();

    // Reutilizamos la misma info que ves en MiColección
    const rows = conn.prepare(`
      SELECT
        c.id,
        c.qty,
        COALESCE(NULLIF(c.name, ''), s.name, '')         AS name,
        COALESCE(NULLIF(c.set_name, ''), s.set_name, '') AS set_name,
        COALESCE(NULLIF(c.rarity, ''), s.rarity, '')     AS rarity,
        COALESCE(c.last_eur, s.eur, 0.0)                 AS last_eur,
        c.paid_eur,
        c.condition
      FROM collection c
      LEFT JOIN scry_cards s ON s.id = c.scry_id
      ORDER BY name COLLATE NOCASE ASC
    `).all();

    // Diálogo de guardar
    const result = dialog.showSaveDialogSync({
      title: "Exportar colección a CSV",
      defaultPath: "mi-coleccion.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (!result) {
      return { ok: false, error: "cancelado" };
    }

    const filePath = result; // en Sync, showSaveDialogSync devuelve string o undefined
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const header = [
      "id",
      "qty",
      "name",
      "set_name",
      "rarity",
      "last_eur",
      "paid_eur",
      "condition",
    ];

    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.qty,
          esc(r.name),
          esc(r.set_name),
          esc(r.rarity),
          r.last_eur ?? "",
          r.paid_eur ?? "",
          esc(r.condition ?? ""),
        ].join(",")
      );
    }

    fs.writeFileSync(filePath, lines.join("\n"), "utf8");
    console.log("[CollectionController.exportCSV] escrito:", filePath);
    return { ok: true, filePath, rows: rows.length };
  },

  /* --------- Actualización de paid_eur / condition / comment --------- */
  /**
   * payload: { cardId: number, paid_eur?: number|null, condition?: string|null, comment?: string|null }
   * - NO toca el esquema.
   * - Solo actualiza las columnas que existan realmente en la tabla `collection`.
   */
  updatePaid(payload) {
    try {
      if (!payload || typeof payload.cardId !== "number") {
        return { ok: false, error: "cardId requerido" };
      }
      const conn = db();
      const cols = tableInfo(conn, "collection").map((c) => c.name);

      const sets = [];
      const params = { id: payload.cardId };

      if ("paid_eur" in payload && cols.includes("paid_eur")) {
        if (payload.paid_eur === null) {
          sets.push("paid_eur = NULL");
        } else {
          const n = Number(payload.paid_eur);
          if (!Number.isFinite(n) || n < 0) {
            return { ok: false, error: "paid_eur inválido" };
          }
          sets.push("paid_eur = @paid_eur");
          params.paid_eur = n;
        }
      }

      if ("condition" in payload && cols.includes("condition")) {
        const c = payload.condition == null ? null : String(payload.condition).trim().toUpperCase();
        if (c == null || c === "") {
          sets.push("condition = NULL");
        } else if (!ALLOWED_CONDITIONS.has(c)) {
          return { ok: false, error: "condition inválido" };
        } else {
          sets.push("condition = @condition");
          params.condition = c;
        }
      }

      if ("comment" in payload && cols.includes("comment")) {
        const comment = payload.comment == null ? null : String(payload.comment).trim();
        if (comment == null || comment === "") {
          sets.push("comment = NULL");
        } else {
          sets.push("comment = @comment");
          params.comment = comment;
        }
      }

      if (cols.includes("updated_at")) {
        sets.push(`updated_at = CURRENT_TIMESTAMP`);
      }

      if (sets.length === 0) {
        return { ok: true, updated: 0, noop: true };
      }

      const sql = `UPDATE collection SET ${sets.join(", ")} WHERE id = @id`;
      const info = conn.prepare(sql).run(params);
      return { ok: true, updated: info.changes };
    } catch (e) {
      console.error("[CollectionController.updatePaid] error:", e);
      return { ok: false, error: String(e?.message || e) };
    }
  },

  

  /* --------- (Opcional) actualización directa de varias columnas --------- */
  updateFields(cardId, fields) {
    const conn = db();
    const cols = tableInfo(conn, "collection").map((c) => c.name);
    const allowed = ["paid_eur", "condition", "comment"].filter((k) => cols.includes(k));

    const updates = [];
    const params = { id: cardId };

    for (const key of allowed) {
      if (key in fields) {
        if (fields[key] == null || fields[key] === "") {
          updates.push(`${key} = NULL`);
        } else {
          updates.push(`${key} = @${key}`);
          params[key] = fields[key];
        }
      }
    }

    if (cols.includes("updated_at")) {
      updates.push("updated_at = CURRENT_TIMESTAMP");
    }

    if (!updates.length) return { ok: false, error: "No fields to update" };

    const sql = `UPDATE collection SET ${updates.join(", ")} WHERE id = @id`;
    const info = conn.prepare(sql).run(params);
    return { ok: true, changes: info.changes };
  },
};
