import React, { useEffect, useMemo, useState } from "react";

export default function Colecciones() {
  const [sets, setSets] = useState([]);
  const [selected, setSelected] = useState(""); // set code
  const [meta, setMeta] = useState(null); // { code, name, released_at, count }
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);

  // Carga sets al abrir
  useEffect(() => {
    (async () => {
      const list = await window.api.scrySets();
      setSets(list || []);
      if (list && list.length) {
        setSelected(list[0].code); // preselecciona el más reciente
      }
    })();
  }, []);

  // Cuando cambie el set, carga su info y sus cartas
  useEffect(() => {
    if (!selected) return;
    (async () => {
      setLoading(true);
      const info = await window.api.scrySetInfo(selected);
      setMeta(info || null);
      const rows = await window.api.scryCardsBySet(selected);
      setCards(rows || []);
      setLoading(false);
    })();
  }, [selected]);

  const year = useMemo(() => {
    if (!meta?.released_at) return "—";
    const d = new Date(meta.released_at);
    return Number.isNaN(d.getTime())
      ? meta.released_at
      : String(d.getFullYear());
  }, [meta]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <label style={{ fontSize: 14, opacity: 0.8 }}>Colección</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={select}
        >
          {sets.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code.toUpperCase()})
            </option>
          ))}
        </select>
        <button onClick={() => selected && setSelected(selected)} style={btn}>
          Recargar
        </button>
        <button
          onClick={async () => {
            const res = await window.api.scryUpdateBulk();
            // tras actualizar, recarga selector y cartas actuales
            const list = await window.api.scrySets();
            setSets(list || []);
            if (selected) {
              const info = await window.api.scrySetInfo(selected);
              setMeta(info || null);
              const rows = await window.api.scryCardsBySet(selected);
              setCards(rows || []);
            }
          }}
          style={btn}
        >
          Actualizar base
        </button>
      </div>

      {/* Meta del set */}
      <div style={metaBox}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>
          {meta?.name || "—"}{" "}
          <span style={{ opacity: 0.6 }}>
            ({meta?.code?.toUpperCase() || "—"})
          </span>
        </div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          Año de publicación: <b>{year}</b> · Número de cartas:{" "}
          <b>{meta?.count ?? 0}</b>
        </div>
      </div>

      {/* Lista scrolleable */}
      <div style={listWrap}>
        {loading ? (
          <div style={{ opacity: 0.7, padding: 12 }}>Cargando cartas…</div>
        ) : !cards.length ? (
          <div style={{ opacity: 0.7, padding: 12 }}>
            No hay cartas en este set.
          </div>
        ) : (
          <ul style={list}>
            {cards.map((c) => (
              <li key={c.id} style={row}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={numberBadge}>{c.collector_number || "—"}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        {c.rarity || "—"}
                        {typeof c.eur === "number" ? ` · ${c.eur} €` : ""}
                        {typeof c.eur_foil === "number"
                          ? ` · foil ${c.eur_foil} €`
                          : ""}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={async () => {
                        await window.api.scryAddToCollection({
                          name: c.name,
                          set_name: meta?.name || "",
                          rarity: c.rarity,
                          eur: c.eur,
                          qty: 1,
                        });
                      }}
                      style={btn}
                      title="Añadir a Mi colección"
                    >
                      📦 Añadir
                    </button>

                    <button
                      onClick={async () => {
                        await window.api.scryFollow({
                          name: c.name,
                          set_name: meta?.name || "",
                          rarity: c.rarity,
                          eur: c.eur,
                          follow: true, // si quieres un toggle real, podemos consultar el estado primero
                        });
                      }}
                      style={btn}
                      title="Seguir"
                    >
                      ⭐ Seguir
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const select = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #e5e5e5",
  background: "#fff",
  minWidth: 260,
};
const btn = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #e5e5e5",
  background: "#f5f5f7",
  cursor: "pointer",
};
const metaBox = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 12,
};
const listWrap = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 12,
  height: "60vh",
  overflowY: "auto",
};
const list = { listStyle: "none", padding: 0, margin: 0 };
const row = { padding: "10px 12px", borderBottom: "1px solid #f0f0f0" };
const numberBadge = {
  minWidth: 44,
  textAlign: "center",
  border: "1px solid #eee",
  borderRadius: 8,
  padding: "6px 8px",
  background: "#fafafa",
};
