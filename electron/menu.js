// electron/menu.js
import { app, Menu, shell, BrowserWindow, dialog } from 'electron';

function isMac() {
  return process.platform === 'darwin';
}

function isDev() {
  // app.isPackaged === false cuando estamos en desarrollo
  return !app.isPackaged;
}

/**
 * Instala el menú de la aplicación.
 * Llama a esta función una sola vez tras crear la BrowserWindow.
 * @param {BrowserWindow} win - La ventana principal (para acciones de recarga, zoom, etc.)
 */
export function installAppMenu(win) {
  const template = [
    // (macOS) Menú de la app con "Acerca de", Ocultar, Salir...
    ...(isMac()
      ? [{
          label: app.name,
          submenu: [
            { role: 'about', label: `Acerca de ${app.name}` },
            { type: 'separator' },
            { role: 'services', label: 'Servicios' },
            { type: 'separator' },
            { role: 'hide', label: 'Ocultar' },
            { role: 'hideOthers', label: 'Ocultar otros' },
            { role: 'unhide', label: 'Mostrar todo' },
            { type: 'separator' },
            { role: 'quit', label: 'Salir' }
          ]
        }]
      : []),

    // Archivo
    {
      label: 'Archivo',
      submenu: [
        isMac()
          ? { role: 'close', label: 'Cerrar ventana' }
          : { role: 'quit', label: 'Salir' },
      ]
    },

    // Visualización
    {
      label: 'Visualización',
      submenu: [
        {
          label: 'Recargar',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const focused = BrowserWindow.getFocusedWindow() || win;
            if (focused) focused.reload();
          }
        },
        ...(isDev()
          ? [{
              label: 'Alternar Herramientas de Desarrollador',
              accelerator: isMac() ? 'Alt+Command+I' : 'Ctrl+Shift+I',
              click: () => {
                const focused = BrowserWindow.getFocusedWindow() || win;
                if (focused) focused.webContents.toggleDevTools();
              }
            }]
          : []),
        { type: 'separator' },
        { role: 'resetZoom', label: 'Restablecer zoom' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    },

    // Ayuda
    {
      label: 'Ayuda',
      submenu: [
        {
          label: `Ayuda de ${app.name}`,
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: `Ayuda de ${app.name}`,
              message: `${app.name} — Ayuda rápida`,
              detail:
                `• Barra lateral: navega entre Novedades, Seguidas, Mi colección y Colecciones.\n` +
                `• Colecciones: usa el buscador o la búsqueda global para localizar cartas.\n` +
                `• Detalle: clic en una carta para ver información ampliada, zoom en la imagen, y acciones rápidas.\n\n` +
                `Sugerencia: en “Visualización” puedes recargar la ventana o abrir las herramientas de desarrollador (en modo dev).`,
              buttons: ['Cerrar']
            });
          }
        },
        {
          label: 'Abrir carpeta de datos',
          click: () => {
            const userData = app.getPath('userData');
            // En macOS abre el folder en Finder
            shell.openPath(userData);
          }
        },
        { type: 'separator' },
        {
          label: 'Ver registro de cambios (Novedades)',
          click: () => {
            // Si tienes una ruta/URL específica, ábrela. Aquí abrimos tu sitio o repo si lo prefieres.
            // shell.openExternal('https://tusitio.example.com/novedades');
            dialog.showMessageBox({
              type: 'info',
              title: 'Novedades',
              message: 'Consulta la sección “Novedades” en la barra lateral para ver el backlog de cambios.',
              buttons: ['Entendido']
            });
          }
        }
      ]
    }
  ];

  // (Windows/Linux) añade menú de ventana estándar
  if (!isMac()) {
    template.splice(1, 0, {
      label: 'Ventana',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'zoom', label: 'Zoom' },
        { type: 'separator' },
        { role: 'close', label: 'Cerrar' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
