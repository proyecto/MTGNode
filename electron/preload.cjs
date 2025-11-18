// electron/preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

try {
  // Helper: invocación con manejo de errores uniforme
  async function safeInvoke(channel, payload) {
    try {
      const res = await ipcRenderer.invoke(channel, payload);
      if (res && res.ok === false && res.error) {
      }
      return res;
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  }

  const api = {
    // --- Cards ---
    seedDemo: () => ipcRenderer.invoke("db:seed"),
    listCards: () => ipcRenderer.invoke("db:list"),
    addCard: (payload) => ipcRenderer.invoke("db:add", payload),
    toggleFollow: (cardId) => ipcRenderer.invoke("cards:toggleFollow", cardId),

    // --- Collection ---
    // Versiones "save" (con safeInvoke) para devolver {ok:false,error} en vez de throw
    collectionList: () => safeInvoke("collection:list"),
    collectionListDetailed: () => safeInvoke("collection:listDetailed"),
    collectionStats: () => safeInvoke("collection:stats"),
    collectionDiag: () => safeInvoke("collection:diag"),
    collectionRepairMeta: () => safeInvoke("collection:repairMeta"),
    collectionUpdateCondition: (payload) =>
      ipcRenderer.invoke("collection:updateCondition", payload),

    addToCollection: (cardId, qty = 1) =>
      ipcRenderer.invoke("collection:add", { cardId, qty }),
    collectionUpdateQty: (cardId, qty) =>
      ipcRenderer.invoke("collection:updateQty", { cardId, qty }),

    // ✅ CORREGIDO: usar safeInvoke / ipcRenderer.invoke (NO 'invoke' suelto)
    collectionRemove: (payload) => safeInvoke("collection:remove", payload),

    collectionImportCSV: () => ipcRenderer.invoke("collection:importCSV"),
    collectionExportCSV: () => ipcRenderer.invoke("collection:exportCSV"),
    collectionUpdatePaid: (payload) => ipcRenderer.invoke("collection:updatePaid", payload),
    collectionImportCSV: () => ipcRenderer.invoke("collection:importCSV"),
    collectionExportCSV: () => ipcRenderer.invoke("collection:exportCSV"),


    collectionUpdateFields: (payload) =>
      ipcRenderer.invoke("collection:updateFields", payload),

    // --- News ---
    newsList: (opts) => ipcRenderer.invoke("news:list", opts),

    // --- Scry (sets y cards) ---
    scrySets: () => ipcRenderer.invoke("scry:sets"),
    scrySetInfo: (code) => ipcRenderer.invoke("scry:setInfo", code),
    scryCardsBySet: (code) => ipcRenderer.invoke("scry:cardsBySet", code),
    scryUpdateBulk: () => ipcRenderer.invoke("scry:updateBulk"),

    // Acepta string (nombre) o objeto { q: 'name', ... }
    scrySearchByName: (query) => ipcRenderer.invoke("scry:searchByName", query),


    // Detalle por id (o, si tu main lo soporta, también por nombre)
    scryCardDetail: (idOrName) => ipcRenderer.invoke("scry:cardDetail", idOrName),


    // --- Acciones desde scry_cards ---
    scryAddToCollection: (payload) =>
      ipcRenderer.invoke("scry:addToCollection", payload),
    scryFollow: (payload) => ipcRenderer.invoke("scry:follow", payload),

    // --- Utils ---
    debug: () => ipcRenderer.invoke("db:debug"),
    openDbFolder: () => ipcRenderer.invoke("db:openFolder"),
  };

  contextBridge.exposeInMainWorld("api", api);
  console.log("[] api expuesta (CJS):", Object.keys(api));

  // === Eventos de menú ===
  ipcRenderer.on("menu:collectionExport", () => {
    console.log("[MENU] Exportar colección");
    api.collectionExportCSV();
  });

  ipcRenderer.on("menu:collectionImport", () => {
    console.log("[MENU] Importar colección");
    api.collectionImportCSV();
  });

  ipcRenderer.on("menu:openDbFolder", () => {
    console.log("[MENU] Abrir carpeta DB");
    api.openDbFolder && api.openDbFolder();
  });

} catch (e) {
  console.error("[PRELOAD] error:", e);
}
