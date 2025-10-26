import { ipcMain, shell, dialog } from 'electron';
import { CardsController } from "../controllers/CardsController.js";
import { CollectionController } from "../controllers/CollectionController.js";
import { ScryController } from "../controllers/ScryController.js";
import { spawn } from "node:child_process";
import path from "node:path";
import { getDbPath } from "../db/connection.js";
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

  // ----- STUB: Importar CSV (sin tocar disco)
  ipcMain.handle("collection:importCSV:stub", async () => {
    // simulamos que importaríamos X filas
    return {
      ok: true,
      simulated: true,
      wouldImport: 42,
    };
  });
}
