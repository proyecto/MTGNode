// electron/ipc/routes.js
import { shell } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getDbPath } from '../db/connection.js';
import { CardsController } from '../controllers/CardsController.js';
import { CollectionController } from '../controllers/CollectionController.js';
import { ScryController } from '../controllers/ScryController.js';
import { ScryCardDetailController } from '../controllers/ScryCardDetailController.js';
import { NewsController } from '../controllers/NewsController.js';


// Pequeño helper para envolver handlers y loguear errores de forma uniforme
function safeHandle(ipcMain, channel, fn) {
  ipcMain.handle(channel, async (evt, ...args) => {
    try {
      const res = await fn(evt, ...args);
      return res;
    } catch (e) {
      console.error(`[IPC ERROR] ${channel}:`, e);
      return { ok: false, error: e?.message || String(e) };
    }
  });
}

let alreadyRegistered = false;

export function registerIpc(ipcMain) {
  if (alreadyRegistered) {
    return;
  }
  alreadyRegistered = true;

  // ---------------- News (GitHub issues) ----------------
  safeHandle(ipcMain, 'news:list', async (_evt, opts) => NewsController.list(opts));

  // ---------------- Cards ----------------
  safeHandle(ipcMain, 'db:seed', async () => CardsController.seedDemo());
  safeHandle(ipcMain, 'db:list', async () => CardsController.list());
  safeHandle(ipcMain, 'db:add', async (_evt, payload) => CardsController.add(payload));
  safeHandle(ipcMain, 'cards:toggleFollow', async (_evt, cardId) => CardsController.toggleFollow(cardId));
  safeHandle(ipcMain, 'db:debug', async () => CardsController.debug());

  // -------------- Collection --------------
  safeHandle(ipcMain, 'collection:list', async () => CollectionController.list());
  safeHandle(ipcMain, 'collection:add', async (_evt, { cardId, qty }) => CollectionController.add(cardId, qty));
  safeHandle(ipcMain, 'collection:updateQty', async (_evt, { cardId, qty }) => CollectionController.updateQty(cardId, qty));
  safeHandle(ipcMain, 'collection:remove', async (_evt, { cardId }) => CollectionController.remove(cardId));

  // (opcionales si los tienes implementados)
  if (CollectionController.listDetailed) {
    safeHandle(ipcMain, 'collection:listDetailed', async () => CollectionController.listDetailed());
  }
  if (CollectionController.stats) {
    safeHandle(ipcMain, 'collection:stats', async () => CollectionController.stats());
  }
  if (CollectionController.importCSV) {
    safeHandle(ipcMain, 'collection:importCSV', async () => CollectionController.importCSV());
  }
  if (CollectionController.exportCSV) {
    safeHandle(ipcMain, 'collection:exportCSV', async () => CollectionController.exportCSV());
  }
  if (CollectionController.updatePaid) {
    safeHandle(ipcMain, 'collection:updatePaid', async (_e, payload) => CollectionController.updatePaid(payload));
  }
  if (CollectionController.diag) {
    safeHandle(ipcMain, 'collection:diag', async () => CollectionController.diag());
  }
  if (CollectionController.repairMeta) {
    safeHandle(ipcMain, 'collection:repairMeta', async () => CollectionController.repairMeta());
  }

  // ----------------- Scry (local SQLite) -----------------
  safeHandle(ipcMain, 'scry:sets', async () => ScryController.sets());
  safeHandle(ipcMain, 'scry:setInfo', async (_evt, code) => ScryController.setInfo(code));
  safeHandle(ipcMain, 'scry:cardsBySet', async (_evt, code) => ScryController.cardsBySet(code));

  // Lanzar importador bulk desde el propio Electron
  safeHandle(ipcMain, 'scry:updateBulk', async () => {
    const electronBin = process.execPath;
    const scriptPath = path.join(process.cwd(), 'scripts', 'import-scryfall.mjs');

    return new Promise((resolve) => {
      const child = spawn(
        electronBin,
        [scriptPath],
        {
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', MTG_DB_PATH: getDbPath() },
          stdio: 'inherit'
        }
      );
      child.on('exit', (code) => resolve({ ok: code === 0, code }));
    });
  });

  // Agregar a colección / seguir desde resultados Scry
  safeHandle(ipcMain, 'scry:addToCollection', async (_evt, payload) => {
    const qty = Number(payload?.qty) || 1;
    return CollectionController.addFromScry(payload, qty);
  });

  safeHandle(ipcMain, 'scry:follow', async (_evt, payload) => {
    const value = payload?.follow ?? true;
    return CardsController.followFromScry(payload, !!value);
  });

  // ----------------- Scry (online API) -----------------
  safeHandle(ipcMain, 'scry:cardDetail', async (_evt, idOrName) => {
    return await ScryCardDetailController.fetchCardDetails(idOrName);
  });

  safeHandle(ipcMain, 'scry:searchByName', async (_evt, query) => {
    const r = await ScryCardDetailController.searchByName(query);
    return r?.ok ? r.data : r;
  });

  // ----------------- Utils -----------------
  safeHandle(ipcMain, 'db:openFolder', async () => {
    const dbg = await CardsController.debug();
    if (dbg?.dbPath) shell.showItemInFolder(dbg.dbPath);
    return dbg;
  });
}
