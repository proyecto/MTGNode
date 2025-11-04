import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerIpc } from "./electron/ipc/routes.js";
import { CardsController } from "./electron/controllers/CardsController.js";
import { installAppMenu } from "./electron/menu.js";
import fs from "node:fs"; // añade esto arriba

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !!process.env.ELECTRON_START_URL;
let win;

async function bootSeed() {
  const dbg = await CardsController.debug();
  if (dbg.ok && dbg.cards === 0) {
    const seeded = await CardsController.seedDemo();
    const after = await CardsController.debug();
    console.log(
      "[BOOT] seedDemo:",
      seeded,
      "counts:",
      dbg.cards,
      "->",
      after.cards
    );
  } else {
    console.log("[BOOT] no seed needed. cards =", dbg.cards);
  }
}

function createWindow() {
  const preloadPath = path.join(__dirname, "electron", "preload.cjs");
  const indexPath = fileURLToPath(
    new URL("./dist/index.html", import.meta.url)
  );

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "MTG – React + SQLite (MVC)",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: isDev ? false : true,
      preload: preloadPath,
    },
  });

  installAppMenu(win);

  console.log("[VERSIONS]", process.versions);
  console.log("[PATHS]", {
    appPath: app.getAppPath(),
    __dirname,
    preloadPath,
    indexPath,
  });

  // checks sin require()
  console.log("[CHECK] preload exists?", fs.existsSync(preloadPath));
  console.log("[CHECK] index exists?", fs.existsSync(indexPath));

  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    console.log("[MAIN] Loading DEV URL:", devUrl);
    win.loadURL(devUrl);
  } else {
    console.log("[MAIN] Loading PROD file:", indexPath);
    win.loadFile(indexPath);
  }
}

registerIpc(ipcMain);

process.on("unhandledRejection", (r) =>
  console.error("[UNHANDLED REJECTION]", r)
);

app.whenReady().then(async () => {
  // 1) Migrar y salir, sin cargar IPC ni controladores
  if (process.argv.includes('--migrate-only')) {
    const { runMigrations } = await import('./electron/db/migrator.js');
    await runMigrations();
    app.quit();
    return;
  }

  // 2) Migrar siempre al boot normal
  const { runMigrations } = await import('./electron/db/migrator.js');
  await runMigrations();

   // 3) A partir de aquí ya puedes cargar lo demás
  const { registerIpc } = await import('./electron/ipc/routes.js');
  const { installAppMenu } = await import('./electron/menu.js');
  const { CardsController } = await import('./electron/controllers/CardsController.js');


  await bootSeed();
  createWindow();
  installAppMenu(win);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
