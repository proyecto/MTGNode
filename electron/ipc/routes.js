import { shell } from 'electron';
import { CardsController } from '../controllers/CardsController.js';
import { CollectionController } from '../controllers/CollectionController.js';
import { ScryController } from '../controllers/ScryController.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { getDbPath } from '../db/connection.js';


export function registerIpc(ipcMain) {
  // Cards
  ipcMain.handle('db:seed', async () => CardsController.seedDemo());
  ipcMain.handle('db:list', async () => CardsController.list());
  ipcMain.handle('db:add', async (_evt, payload) => CardsController.add(payload));
  ipcMain.handle('cards:toggleFollow', async (_evt, cardId) => CardsController.toggleFollow(cardId));
  ipcMain.handle('db:debug', async () => CardsController.debug());

  // Collection
  ipcMain.handle('collection:list', async () => CollectionController.list());
  ipcMain.handle('collection:add', async (_evt, { cardId, qty }) => CollectionController.add(cardId, qty));
  ipcMain.handle('collection:updateQty', async (_evt, { cardId, qty }) => CollectionController.updateQty(cardId, qty));
  ipcMain.handle('collection:remove', async (_evt, { cardId }) => CollectionController.remove(cardId));

  // Scry
  ipcMain.handle('scry:sets', async () => ScryController.sets());
  ipcMain.handle('scry:setInfo', async (_evt, code) => ScryController.setInfo(code));
  ipcMain.handle('scry:cardsBySet', async (_evt, code) => ScryController.cardsBySet(code));
  ipcMain.handle('scry:updateBulk', async () => {
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
  ipcMain.handle('scry:addToCollection', async (_evt, payload) => {
    // payload: { name, set_name, rarity, eur, qty? }
    const qty = Number(payload?.qty) || 1;
    return CollectionController.addFromScry(payload, qty);
  });

  ipcMain.handle('scry:follow', async (_evt, payload) => {
    // payload: { name, set_name, rarity, eur, follow?: boolean }
    const value = payload?.follow ?? true;
    return CardsController.followFromScry(payload, !!value);
  });

  // Util
  ipcMain.handle('db:openFolder', async () => {
    const dbg = await CardsController.debug();
    if (dbg?.dbPath) shell.showItemInFolder(dbg.dbPath);
    return dbg;
  });
}
