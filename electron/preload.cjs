// electron/preload.cjs
const { contextBridge, ipcRenderer } = require("electron");

try {
  // Helper: invocación con manejo de errores uniforme
  async function safeInvoke(channel, payload) {
    try {
      const res = await ipcRenderer.invoke(channel, payload);
      if (res && res.ok === false && res.error) {
        console.warn("[IPC FAIL]", channel, res.error);
      }
      return res;
    } catch (e) {
      console.error("[IPC EXCEPTION]", channel, e);
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
    collectionUpdatePaid: (payload) =>
      ipcRenderer.invoke("collection:updatePaid", payload),

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
} catch (e) {
  console.error("[PRELOAD] error:", e);
}
