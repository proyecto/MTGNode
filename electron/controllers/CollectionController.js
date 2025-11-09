import * as Collection from "../models/CollectionModel.js";
import { db } from "../db/connection.js";

/**
 * Devuelve información de columnas de una tabla
 */
function tableInfo(conn, table) {
  try {
    return conn.prepare(`PRAGMA table_info(${table})`).all();
  } catch {
    return [];
  }
}

/**
 * Comprueba si existe una columna
 */
function hasColumn(conn, table, col) {
  return tableInfo(conn, table).some((r) => r.name === col);
}

/**
 * Comprueba si una columna es NOT NULL
 */
function isNotNull(conn, table, col) {
  const info = tableInfo(conn, table).find((r) => r.name === col);
  return !!(info && info.notnull === 1);
}

/**
 * Busca o crea una carta en `cards` y devuelve su id.
 * Usa solo las columnas que existan realmente en la tabla `cards`.
 * Coincidencia por (name, set_name?, collector_number?) en minúsculas.
 */
function getOrCreateCardId(conn, payload) {
  if (!payload?.name) return null;

  const cardsCols = tableInfo(conn, "cards").map((c) => c.name);
  const hasCards = cardsCols.length > 0;
  if (!hasCards) return null; // si no existe tabla cards, no podemos resolver

  const canName = cardsCols.includes("name");
  const canSet = cardsCols.includes("set_name");
  const canNumber = cardsCols.includes("collector_number");
  const canRarity = cardsCols.includes("rarity");
  const canEur = cardsCols.includes("eur");

  // SELECT dinámico por lo que exista
  const where = [];
  const args = [];
  if (canName) {
    where.push("LOWER(name)=LOWER(?)");
    args.push(payload.name);
  }
  if (canSet && payload.set_name) {
    where.push("LOWER(set_name)=LOWER(?)");
    args.push(payload.set_name);
  }
  if (canNumber && payload.collector_number) {
    where.push("collector_number=?");
    args.push(String(payload.collector_number));
  }

  let row;
  if (where.length) {
    const sqlSel = `SELECT id FROM cards WHERE ${where.join(" AND ")} LIMIT 1`;
    row = conn.prepare(sqlSel).get(args);
  }

  if (row?.id) return row.id;

  // INSERT dinámico con las columnas disponibles
  const cols = [];
  const qms = [];
  const vals = [];
  if (canName) {
    cols.push("name");
    qms.push("?");
    vals.push(payload.name);
  }
  if (canSet && payload.set_name) {
    cols.push("set_name");
    qms.push("?");
    vals.push(payload.set_name);
  }
  if (canNumber && payload.collector_number) {
    cols.push("collector_number");
    qms.push("?");
    vals.push(String(payload.collector_number));
  }
  if (canRarity && payload.rarity) {
    cols.push("rarity");
    qms.push("?");
    vals.push(payload.rarity);
  }
  if (canEur && Number.isFinite(Number(payload.eur))) {
    cols.push("eur");
    qms.push("?");
    vals.push(Number(payload.eur));
  }

  if (!cols.length) return null; // no tenemos columnas para insertar nada coherente

  const sqlIns = `INSERT INTO cards (${cols.join(",")}) VALUES (${qms.join(
    ","
  )})`;
  const info = conn.prepare(sqlIns).run(vals);
  return info.lastInsertRowid || null;
}

export const CollectionController = {
  diag() {
    const conn = db();
    const has = (c) => hasColumn(conn, "collection", c);

    const total = conn.prepare(`SELECT COUNT(*) AS n FROM collection`).get().n;

    let withScry = 0,
      withoutScry = 0;
    if (has("scry_id")) {
      withScry = conn
        .prepare(
          `SELECT COUNT(*) AS n FROM collection WHERE scry_id IS NOT NULL AND scry_id <> ''`
        )
        .get().n;
      withoutScry = total - withScry;
    }

    // Cuántas filas “emparejan” con scry_cards (por scry_id o por name+set_name)
    const canName = has("name"),
      canSet = has("set_name");
    const joinHits = conn
      .prepare(
        `
    SELECT COUNT(*) AS n
    FROM collection c
    LEFT JOIN scry_cards s
      ON (${has("scry_id") ? "s.id = c.scry_id" : "0"})
      OR (${
        canName && canSet
          ? "LOWER(s.name)=LOWER(c.name) AND LOWER(s.set_name)=LOWER(c.set_name)"
          : "0"
      })
    WHERE s.id IS NOT NULL
  `
      )
      .get().n;

    const missingName = canName
      ? conn
          .prepare(
            `SELECT COUNT(*) AS n FROM collection WHERE name IS NULL OR TRIM(name)=''`
          )
          .get().n
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

    // 1️⃣ Completar faltantes usando scry_id directo
    if (canScry && (canName || canSet || canRarity)) {
      const rows = conn
        .prepare(
          `
      SELECT id, scry_id FROM collection
      WHERE scry_id IS NOT NULL AND TRIM(scry_id) <> ''
    `
        )
        .all();

      const sel = conn.prepare(`
      SELECT name, set_name, rarity, CAST(COALESCE(eur,0) AS REAL) AS eur
      FROM scry_cards WHERE id = ? LIMIT 1
    `);

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
        upd.run({
          id: r.id,
          name: s.name,
          set_name: s.set_name,
          rarity: s.rarity,
          eur: s.eur,
        });
        fixedFromScryId++;
      }
    }

    // 2️⃣ Emparejar por name+set_name
    if (canName && canSet && canScry) {
      const rows = conn
        .prepare(
          `
      SELECT id, name, set_name
      FROM collection
      WHERE (scry_id IS NULL OR TRIM(scry_id) = '')
        AND name IS NOT NULL AND TRIM(name) <> ''
        AND set_name IS NOT NULL AND TRIM(set_name) <> ''
    `
        )
        .all();

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

    // 3️⃣ Completar desde cards
    if (has("card_id")) {
      const cardsCols = tableInfo(conn, "cards").map((c) => c.name);
      const canCardsName = cardsCols.includes("name");
      const canCardsRar = cardsCols.includes("rarity");

      if (canCardsName || canCardsRar) {
        const rows = conn
          .prepare(
            `
        SELECT c.id AS cid, k.name AS kname, k.rarity AS krar
        FROM collection c
        JOIN cards k ON k.id = c.card_id
        WHERE ${canName ? "(c.name IS NULL OR TRIM(c.name)='')" : "1=1"}
           OR ${canRarity ? "(c.rarity IS NULL OR TRIM(c.rarity)='')" : "1=1"}
      `
          )
          .all();

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

  remove(cardId) {
    const conn = db();

    // IMPORTANTE: placeholders posicionales y solo valores (no objetos)
    const stmt = conn.prepare(`
      DELETE FROM collection
      WHERE id = ? OR card_id = ? OR scry_id = ?
    `);

    const info = stmt.run(cardId, cardId, cardId);
    console.log(
      "[CollectionController.remove] deleted",
      info.changes,
      "rows for",
      cardId
    );
    return { ok: true, changes: info.changes };
  },

  addFromScry(payload, qty = 1) {
    const conn = db();

    // ¿card_id NOT NULL?
    const needsCardId =
      hasColumn(conn, "collection", "card_id") &&
      isNotNull(conn, "collection", "card_id");

    // Resolver/crear card_id si hace falta o existe la columna
    let cardId = null;
    if (hasColumn(conn, "collection", "card_id")) {
      cardId = getOrCreateCardId(conn, payload);
      if (needsCardId && !cardId) {
        throw new Error(
          "No se pudo resolver card_id (cards inexistente o sin columnas mínimas)"
        );
      }
    }

    // Construimos INSERT dinámico
    const cols = [];
    const qms = [];
    const vals = [];

    const QTY = Number(qty) || 1;
    if (hasColumn(conn, "collection", "qty")) {
      cols.push("qty");
      qms.push("?");
      vals.push(QTY);
    }
    if (hasColumn(conn, "collection", "card_id")) {
      cols.push("card_id");
      qms.push("?");
      vals.push(cardId || null);
    }
    if (hasColumn(conn, "collection", "scry_id") && payload?.id) {
      cols.push("scry_id");
      qms.push("?");
      vals.push(payload.id);
    }
    if (hasColumn(conn, "collection", "name") && payload?.name) {
      cols.push("name");
      qms.push("?");
      vals.push(payload.name);
    }
    if (hasColumn(conn, "collection", "set_name") && payload?.set_name) {
      cols.push("set_name");
      qms.push("?");
      vals.push(payload.set_name);
    }
    if (hasColumn(conn, "collection", "rarity") && payload?.rarity) {
      cols.push("rarity");
      qms.push("?");
      vals.push(payload.rarity);
    }
    if (hasColumn(conn, "collection", "last_eur")) {
      const eur = Number(payload?.eur);
      cols.push("last_eur");
      qms.push("?");
      vals.push(Number.isFinite(eur) ? eur : null);
    }

    if (!cols.length) {
      const info = conn.prepare(`INSERT INTO collection DEFAULT VALUES`).run();
      return { ok: info.changes > 0, id: info.lastInsertRowid, merged: false };
    }

    const sqlInsert = `INSERT INTO collection (${cols.join(
      ","
    )}) VALUES (${qms.join(",")})`;

    try {
      const info = conn.prepare(sqlInsert).run(vals);
      return { ok: info.changes > 0, id: info.lastInsertRowid, merged: false };
    } catch (err) {
      // Si hay UNIQUE en card_id, hacemos UPSERT manual: sumamos qty
      if (
        String(err?.code) === "SQLITE_CONSTRAINT_UNIQUE" &&
        hasColumn(conn, "collection", "card_id") &&
        cardId != null
      ) {
        // Actualiza qty += QTY; refresca last_eur si lo tenemos
        const updates = [];
        const uvals = [];

        if (hasColumn(conn, "collection", "qty")) {
          updates.push("qty = COALESCE(qty,0) + ?");
          uvals.push(QTY);
        }
        if (hasColumn(conn, "collection", "last_eur")) {
          const eur = Number(payload?.eur);
          // solo pisa last_eur si viene un número válido
          if (Number.isFinite(eur)) {
            updates.push("last_eur = ?");
            uvals.push(eur);
          }
        }

        if (updates.length) {
          uvals.push(cardId);
          const sqlUpd = `UPDATE collection SET ${updates.join(
            ", "
          )} WHERE card_id = ?`;
          const infoU = conn.prepare(sqlUpd).run(uvals);
          return { ok: infoU.changes > 0, merged: true, card_id: cardId };
        }

        // Si no hay columnas que actualizar, no hacemos nada más
        return { ok: true, merged: true, card_id: cardId };
      }
      // Otro error diferente → propaga
      throw err;
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
    // Totales coherentes con la lectura detallada
    const totals = conn
      .prepare(
        `
    SELECT
      COUNT(*)                                       AS total,
      SUM(c.qty * COALESCE(c.paid_eur, 0.0))         AS invested,
      SUM(c.qty * COALESCE(c.last_eur, s.eur, 0.0))  AS current
    FROM collection c
    LEFT JOIN scry_cards s ON s.id = c.scry_id
  `
      )
      .get();

    const invested = Number(totals?.invested || 0);
    const current = Number(totals?.current || 0);
    return {
      ok: true,
      total: Number(totals?.total || 0),
      invested,
      current,
      delta: current - invested,
    };
  },
  listDetailed() {
    const conn = db();

    // Detecta columnas reales de 'collection'
    const collectionCols = tableInfo(conn, "collection").map((c) => c.name);
    const hasColNum = collectionCols.includes("collector_number");

    // Expresión segura para el nº de coleccionista
    const collectorExpr = hasColNum
      ? `COALESCE(c.collector_number, s.collector_number, '')`
      : `COALESCE(s.collector_number, '')`;

    const sql = `
    SELECT
      c.id,
      c.qty,
      COALESCE(NULLIF(c.name, ''), s.name, '—')             AS name,
      COALESCE(NULLIF(c.set_name, ''), s.set_name, '—')     AS set_name,
      COALESCE(NULLIF(c.rarity, ''), s.rarity, '—')         AS rarity,
      COALESCE(c.last_eur, s.eur, 0.0)                      AS eur,
      ${collectorExpr}                                      AS collector_number,
      (c.qty * COALESCE(c.last_eur, s.eur, 0.0))            AS current_row,
      c.paid_eur
    FROM collection c
    LEFT JOIN scry_cards s ON s.id = c.scry_id
    ORDER BY COALESCE(s.name, c.name) COLLATE NOCASE ASC
  `;

    const rows = conn.prepare(sql).all();
    return { ok: true, items: rows };
  },

  updatePaid(cardId, paid_eur) {
    const conn = db();
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
