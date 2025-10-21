import * as Card from '../models/CardModel.js';

export const CardsController = {
  async seedDemo() { try { return Card.seedDemo(); } catch (e) { return { ok:false, error:e.message }; } },
  async list() { try { return Card.listCards(); } catch (e) { return []; } },
  async add(payload) { try { return Card.addCard(payload); } catch (e) { return { ok:false, error:e.message }; } },
  async toggleFollow(cardId) { try { return Card.toggleFollow(cardId); } catch (e) { return { ok:false, error:e.message }; } },
  async debug() { try { return Card.debugInfo(); } catch (e) { return { ok:false, error:e.message }; } },
  async ensureFromScry(payload) { try { return Card.ensureFromScry(payload); } catch (e) { return { ok:false, error:e.message }; } },
  async followFromScry(payload, value = true) {
    try {
      const ensured = Card.ensureFromScry(payload);
      if (!ensured.ok) return ensured;
      return Card.setFollow(ensured.id, !!value);
    } catch (e) {
      return { ok:false, error:e.message };
    }
  }
};
