import { app, BrowserWindow, ipcMain, Menu } from 'electron';
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
    const indexPath = fileURLToPath(new URL('./dist/index.html', import.meta.url));
    console.log('[MAIN] Loading PROD file:', indexPath);
    win.loadFile(indexPath);
  }
}

registerIpc(ipcMain);

process.on('unhandledRejection', (r) => console.error('[UNHANDLED REJECTION]', r));

function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Quit' } // en macOS mostrará "MTGNode → Quit"
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  await bootSeed();
  createWindow();
  createAppMenu();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
