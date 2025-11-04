// electron/ipc/routes.js
import { shell } from 'electron';
import { CardsController } from '../controllers/CardsController.js';
import { CollectionController } from '../controllers/CollectionController.js';
import { ScryController } from '../controllers/ScryController.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getDbPath } from '../db/connection.js';

/**
 * Registra un handler de IPC de forma segura:
 * - elimina cualquier handler previo del mismo canal (evita "second handler")
 * - envuelve en try/catch y devuelve { ok:false, error } si algo lanza
 */
function safeHandle(ipcMain, channel, handler) {
  try { ipcMain.removeHandler(channel); } catch {}
  ipcMain.handle(channel, async (evt, ...args) => {
    try {
      return await handler(evt, ...args);
    } catch (err) {
      console.error(`[IPC ERROR] ${channel}:`, err);
      return { ok: false, error: String(err?.message || err) };
    }
  });
}

export function registerIpc(ipcMain) {
  console.log('[IPC] collection handlers registered');

  // -----------------------
  // Cards
  // -----------------------
  safeHandle(ipcMain, 'db:seed', async () => CardsController.seedDemo());
  safeHandle(ipcMain, 'db:list', async () => CardsController.list());
  safeHandle(ipcMain, 'db:add', async (_evt, payload) => CardsController.add(payload));
  safeHandle(ipcMain, 'cards:toggleFollow', async (_evt, cardId) => CardsController.toggleFollow(cardId));
  safeHandle(ipcMain, 'db:debug', async () => CardsController.debug());

  // -----------------------
  // Collection
  // -----------------------
  safeHandle(ipcMain, 'collection:list', async () => CollectionController.list());
  // Alias para pantallas que llamen al detallado
  safeHandle(ipcMain, 'collection:listDetailed', async () => {
    if (typeof CollectionController.listDetailed === 'function') {
      return CollectionController.listDetailed();
    }
    return CollectionController.list();
  });
  safeHandle(ipcMain, 'collection:stats', async () => CollectionController.stats());
  safeHandle(ipcMain, 'collection:add', async (_evt, { cardId, qty }) => CollectionController.add(cardId, qty));
  safeHandle(ipcMain, 'collection:updateQty', async (_evt, { cardId, qty }) => CollectionController.updateQty(cardId, qty));
  safeHandle(ipcMain, 'collection:remove', async (_evt, { cardId }) => CollectionController.remove(cardId));
  // --- Mi colección: diagnóstico / reparación ---
  safeHandle(ipcMain, 'collection:diag', async () => CollectionController.diag());
  safeHandle(ipcMain, 'collection:repairMeta', async () => CollectionController.repairMeta());
  safeHandle(ipcMain, 'collection:updatePaid', async (_evt, { id, paid_eur }) => {
    if (typeof CollectionController.updatePaid === 'function') {
      return CollectionController.updatePaid(id, paid_eur);
    }
    return { ok: false, error: 'updatePaid no implementado' };
  });
  safeHandle(ipcMain, 'collection:exportCSV', async () => {
    if (typeof CollectionController.exportCSV === 'function') {
      return CollectionController.exportCSV();
    }
    return { ok: false, error: 'exportCSV no implementado' };
  });
  safeHandle(ipcMain, 'collection:importCSV', async (_evt, filePath) => {
    if (typeof CollectionController.importCSV === 'function') {
      return CollectionController.importCSV(filePath);
    }
    return { ok: false, error: 'importCSV no implementado' };
  });

  // -----------------------
  // Scryfall
  // -----------------------
  safeHandle(ipcMain, 'scry:sets', async () => ScryController.sets());
  safeHandle(ipcMain, 'scry:setInfo', async (_evt, code) => ScryController.setInfo(code));
  safeHandle(ipcMain, 'scry:cardsBySet', async (_evt, code) => ScryController.cardsBySet(code));
  safeHandle(ipcMain, 'scry:searchByName', async (_evt, name) => {
    if (typeof ScryController.searchByName === 'function') {
      return ScryController.searchByName(name);
    }
    return { ok: false, error: 'searchByName no implementado' };
  });
  safeHandle(ipcMain, 'scry:cardDetail', async (_evt, id) => {
    if (typeof ScryController.cardDetail === 'function') {
      return ScryController.cardDetail(id);
    }
    return { ok: false, error: 'cardDetail no implementado' };
  });

  // Lanzar importador bulk como subproceso (con Electron como node)
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

  safeHandle(ipcMain, 'scry:addToCollection', async (_evt, payload) => {
    const qty = Number(payload?.qty) || 1;
    return CollectionController.addFromScry(payload, qty);
  });

  safeHandle(ipcMain, 'scry:follow', async (_evt, payload) => {
    const value = payload?.follow ?? true;
    return CardsController.followFromScry(payload, !!value);
  });

  // -----------------------
  // Util
  // -----------------------
  safeHandle(ipcMain, 'db:openFolder', async () => {
    const dbg = await CardsController.debug();
    if (dbg?.dbPath) shell.showItemInFolder(dbg.dbPath);
    return dbg;
  });


  // -----------------------
  // Novedades (GitHub issues)
  // -----------------------
  safeHandle(ipcMain, 'news:list', async () => {
    const url = 'https://api.github.com/search/issues?q=repo:proyecto/MTGNode+is:issue+state:open&sort=updated&order=desc&per_page=10';
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'MTGNode-App'
        }
      });
      const json = await res.json();
      return {
        ok: true,
        items: (json.items || []).map(i => ({
          id: i.id,
          title: i.title,
          body: i.body,
          updated_at: i.updated_at
        }))
      };
    } catch (err) {
      console.error('[NEWS ERROR]', err);
      return { ok: false, error: String(err?.message || err) };
    }
  });


}
