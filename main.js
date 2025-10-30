import { app, BrowserWindow, ipcMain} from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerIpc } from './electron/ipc/routes.js';
import { CardsController } from './electron/controllers/CardsController.js';
import { installAppMenu } from './electron/menu.js';

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
  const preloadPath = path.join(__dirname, 'electron', 'preload.cjs');
  const indexPath   = fileURLToPath(new URL('./dist/index.html', import.meta.url));

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'MTG – React + SQLite (MVC)',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: isDev ? false : true,
      preload: preloadPath
    }
  });

  installAppMenu(win);

  // --- LOGS ÚTILES ---
  console.log('[VERSIONS]', process.versions);
  console.log('[PATHS]', { appPath: app.getAppPath(), __dirname, preloadPath, indexPath });

  // --- Comprobaciones antes de cargar (para detectar pantalla blanca por ruta) ---
  try {
    const fs = require('node:fs');
    console.log('[CHECK] preload exists?', fs.existsSync(preloadPath));
    console.log('[CHECK] index exists?', fs.existsSync(indexPath));
  } catch (e) {
    console.warn('[CHECK] fs.existsSync failed', e);
  }

  // --- Eventos de diagnóstico de carga ---
  win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    console.error('[did-fail-load]', { code, desc, url, isMainFrame });
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[render-process-gone]', details);
  });
  win.webContents.on('console-message', (_e, level, message, line, srcId) => {
    console.log('[renderer]', { level, message, line, srcId });
  });

  // --- Carga ---
  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    console.log('[MAIN] Loading DEV URL:', devUrl);
    win.loadURL(devUrl);
  } else {
    console.log('[MAIN] Loading PROD file:', indexPath);
    // loadFile es correcto; si prefieres, puedes usar loadURL(file://)
    win.loadFile(indexPath);
  }

  // Abre DevTools si pones DEBUG_UI=1 al lanzar la app empaquetada
  if (process.env.DEBUG_UI === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
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
