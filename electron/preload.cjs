const { contextBridge, ipcRenderer } = require("electron");

try {
  console.log("[PRELOAD] cargado (CJS)");
  const api = {
    // cards
    seedDemo: () => ipcRenderer.invoke("db:seed"),
    listCards: () => ipcRenderer.invoke("db:list"),
    addCard: (payload) => ipcRenderer.invoke("db:add", payload),
    toggleFollow: (cardId) => ipcRenderer.invoke("cards:toggleFollow", cardId),
    // collection
    collectionList: () => ipcRenderer.invoke("collection:list"),
    addToCollection: (cardId, qty = 1) =>
      ipcRenderer.invoke("collection:add", { cardId, qty }),
    collectionUpdateQty: (cardId, qty) =>
      ipcRenderer.invoke("collection:updateQty", { cardId, qty }),
    collectionRemove: (cardId) =>
      ipcRenderer.invoke("collection:remove", { cardId }),
    collectionImportCSV: () => ipcRenderer.invoke("collection:importCSV"),
    collectionExportCSV: () => ipcRenderer.invoke("collection:exportCSV"),

    // news
    newsList: (opts) => ipcRenderer.invoke("news:list", opts),

    // Scry
    scrySets: () => ipcRenderer.invoke("scry:sets"),
    scrySetInfo: (code) => ipcRenderer.invoke("scry:setInfo", code),
    scryCardsBySet: (code) => ipcRenderer.invoke("scry:cardsBySet", code),
    scryUpdateBulk: () => ipcRenderer.invoke("scry:updateBulk"),
    // desde scry_cards -> actions
    scryAddToCollection: (payload) =>
      ipcRenderer.invoke("scry:addToCollection", payload),
    scryFollow: (payload) => ipcRenderer.invoke("scry:follow", payload),

    // utils
    debug: () => ipcRenderer.invoke("db:debug"),
    openDbFolder: () => ipcRenderer.invoke("db:openFolder"),
  };
  contextBridge.exposeInMainWorld("api", api);
  console.log("[PRELOAD] api expuesta (CJS):", Object.keys(api));
} catch (e) {
  console.error("[PRELOAD] error:", e);
}
