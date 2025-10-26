// electron/controllers/NewsController.js
import fetch from "node-fetch";

// cache sencillo para no quemar el rate-limit
let lastAt = 0;
let lastData = null;
const TTL_MS = 60 * 1000; // 1 minuto

export const NewsController = {
  async list({ repo = "proyecto/MTGNode", per_page = 10 } = {}) {
    const now = Date.now();
    if (lastData && now - lastAt < TTL_MS) return lastData;

    const q = encodeURIComponent(`repo:${repo} is:issue state:open`);
    const url = `https://api.github.com/search/issues?q=${q}&sort=updated&order=desc&per_page=${per_page}`;

    const headers = { Accept: "application/vnd.github+json" };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `GitHub ${res.status}: ${text || res.statusText}`,
      };
    }
    const json = await res.json();

    // Normaliza lo que necesita tu UI
    const items = (json.items || []).map((it) => ({
      id: it.id,
      number: it.number,
      title: it.title,
      url: it.html_url,
      body: it.body || '',
      state: it.state,
      updated_at: it.updated_at,
      created_at: it.created_at,
      user: it.user?.login,
      labels: (it.labels || [])
        .map((l) => (typeof l === "string" ? l : l.name))
        .filter(Boolean),
    }));

    const payload = {
      ok: true,
      total: json.total_count ?? items.length,
      items,
    };
    lastAt = now;
    lastData = payload;
    return payload;
  },
};
