// electron/menu.js
import { app, Menu, shell } from "electron";

export function installAppMenu(mainWindow) {
  const isMac = process.platform === "darwin";

  const template = [
    // Menú de la app en macOS
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about", label: "Acerca de MTGNode" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide", label: "Ocultar" },
              { role: "hideOthers", label: "Ocultar otros" },
              { role: "unhide", label: "Mostrar todo" },
              { type: "separator" },
              { role: "quit", label: "Salir" },
            ],
          },
        ]
      : []),

    /* ================= Archivo ================= */
    {
      label: "Archivo",
      submenu: [
        {
          label: "Exportar colección…",
          accelerator: "CmdOrCtrl+E",
          click: () => {
            if (!mainWindow) return;
            mainWindow.webContents.send("menu:collectionExport");
          },
        },
        {
          label: "Importar colección…",
          accelerator: "CmdOrCtrl+I",
          click: () => {
            if (!mainWindow) return;
            mainWindow.webContents.send("menu:collectionImport");
          },
        },
        { type: "separator" },
        isMac
          ? { role: "close", label: "Cerrar ventana" }
          : { role: "quit", label: "Salir" },
      ],
    },

    /* ================= Ver ================= */
    {
      label: "Ver",
      submenu: [
        { role: "reload", label: "Recargar" },
        { role: "forceReload", label: "Recargar forzado" },
        { role: "toggleDevTools", label: "Herramientas de desarrollo" },
        { type: "separator" },
        { role: "resetZoom", label: "Restablecer zoom" },
        { role: "zoomIn", label: "Acercar" },
        { role: "zoomOut", label: "Alejar" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Pantalla completa" },
      ],
    },

    /* ================= Ayuda ================= */
    {
      label: "Ayuda",
      submenu: [
        {
          label: "Abrir carpeta de base de datos",
          click: () => {
            if (!mainWindow) return;
            mainWindow.webContents.send("menu:openDbFolder");
          },
        },
        {
          label: "Repositorio en GitHub",
          click: () => {
            shell.openExternal("https://github.com/proyecto/MTGNode");
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
