// src/views/Colecciones.jsx
import React, { useEffect, useMemo, useState } from "react";

// ---- Helpers ----
const fmtEUR = (n) =>
  Number(n || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

function unwrapDetail(obj) {
  if (!obj) return null;
  const lvl1 = obj?.data ?? obj;
  const lvl2 = lvl1?.data ?? lvl1?.card ?? lvl1;
  if (Array.isArray(lvl2?.data) && lvl2.data.length > 0) return lvl2.data[0];
  if (Array.isArray(lvl2) && lvl2.length > 0) return lvl2[0];
  return lvl2;
}

function pickImage(detailData) {
  const d = unwrapDetail(detailData);
  if (!d) return null;

  const iu = d.image_uris || null;
  if (iu) {
    return (
      iu.normal ||
      iu.large ||
      iu.png ||
      iu.art_crop ||
      iu.border_crop ||
      iu.small ||
      null
    );
  }

  if (Array.isArray(d.card_faces) && d.card_faces.length) {
    for (const f of d.card_faces) {
      const fi = f?.image_uris || null;
      if (!fi) continue;
      const url =
        fi.normal ||
        fi.large ||
        fi.png ||
        fi.art_crop ||
        fi.border_crop ||
        fi.small ||
        null;
      if (url) return url;
    }
  }

  return null;
}

function pickScryfallUrl(detailData) {
  const d = unwrapDetail(detailData);
  if (!d) return null;
  return d.scryfall_uri || d.uri || null;
}

// ---- Componente principal ----
export default function Colecciones() {
  const [sets, setSets] = useState([]);
  const [sel, setSel] = useState("");
  const [setInfo, setSetInfo] = useState(null);
  const [rows, setRows] = useState([]);

  const [q, setQ] = useState("");
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);

  const [detail, setDetail] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [loadingSets, setLoadingSets] = useState(true);
  const [loadingSetCards, setLoadingSetCards] = useState(false);
  const [err, setErr] = useState(null);

  // --- 1) Cargar listado de sets ---
  useEffect(() => {
    (async () => {
      try {
        setLoadingSets(true);
        const list = await window.api.scrySets();
        setSets(Array.isArray(list) ? list : (list?.items || []));
      } catch (e) {
        console.error("[Colecciones] scrySets error:", e);
        setErr("No se pudieron cargar las colecciones.");
      } finally {
        setLoadingSets(false);
      }
    })();
  }, []);

  // --- 2) Cargar info + cartas de un set ---
  useEffect(() => {
    if (!sel) {
      setSetInfo(null);
      setRows([]);
      return;
    }
    (async () => {
      try {
        setLoadingSetCards(true);
        setErr(null);
        const info = await window.api.scrySetInfo(sel);
        setSetInfo(info || null);
        const list = await window.api.scryCardsBySet(sel);
        setRows(Array.isArray(list) ? list : (list?.items || []));
      } catch (e) {
        console.error("[Colecciones] set load error:", e);
        setErr("No se pudieron cargar las cartas del set.");
      } finally {
        setLoadingSetCards(false);
      }
    })();
  }, [sel]);

  // --- 3) Búsqueda global ---
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!q.trim()) {
        setSearchRes([]);
        return;
      }
      try {
        setSearching(true);
        const res = await window.api.scrySearchByName(q.trim());
        if (!cancel) setSearchRes(Array.isArray(res) ? res : (res?.items || []));
      } catch (e) {
        console.error("[Colecciones] search error:", e);
        if (!cancel) setSearchRes([]);
      } finally {
        if (!cancel) setSearching(false);
      }
    })();
    return () => { cancel = true; };
  }, [q]);

  // --- 4) Detalle popup con fallback + rehidratado ---
  useEffect(() => {
    if (!detail) {
      setDetailData(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        setDetailLoading(true);
        setDetailError(null);
        let fetched = null;

        // 1) scry_id directo
        if (detail?.scry_id && window.api.scryCardDetail) {
          fetched = await window.api.scryCardDetail(detail.scry_id);
          if (!cancelled) setDetailData({ source: "scry_id", data: fetched });
        }

        // 2) local por nombre + set
        if (!fetched && window.api.scryFindByNameSet && detail?.name && detail?.set_name) {
          const local = await window.api.scryFindByNameSet(detail.name, detail.set_name);
          if (!cancelled && local?.ok) setDetailData({ source: "local-set", data: local });
          fetched = local;
        }

        // 3) búsqueda por nombre
        if (!fetched && window.api.scrySearchByName && detail?.name) {
          const results = await window.api.scrySearchByName(detail.name);
          if (!cancelled && Array.isArray(results) && results.length > 0) {
            setDetailData({ source: "search", data: results });
            fetched = results;
          }
        }

        // --- Retry si no hay imagen ---
        if (!cancelled) {
          const imgNow = pickImage(fetched);
          if (!imgNow) {
            const cardObj = unwrapDetail(fetched) || {};
            const tryId = cardObj.id || detail.scry_id || null;
            if (tryId && window.api.scryCardDetail) {
              const fresh = await window.api.scryCardDetail(tryId);
              if (!cancelled) setDetailData({ source: "refresh", data: fresh });
            }
          }
        }
      } catch (e) {
        if (!cancelled) setDetailError(String(e?.message || e));
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [detail]);

  // --- 5) Lista a mostrar ---
  const listToShow = useMemo(() => {
    if (q.trim()) return searchRes;
    return rows;
  }, [q, rows, searchRes]);

  // --- Acciones ---
  async function handleAddToCollection(card) {
    try {
      const payload = {
        name: card?.name,
        set_name: card?.set_name || setInfo?.name,
        rarity: card?.rarity || null,
        eur: Number(card?.eur || 0) || null,
        qty: 1,
      };
      const res = await window.api.scryAddToCollection(payload);
      if (res?.ok === false) alert("No se pudo añadir: " + (res?.error || "desconocido"));
    } catch (e) {
      alert("Error añadiendo: " + (e?.message || e));
    }
  }

  async function handleFollow(card, value = true) {
    try {
      const payload = {
        name: card?.name,
        set_name: card?.set_name || setInfo?.name,
        rarity: card?.rarity || null,
        eur: Number(card?.eur || 0) || null,
        follow: !!value,
      };
      const res = await window.api.scryFollow(payload);
      if (res?.ok === false) alert("No se pudo actualizar seguimiento: " + (res?.error || "desconocido"));
    } catch (e) {
      alert("Error en seguimiento: " + (e?.message || e));
    }
  }

  // --- Render ---
  return (
    <div className="colecciones">
      <h1 className="titulo">Colecciones</h1>

      {/* Selector de colección */}
      <div className="selector">
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="select">
          <option value="">— Selecciona una colección —</option>
          {sets.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>

        <div className="meta">
          {sel && setInfo ? (
            <>
              <span className="tag">
                Año: {setInfo?.released_at ? new Date(setInfo.released_at).getFullYear() : "—"}
              </span>
              <span className="tag">Cartas: {setInfo?.card_count ?? "—"}</span>
            </>
          ) : (
            <span className="muted">Selecciona un set para ver sus cartas.</span>
          )}
        </div>
      </div>

      {/* Buscador global */}
      <div className="buscador">
        <input
          placeholder="Buscar en todas las colecciones por nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q ? (
          <span className="contador">
            {searching ? "buscando…" : `${listToShow.length} resultados`}
          </span>
        ) : (
          <span className="contador">{rows.length} cartas en el set</span>
        )}
      </div>

      {loadingSets && <div className="estado">Cargando colecciones…</div>}
      {err && <div className="estado error">Error: {err}</div>}

      {/* Lista */}
      {!err && (
        <div className="lista">
          {q && !searching && listToShow.length === 0 && (
            <div className="sin-resultados">No hay resultados para “{q}”.</div>
          )}
          {!q && sel && loadingSetCards && (
            <div className="estado">Cargando cartas del set…</div>
          )}

          {listToShow.map((c) => (
            <div key={`${c.id || c.scry_id || c.name}-${c.collector_number || ""}`} className="fila">
              <div className="izq">
                <button
                  className="nombre-btn"
                  onClick={() => {
                    setDetail({
                      name: c.name,
                      set_name: c.set_name || setInfo?.name || "",
                      scry_id: c.scry_id || c.id || null,
                      collector_number: c.collector_number || "",
                      rarity: c.rarity || "",
                      eur: c.eur ?? null,
                    });
                  }}
                >
                  {c.name}
                </button>
                <div className="sub">
                  #{c.collector_number || "—"} · {c.set_name || setInfo?.name || "—"} · {c.rarity || "—"}
                </div>
              </div>

              <div className="der">
                <div className="precio">{c.eur != null ? fmtEUR(c.eur) : "—"}</div>
                <div className="acciones">
                  <button className="btn" onClick={() => handleAddToCollection(c)}>Añadir a colección</button>
                  <button className="btn" onClick={() => handleFollow(c, true)}>Seguir</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Popup */}
      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{detail.name || "—"}</div>
              <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
            </div>

            <div className="modal-body">
              {detailLoading && <div className="muted">Cargando detalles…</div>}
              {detailError && <div className="error">Error al cargar detalles: {detailError}</div>}

              {!detailLoading && !detailError && (
                <>
                  <div className="info-cols">
                    <div className="kv">
                      <div><span className="k">Set</span> <span className="v">{detail.set_name || "—"}</span></div>
                      <div><span className="k">Número</span> <span className="v">{detail.collector_number || "—"}</span></div>
                      <div><span className="k">Rareza</span> <span className="v">{detail.rarity || "—"}</span></div>
                      <div><span className="k">Precio</span> <span className="v">{detail.eur != null ? fmtEUR(detail.eur) : "—"}</span></div>
                    </div>
                    <div className="imgwrap">
                      {pickImage(detailData) ? (
                        <img src={pickImage(detailData)} alt={detail.name} />
                      ) : (
                        <div className="noimg">
                          Sin imagen
                          {pickScryfallUrl(detailData) && (
                            <div style={{ marginTop: 6 }}>
                              <a href={pickScryfallUrl(detailData)} target="_blank" rel="noreferrer">
                                Ver en Scryfall
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button className="btn" onClick={() => handleAddToCollection(detail)}>Añadir a mi colección</button>
                    <button className="btn" onClick={() => handleFollow(detail, true)}>Seguir</button>
                    <button className="btn" onClick={() => setDetail(null)}>Cerrar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Estilos locales */}
      <style jsx>{`
        .colecciones {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .titulo {
          font-size: 1.125rem;
          font-weight: 600;
          color: #1e293b;
        }

        .selector {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .select {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 0.45rem 0.6rem;
          min-width: 260px;
          background: #fff;
        }
        .meta {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
        }
        .tag {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          padding: 0.25rem 0.6rem;
          font-size: 0.75rem;
        }
        .muted {
          color: #64748b;
          font-size: 0.9rem;
        }

        .buscador {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .buscador input {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 0.45rem 0.6rem;
          background: #fff;
        }
        .contador {
          font-size: 0.8rem;
          color: #64748b;
          white-space: nowrap;
        }

        .lista {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: auto;
          max-height: 66vh;
        }
        .fila {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.8rem 1rem;
          border-bottom: 1px solid #e2e8f0;
        }
        .fila:last-child {
          border-bottom: 0;
        }
        .izq {
          min-width: 0;
        }
        .nombre-btn {
          font-weight: 600;
          color: #2563eb;
          background: transparent;
          border: 0;
          padding: 0;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .nombre-btn:hover {
          text-decoration: underline;
        }
        .sub {
          color: #64748b;
          font-size: 0.8rem;
        }

        .der {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          white-space: nowrap;
        }
        .precio {
          color: #0f172a;
          font-weight: 600;
        }
        .acciones {
          display: flex;
          gap: 0.5rem;
        }
        .btn {
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          padding: 0.35rem 0.6rem;
          cursor: pointer;
        }
        .btn:hover {
          background: #f8fafc;
        }

        /* Popup */
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
        }
        .modal {
          width: min(820px, 92vw);
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .modal-title {
          font-weight: 600;
          color: #0f172a;
        }
        .modal-close {
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          width: 28px;
          height: 28px;
          cursor: pointer;
        }
        .modal-close:hover {
          background: #f1f5f9;
        }
        .modal-body {
          padding: 14px;
          display: grid;
          gap: 10px;
        }

        .info-cols {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 12px;
          align-items: start;
        }
        .kv {
          display: grid;
          gap: 6px;
          color: #0f172a;
        }
        .k {
          color: #64748b;
          width: 90px;
          display: inline-block;
        }
        .v {
          font-weight: 500;
        }

        .imgwrap {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 8px;
          min-height: 260px;
        }
        .imgwrap img {
          max-width: 100%;
          max-height: 360px;
          border-radius: 8px;
        }
        .noimg {
          color: #64748b;
          font-size: 0.9rem;
          text-align: center;
        }

        .modal-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          border-top: 1px solid #e2e8f0;
          padding-top: 10px;
        }
      `}</style>
    </div>
  );
}
