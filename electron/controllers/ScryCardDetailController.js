// electron/controllers/ScryCardDetailController.js
import fetch from 'node-fetch';

export const ScryCardDetailController = {
  async fetchCardDetails(idOrName) {
    console.log('[SCRYDETAIL] Fetching details for', idOrName);
    try {
      // Si parece un UUID de Scryfall (36 chars), pedimos por id. Si no, por nombre exacto.
      const url =
        typeof idOrName === 'string' && idOrName.length === 36
          ? `https://api.scryfall.com/cards/${idOrName}`
          : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(idOrName)}`;

      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `Scryfall ${res.status}: ${text || res.statusText}` };
      }
      const data = await res.json();
      return { ok: true, data };
    } catch (e) {
      console.error('[SCRYDETAIL] Error', e);
      return { ok: false, error: e.message };
    }
  },

  async searchByName(query) {
    console.log('[SCRYDETAIL] Searching', query);
    try {
      const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `Scryfall ${res.status}: ${text || res.statusText}` };
      }
      const json = await res.json();
      // Devolvemos solo la primera página (json.data)
      return { ok: true, data: Array.isArray(json.data) ? json.data : [] };
    } catch (e) {
      console.error('[SCRYDETAIL] Search error', e);
      return { ok: false, error: e.message };
    }
  }
};
