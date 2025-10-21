import * as Collection from '../models/CollectionModel.js';
import * as Card from '../models/CardModel.js';

export const CollectionController = {
  async list() { try { return Collection.listCollection(); } catch (e) { return []; } },
  async add(cardId, qty = 1) { try { return Collection.addToCollection(cardId, qty); } catch (e) { return { ok:false, error:e.message }; } },
  async updateQty(cardId, qty) { try { return Collection.updateQuantity(cardId, qty); } catch (e) { return { ok:false, error:e.message }; } },
  async remove(cardId) { try { return Collection.removeFromCollection(cardId); } catch (e) { return { ok:false, error:e.message }; } },

  // 👇 NUEVO: desde Scry
  async addFromScry(payload, qty = 1) {
    try {
      const ensured = Card.ensureFromScry(payload);
      if (!ensured.ok) return ensured;
      return Collection.addToCollection(ensured.id, qty);
    } catch (e) {
      return { ok:false, error:e.message };
    }
  }
};
