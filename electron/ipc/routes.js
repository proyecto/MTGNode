// electron/ipc/routes.js
import { shell, dialog } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";

import { CardsController } from "../controllers/CardsController.js";
import { CollectionController } from "../controllers/CollectionController.js";
import { ScryController } from "../controllers/ScryController.js";
import { ScryCardDetailController } from "../controllers/ScryCardDetailController.js";
import { NewsController } from "../controllers/NewsController.js";
import { getDbPath } from "../db/connection.js";

// Helper: envoltorio seguro para ipcMain.handle
function safeHandle(ipcMain, channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      const res = await handler(event, ...args);
      return res;
    } catch (e) {
      console.error(`[IPC ERROR] ${channel}:`, e);
      return { ok: false, error: e?.message || String(e) };
    }
  });
}

export function registerIpc(ipcMain) {
  console.log("[IPC] collection handlers registered");

  /* ========== Cards ========== */
  safeHandle(ipcMain, "db:seed", async () => CardsController.seedDemo());
  safeHandle(ipcMain, "db:list", async () => CardsController.list());
  safeHandle(ipcMain, "db:add", async (_evt, payload) =>
    CardsController.add(payload)
  );
  safeHandle(ipcMain, "cards:toggleFollow", async (_evt, cardId) =>
    CardsController.toggleFollow(cardId)
  );
  safeHandle(ipcMain, "db:debug", async () => CardsController.debug());

  /* ========== Collection básica ========== */
  safeHandle(ipcMain, "collection:list", async () =>
    CollectionController.list()
  );
  safeHandle(ipcMain, "collection:add", async (_evt, { cardId, qty }) =>
    CollectionController.add(cardId, qty)
  );
  safeHandle(ipcMain, "collection:updateQty", async (_evt, { cardId, qty }) =>
    CollectionController.updateQty(cardId, qty)
  );
  // IMPORTANTE: aquí esperamos un id simple (no objeto)
  safeHandle(ipcMain, "collection:remove", async (_evt, cardId) =>
    CollectionController.remove(cardId)
  );

  /* ========== Collection CSV (menú + botones) ========== */
  safeHandle(ipcMain, "collection:exportCSV", async () =>
    CollectionController.exportCSV()
  );

  safeHandle(ipcMain, "collection:importCSV", async () => {
    if (!CollectionController.importCSV) {
      return { ok: false, error: "importCSV no implementado en CollectionController" };
    }
    return CollectionController.importCSV(dialog);
  });

  /* ========== Collection stats / detalle / diag ========== */
  safeHandle(ipcMain, "collection:stats", async () =>
    CollectionController.stats()
  );
  safeHandle(ipcMain, "collection:listDetailed", async () =>
    CollectionController.listDetailed()
  );
  safeHandle(ipcMain, "collection:updatePaid", async (_evt, payload) =>
    CollectionController.updatePaid(payload.cardId, payload.paid_eur)
  );
  safeHandle(ipcMain, "collection:diag", async () =>
    CollectionController.diag()
  );
  safeHandle(ipcMain, "collection:repairMeta", async () =>
    CollectionController.repairMeta()
  );

  /* ========== News (Novedades) ========== */
  safeHandle(ipcMain, "news:list", async (_evt, opts) =>
    NewsController.list(opts)
  );

  /* ========== Scry — sets, cartas por set ========== */
  safeHandle(ipcMain, "scry:sets", async () => ScryController.sets());
  safeHandle(ipcMain, "scry:setInfo", async (_evt, code) =>
    ScryController.setInfo(code)
  );
  safeHandle(ipcMain, "scry:cardsBySet", async (_evt, code) =>
    ScryController.cardsBySet(code)
  );

  // Bulk update (script import-scryfall.mjs)
  safeHandle(ipcMain, "scry:updateBulk", async () => {
    const electronBin = process.execPath;
    const scriptPath = path.join(process.cwd(), "scripts", "import-scryfall.mjs");

    return new Promise((resolve) => {
      const child = spawn(
        electronBin,
        [scriptPath],
        {
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: "1",
            MTG_DB_PATH: getDbPath(),
          },
          stdio: "inherit",
        }
      );

      child.on("exit", (code) => {
        resolve({ ok: code === 0, code });
      });
    });
  });

  /* ========== Scry — búsqueda y detalle de carta ========== */
  safeHandle(ipcMain, "scry:searchByName", async (_evt, nameOrOpts) => {
    // En tu preload mandas a veces string, a veces objeto
    let query = nameOrOpts;
    if (typeof nameOrOpts === "object" && nameOrOpts?.name) {
      query = nameOrOpts.name;
    }
    return ScryController.searchByName(query);
  });

  safeHandle(ipcMain, "scry:cardDetail", async (_evt, idOrName) =>
    ScryCardDetailController.fetchCardDetails(idOrName)
  );

  /* ========== Scry — acciones desde colecciones ========== */
  safeHandle(ipcMain, "scry:addToCollection", async (_evt, payload) =>
    CollectionController.addFromScry(payload, Number(payload?.qty) || 1)
  );

  safeHandle(ipcMain, "scry:follow", async (_evt, payload) =>
    CardsController.followFromScry(payload, !!payload?.follow)
  );

  /* ========== Utilidad: abrir carpeta de la DB ========== */
  safeHandle(ipcMain, "db:openFolder", async () => {
    const dbg = await CardsController.debug();
    if (dbg?.dbPath) shell.showItemInFolder(dbg.dbPath);
    return dbg;
  });
}
