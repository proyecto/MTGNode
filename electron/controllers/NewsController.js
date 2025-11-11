// electron/controllers/NewsController.js
import fetch from 'node-fetch';

// Usa el buscador de issues de GitHub, devolviendo título + body ordenado por update
export const NewsController = {
  /**
   * @param {Object} opts
   * @param {string} opts.repo  - "owner/name" (p.ej. "proyecto/MTGNode")
   * @param {number} [opts.per_page=10]
   * @param {string} [opts.state="open"] - "open|closed"
   */
  async list(opts = {}) {
    const repo = opts.repo || 'proyecto/MTGNode';   // <-- cámbialo si tu repo real es otro
    const per_page = opts.per_page ?? 10;
    const state = opts.state || 'open';

    const q = `repo:${repo} is:issue state:${state}`;
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${per_page}`;

    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github+json',
          // Si tienes token para aumentar rate-limit:
          // 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`
        }
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { ok: false, error: `GitHub ${res.status}: ${text || res.statusText}` };
      }
      const json = await res.json();
      const items = (json.items || []).map(it => ({
        id: it.id,
        number: it.number,
        title: it.title,
        body: it.body || '',          // <- body incluido (lo querías visible)
        updated_at: it.updated_at,
        state: it.state,
        html_url: it.html_url,
        user: it.user?.login ?? null,
        labels: (it.labels || []).map(l => typeof l === 'string' ? l : l.name),
      }));
      return { ok: true, items };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
};
