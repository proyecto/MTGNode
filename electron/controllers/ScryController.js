import * as Scry from '../models/ScryModel.js';

export const ScryController = {
  async sets() {
    try { return Scry.listSets(); }
    catch (e) { console.error('[ScryController.sets]', e); return []; }
  },
  async setInfo(code) {
    try { return Scry.setInfo(code); }
    catch (e) { return { error: e.message }; }
  },
  async cardsBySet(code) {
    try { return Scry.cardsBySet(code); }
    catch (e) { console.error('[ScryController.cardsBySet]', e); return []; }
  }
};
