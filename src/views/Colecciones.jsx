// src/views/Colecciones.jsx
import React, { useEffect, useMemo, useState } from "react";

export default function Colecciones() {
  const [sets, setSets] = useState([]);
  const [selected, setSelected] = useState(""); // código del set (p.ej. 'khm')
  const [meta, setMeta] = useState(null); // { code, name, released_at, count }
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);

  function openDetail(card) {
    console.log("[DETAIL] open", { id: card.id, name: card.name });
    setSelectedCard(card);
  }

  function closeDetail() {
    console.log("[DETAIL] close");
    setSelectedCard(null);
  }

  // 🔎 búsqueda
  const [q, setQ] = useState("");

  // Carga de sets al abrir
  useEffect(() => {
    (async () => {
      const list = await window.api.scrySets();
      setSets(list || []);
      if (list && list.length) setSelected(list[0].code); // preselecciona el más reciente
    })();
  }, []);

  // Carga de info + cartas del set seleccionado
  useEffect(() => {
    if (!selected) return;
    (async () => {
      setLoading(true);
      const info = await window.api.scrySetInfo(selected);
      setMeta(info || null);
      const rows = await window.api.scryCardsBySet(selected);
      setCards(rows || []);
      setLoading(false);
      setQ(""); // limpiar búsqueda al cambiar de colección
    })();
  }, [selected]);

  // Año de publicación
  const year = useMemo(() => {
    if (!meta?.released_at) return "—";
    const d = new Date(meta.released_at);
    return Number.isNaN(d.getTime())
      ? meta.released_at
      : String(d.getFullYear());
  }, [meta]);

  // Normalizador para búsqueda sin tildes
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  }

  // Filtrado en memoria (por nombre o número de colección)
  const filtered = useMemo(() => {
    if (!q) return cards;
    const nq = norm(q);
    return cards.filter(
      (c) =>
        norm(c.name).includes(nq) ||
        String(c.collector_number || "")
          .toLowerCase()
          .includes(nq)
    );
  }, [q, cards]);

  // Acciones
  async function recargarActual() {
    if (!selected) return;
    setLoading(true);
    const info = await window.api.scrySetInfo(selected);
    setMeta(info || null);
    const rows = await window.api.scryCardsBySet(selected);
    setCards(rows || []);
    setLoading(false);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Selector de colección */}
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
        <button onClick={recargarActual} style={btn}>
          Recargar
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

      {/* 🔎 Barra de búsqueda */}
      <div style={searchBar}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o nº (p. ej. 'Lightning' o '123')"
          style={searchInput}
        />
        {q && (
          <button onClick={() => setQ("")} style={clearBtn} title="Limpiar">
            ✕
          </button>
        )}
        <div style={countBadge}>
          {loading ? "Cargando…" : `${filtered.length} de ${cards.length}`}
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
        ) : filtered.length === 0 ? (
          <div style={{ opacity: 0.7, padding: 12 }}>
            Sin resultados para “{q}”.
          </div>
        ) : (
          <ul style={list}>
            {filtered.map((c) => (
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
                      <div
                        style={{
                          fontWeight: 600,
                          cursor: "pointer",
                          color: "#007aff",
                        }}
                        onClick={() => openDetail(c)}
                      >
                        {c.name}
                      </div>
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
                          follow: true,
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
      {/* Overlay Detalle — PASO 2 */}
      {selectedCard && (
        <div
          role="dialog"
          aria-modal="true"
          style={overlay}
          onClick={(e) => {
            // cerrar si se hace clic fuera del panel
            if (e.target === e.currentTarget) closeDetail();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") closeDetail();
          }}
          tabIndex={-1} // para captar teclas
        >
          <div style={panel}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {selectedCard.name}
              </div>
              <button style={btn} onClick={closeDetail}>
                Cerrar
              </button>
            </div>

            {/* Contenido mínimo por ahora */}
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              (DEBUG) ID: {selectedCard.id || "—"} · Nº:{" "}
              {selectedCard.collector_number || "—"} · Rareza:{" "}
              {selectedCard.rarity || "—"}
            </div>

<div style={{ display:'flex', gap:16, marginTop:12 }}>
  {/* Imagen de la carta */}
  {selectedCard.image_normal ? (
    <img
      src={selectedCard.image_normal}
      alt={selectedCard.name}
      style={{
        width: 223,
        height: 310,
        objectFit: 'cover',
        borderRadius: 8,
        border: '1px solid #eee'
      }}
    />
  ) : (
    <div style={{
      width:223, height:310, display:'flex',
      alignItems:'center', justifyContent:'center',
      background:'#fafafa', border:'1px solid #eee', borderRadius:8, color:'#999'
    }}>
      Sin imagen
    </div>
  )}

  {/* Datos de la carta */}
  <div style={{ flex: 1, display:'flex', flexDirection:'column', gap:8 }}>
    <div style={{ fontWeight:700, fontSize:18 }}>{selectedCard.name}</div>
    <div style={{ fontSize:14, opacity:.8 }}>
      {selectedCard.set_name || '—'} · Nº {selectedCard.collector_number || '—'}
    </div>
    <div style={{ fontSize:13 }}>
      <b>Rareza:</b> {selectedCard.rarity || '—'}
    </div>

    <div style={{ fontSize:13 }}>
      <b>Precio:</b>{' '}
      {typeof selectedCard.eur === 'number'
        ? `${selectedCard.eur} €`
        : '—'}{' '}
      {typeof selectedCard.eur_foil === 'number'
        ? `(Foil ${selectedCard.eur_foil} €)`
        : ''}
    </div>

    {selectedCard.type_line && (
      <div style={{ fontSize:13, marginTop:8 }}>
        <b>Tipo:</b> {selectedCard.type_line}
      </div>
    )}

    {selectedCard.oracle_text && (
      <div style={{
        marginTop:8,
        fontSize:13,
        lineHeight:1.5,
        whiteSpace:'pre-wrap',
        background:'#fafafa',
        padding:8,
        borderRadius:8,
        border:'1px solid #eee'
      }}>
        {selectedCard.oracle_text}
      </div>
    )}
  </div>
</div>

          </div>
        </div>
      )}
    </div>
  );
}

// Estilos
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

// 🔎 estilos búsqueda
const searchBar = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto",
  alignItems: "center",
  gap: 8,
};
const searchInput = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #e5e5e5",
  outline: "none",
  background: "#fff",
};
const clearBtn = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #e5e5e5",
  background: "#fff",
  cursor: "pointer",
};
const countBadge = {
  fontSize: 12,
  opacity: 0.75,
  padding: "0 6px",
};

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 16
};

const panel = {
  width: 'min(720px, 95vw)',
  maxHeight: '85vh',
  overflowY: 'auto',
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: 12,
  padding: 16,
  boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
};