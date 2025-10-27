import { ipcMain, shell, dialog } from "electron";
import { CardsController } from "../controllers/CardsController.js";
import { CollectionController } from "../controllers/CollectionController.js";
import { ScryController } from "../controllers/ScryController.js";
import { NewsController } from "../controllers/NewsController.js";
import { ScryCardDetailController } from "../controllers/ScryCardDetailController.js";
import { spawn } from "node:child_process";
import path from "node:path";
import { getDbPath, db } from "../db/connection.js";
import fs from "node:fs";

export function registerIpc(ipcMain) {
  // Cards
  ipcMain.handle("db:seed", async () => CardsController.seedDemo());
  ipcMain.handle("db:list", async () => CardsController.list());
  ipcMain.handle("db:add", async (_evt, payload) =>
    CardsController.add(payload)
  );
  ipcMain.handle("cards:toggleFollow", async (_evt, cardId) =>
    CardsController.toggleFollow(cardId)
  );
  ipcMain.handle("db:debug", async () => CardsController.debug());

  // Collection
  ipcMain.handle("collection:list", async () => CollectionController.list());
  ipcMain.handle("collection:add", async (_evt, { cardId, qty }) =>
    CollectionController.add(cardId, qty)
  );
  ipcMain.handle("collection:updateQty", async (_evt, { cardId, qty }) =>
    CollectionController.updateQty(cardId, qty)
  );
  ipcMain.handle("collection:remove", async (_evt, { cardId }) =>
    CollectionController.remove(cardId)
  );

  // News
  ipcMain.handle("news:list", async (_evt, { repo, per_page } = {}) =>
    NewsController.list({ repo, per_page })
  );

  // Scry
  ipcMain.handle("scry:sets", async () => ScryController.sets());
  ipcMain.handle("scry:setInfo", async (_evt, code) =>
    ScryController.setInfo(code)
  );
  ipcMain.handle("scry:cardsBySet", async (_evt, code) =>
    ScryController.cardsBySet(code)
  );
  ipcMain.handle("scry:updateBulk", async () => {
    const electronBin = process.execPath;
    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "import-scryfall.mjs"
    );

    return new Promise((resolve) => {
      const child = spawn(electronBin, [scriptPath], {
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1",
          MTG_DB_PATH: getDbPath(),
        },
        stdio: "inherit",
      });
      child.on("exit", (code) => resolve({ ok: code === 0, code }));
    });
  });
  ipcMain.handle("scry:addToCollection", async (_evt, payload) => {
    // payload: { name, set_name, rarity, eur, qty? }
    const qty = Number(payload?.qty) || 1;
    return CollectionController.addFromScry(payload, qty);
  });
  ipcMain.handle("scry:follow", async (_evt, payload) => {
    // payload: { name, set_name, rarity, eur, follow?: boolean }
    const value = payload?.follow ?? true;
    return CardsController.followFromScry(payload, !!value);
  });
  // ScryCardDetail
  ipcMain.handle("scry:cardDetail", async (_evt, idOrName) =>
    ScryCardDetailController.fetchCardDetails(idOrName)
  );
  // ----- Búsqueda real global en scry_cards -----
  ipcMain.handle("scry:searchByName", async (_evt, { q, limit = 50 } = {}) => {
    try {
      if (!q || !q.trim()) return { ok: false, error: "q vacío" };

      const conn = db(); // ✅ igual que en tus modelos
      const stmt = conn.prepare(`
      SELECT
        id,
        name,
        set_name,
        collector_number,
        rarity,
        eur,
        eur_foil,
        image_small
      FROM scry_cards
      WHERE LOWER(name) LIKE LOWER(?)
      ORDER BY name ASC
      LIMIT ?
    `);
      const rows = stmt.all(`%${q}%`, limit);

      return { ok: true, total: rows.length, items: rows };
    } catch (e) {
      console.error("[scry:searchByName] error", e);
      return { ok: false, error: e.message };
    }
  });

  // Util
  ipcMain.handle("db:openFolder", async () => {
    const dbg = await CardsController.debug();
    if (dbg?.dbPath) shell.showItemInFolder(dbg.dbPath);
    return dbg;
  });

  // ----- Exportar Mi colección a CSV (real) -----
  ipcMain.handle("collection:exportCSV", async () => {
    try {
      const rows = await CollectionController.list(); // [{collection_id, card_id, quantity, acquired_at, name, edition, rarity, price_eur}, ...]

      // 1) Construimos CSV (UTF-8 con BOM; Excel-friendly)
      const headers = [
        "collection_id",
        "card_id",
        "name",
        "edition",
        "rarity",
        "quantity",
        "price_eur",
        "acquired_at",
      ];

      const esc = (v) => {
        const s = v == null ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`; // RFC4180
      };

      const lines = [];
      lines.push(headers.join(","));
      for (const r of rows) {
        lines.push(
          [
            r.collection_id,
            r.card_id,
            r.name,
            r.edition ?? "",
            r.rarity ?? "",
            r.quantity ?? 0,
            (r.price_eur ?? "") === "" ? "" : Number(r.price_eur),
            r.acquired_at ?? "",
          ]
            .map(esc)
            .join(",")
        );
      }
      const csvContent = "\uFEFF" + lines.join("\n");

      // 2) Diálogo "Guardar como…"
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: "Exportar Mi colección",
        defaultPath: "mi-coleccion.csv",
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (canceled || !filePath) return { ok: false, canceled: true };

      // 3) Guardar en disco
      fs.writeFileSync(filePath, csvContent, "utf8");

      return { ok: true, path: filePath, count: rows.length };
    } catch (e) {
      console.error("[collection:exportCSV] error", e);
      return { ok: false, error: e.message };
    }
  });

  // ----- Importar Mi colección desde CSV (real) -----
  // Requisitos: cabecera con al menos "card_id" y "quantity"
  ipcMain.handle("collection:importCSV", async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: "Importar Mi colección (CSV)",
        properties: ["openFile"],
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (canceled || !filePaths?.length) return { ok: false, canceled: true };

      const filePath = filePaths[0];
      let raw = fs.readFileSync(filePath, "utf8");

      // --- Normalización CSV ---
      // Quita BOM si lo hay
      if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
      // Normaliza saltos de línea
      const lines = raw
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .split("\n")
        .filter((l) => l.trim().length > 0);
      if (lines.length === 0) return { ok: false, error: "CSV vacío" };

      // Parser sencillo con comillas; detecta separador por cabecera
      function parseCsvLine(line, sep) {
        const out = [];
        let cur = "";
        let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQ) {
            if (ch === '"') {
              if (line[i + 1] === '"') {
                cur += '"';
                i++;
              } else inQ = false;
            } else cur += ch;
          } else {
            if (ch === '"') inQ = true;
            else if (ch === sep) {
              out.push(cur);
              cur = "";
            } else cur += ch;
          }
        }
        out.push(cur);
        return out;
      }

      const first = lines[0];
      const sep =
        (first.match(/;/g)?.length || 0) > (first.match(/,/g)?.length || 0)
          ? ";"
          : ",";
      const header = parseCsvLine(first, sep).map((h) =>
        h.trim().toLowerCase()
      );

      const idxCardId = header.indexOf("card_id");
      const idxQty = header.indexOf("quantity");
      if (idxCardId === -1 || idxQty === -1) {
        return {
          ok: false,
          error: "Cabecera inválida. Se requieren columnas card_id y quantity",
        };
      }

      // --- Aplicar cantidades EXACTAS con upsert ---
      let added = 0,
        updated = 0,
        removed = 0,
        ignored = 0;

      for (let li = 1; li < lines.length; li++) {
        const row = parseCsvLine(lines[li], sep);
        if (!row.length) continue;

        const cardId = Number(row[idxCardId]?.trim());
        const qtyStr = String(row[idxQty] ?? "").trim();
        // Acepta "5" o "5.0" (si viene "5,0", lo tratamos como 5)
        const qty = Number(qtyStr.replace(",", "."));

        if (!Number.isInteger(cardId) || Number.isNaN(qty) || qty < 0) {
          ignored++;
          continue;
        }

        const res = await CollectionController.upsertExact(cardId, qty);

        if (!res?.ok) {
          ignored++;
          continue;
        }
        if (qty === 0) {
          if (res.removed) removed++;
          else updated++; // ya estaba a 0 o no existía
        } else {
          // No sabemos si fue insert o update, pero podemos estimar:
          // si antes no existía, lo cuenta como "added", si existía "updated".
          // Para mantenerlo simple marcamos updated++ (o si quieres, puedes consultar si existía).
          updated++;
        }
      }

      return { ok: true, path: filePath, added, updated, removed, ignored };
    } catch (e) {
      console.error("[collection:importCSV] error", e);
      return { ok: false, error: e.message };
    }
  });
}
