// electron/controllers/ScryCardDetailController.js
import fetch from 'node-fetch';

export const ScryCardDetailController = {
  async fetchCardDetails(idOrName) {
    console.log('[SCRYDETAIL] Fetching details for', idOrName);
    try {
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
  }
};
