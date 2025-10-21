import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpc } from './electron/ipc/routes.js';
import { CardsController } from './electron/controllers/CardsController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !!process.env.ELECTRON_START_URL;
let win;

async function bootSeed() {
  const dbg = await CardsController.debug();
  if (dbg.ok && dbg.cards === 0) {
    const seeded = await CardsController.seedDemo();
    const after = await CardsController.debug();
    console.log('[BOOT] seedDemo:', seeded, 'counts:', dbg.cards, '->', after.cards);
  } else {
    console.log('[BOOT] no seed needed. cards =', dbg.cards);
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'MTG – React + SQLite (MVC)',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: isDev ? false : true,
      preload: path.join(__dirname, 'electron', 'preload.cjs') // CJS estable
    }
  });

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    console.log('[MAIN] Loading DEV URL:', devUrl);
    win.loadURL(devUrl);
  } else {
    const prod = path.join(__dirname, 'dist', 'index.html');
    console.log('[MAIN] Loading PROD file:', prod);
    win.loadFile(prod);
  }
}

registerIpc(ipcMain);

process.on('unhandledRejection', (r) => console.error('[UNHANDLED REJECTION]', r));

app.whenReady().then(async () => {
  await bootSeed();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
