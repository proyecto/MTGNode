// src/views/Colecciones.jsx
import React, { useEffect, useMemo, useState } from "react";

/* ========================= Helpers ========================= */

const fmtEUR = (n) =>
  Number(n || 0).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

/** Desenvuelve distintas formas de payload (search/data/array/obj) */
function unwrapDetail(obj) {
  if (!obj) return null;
  const lvl1 = obj?.data ?? obj;
  const lvl2 = lvl1?.data ?? lvl1?.card ?? lvl1;
  if (Array.isArray(lvl2?.data) && lvl2.data.length > 0) return lvl2.data[0];
  if (Array.isArray(lvl2) && lvl2.length > 0) return lvl2[0];
  return lvl2;
}

/** Elige “cara” apropiada para cartas de dos caras (si collector_number coincide, o la 1ª) */
function chooseFace(card) {
  if (!card) return null;
  if (Array.isArray(card.card_faces) && card.card_faces.length) {
    return card.card_faces[0];
  }
  return card;
}

/** Imagen pequeña (para popup) — face primero, luego a nivel de carta */
function pickSmallImage(detailData) {
  const c = unwrapDetail(detailData);
  if (!c) return null;
  const face = chooseFace(c);
  const fi = face?.image_uris;
  if (fi) {
    return (
      fi.normal ||
      fi.large ||
      fi.png ||
      fi.art_crop ||
      fi.border_crop ||
      fi.small ||
      null
    );
  }
  const iu = c.image_uris;
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
  return null;
}

/** Imagen grande (para zoom) */
function pickLargeImage(detailData) {
  const c = unwrapDetail(detailData);
  if (!c) return null;
  const face = chooseFace(c);
  const fi = face?.image_uris;
  if (fi) {
    return fi.large || fi.png || fi.border_crop || fi.art_crop || fi.normal || fi.small || null;
  }
  const iu = c.image_uris;
  if (iu) {
    return iu.large || iu.png || iu.border_crop || iu.art_crop || iu.normal || iu.small || null;
  }
  return null;
}

/** URL a Scryfall de la carta */
function pickScryfallUrl(detailData) {
  const c = unwrapDetail(detailData);
  return c?.scryfall_uri || c?.uri || null;
}

/** Rulings URL (si existe) */
function pickRulingsUrl(detailData) {
  const c = unwrapDetail(detailData);
  return c?.rulings_uri || null;
}

/** Extrae un “view model” rico y homogéneo para pintar el popup */
function extractCardView(detailData) {
  const c = unwrapDetail(detailData);
  if (!c) return null;

  const face = chooseFace(c);

  const name = face?.name || c.name || "—";
  const manaCost = face?.mana_cost || c.mana_cost || "";
  const typeLine = face?.type_line || c.type_line || "";
  const oracleText = face?.oracle_text || c.oracle_text || "";
  const flavorText = face?.flavor_text || c.flavor_text || "";
  const power = face?.power ?? c.power ?? null;
  const toughness = face?.toughness ?? c.toughness ?? null;
  const loyalty = face?.loyalty ?? c.loyalty ?? null;
  const artist = face?.artist || c.artist || "";
  const colors = face?.colors || c.colors || [];
  const colorIdentity = c.color_identity || [];
  const rarity = c.rarity || "";
  const setName = c.set_name || "";
  const setCode = c.set || "";
  const collector = c.collector_number || "";

  const prices = c.prices || {};
  const priceEur = prices.eur ? Number(prices.eur) : null;
  const priceUsd = prices.usd ? Number(prices.usd) : null;
  const priceTix = prices.tix ? Number(prices.tix) : null;

  return {
    name,
    manaCost,
    typeLine,
    oracleText,
    flavorText,
    power,
    toughness,
    loyalty,
    artist,
    colors,
    colorIdentity,
    rarity,
    setName,
    setCode,
    collector,
    priceEur,
    priceUsd,
    priceTix,
    scryfallUrl: pickScryfallUrl(c),
    rulingsUrl: pickRulingsUrl(c),
  };
}

/** Deriva “border color” e “idioma” a partir de la primera carta del set cargado */
function deriveSetExtrasFromRows(rows) {
  if (!rows || rows.length === 0) return { borderColor: "—", lang: "—" };
  const r0 = rows[0] || {};
  return {
    borderColor: r0.border_color ? String(r0.border_color).toUpperCase() : "—",
    lang: r0.lang ? String(r0.lang).toUpperCase() : "—",
  };
}

/** Identificador estable para localizar cartas en la lista actual */
function cardKey(c) {
  return `${c?.scry_id || c?.id || ""}::${c?.name || ""}::${c?.collector_number || ""}`;
}

/* ========================= Vista principal ========================= */

export default function Colecciones() {
  // Selector + info del set
  const [sets, setSets] = useState([]);
  const [sel, setSel] = useState("");
  const [setInfo, setSetInfo] = useState(null);
  const [rows, setRows] = useState([]);

  // Extras derivados del set (borde/idioma)
  const { borderColor, lang } = useMemo(() => deriveSetExtrasFromRows(rows), [rows]);

  // Búsqueda
  const [q, setQ] = useState("");
  const [searchAll, setSearchAll] = useState(false); // ⟵ “todas las ediciones”
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);

  // Estado general
  const [loadingSets, setLoadingSets] = useState(true);
  const [loadingSetCards, setLoadingSetCards] = useState(false);
  const [err, setErr] = useState(null);

  // Popups de detalle e imagen grande
  const [detail, setDetail] = useState(null);         // datos base (name, set_name, scry_id, eur…)
  const [detailData, setDetailData] = useState(null); // detalle enriquecido desde Scryfall
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [imgLargeUrl, setImgLargeUrl] = useState(null); // 2º modal

  // Índice de la carta abierta dentro de la lista visible (listToShow)
  const [detailIndex, setDetailIndex] = useState(-1);

  /* ========== 1) Carga de sets al montar ========== */
  useEffect(() => {
    (async () => {
      try {
        setLoadingSets(true);
        setErr(null);
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

  /* ========== 2) Al seleccionar set: info + cartas ========== */
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

  /* ========== 3) Búsqueda ========== */
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!q.trim()) {
        setSearchRes([]);
        return;
      }

      if (searchAll) {
        // Buscar en todas las ediciones (backend Scryfall/SQLite)
        try {
          setSearching(true);
          const res = await window.api.scrySearchByName(q.trim());
          // Normalizamos a la misma forma que las filas por set
          const items = (Array.isArray(res) ? res : (res?.items || []))
            .map(c => ({
              id: c.id, // scryfall id
              scry_id: c.id,
              name: c.name,
              set_name: c.set_name,
              collector_number: c.collector_number,
              rarity: c.rarity,
              eur: (c.prices && c.prices.eur) ? Number(c.prices.eur) : null,
              // opcionales si luego quieres usarlos:
              border_color: c.border_color,
              lang: c.lang,
            }));
          if (!cancel) setSearchRes(items);
        } catch (e) {
          console.error("[Colecciones] searchAll error:", e);
          if (!cancel) setSearchRes([]);
        } finally {
          if (!cancel) setSearching(false);
        }
      } else {
        // Buscar solo en el set actual (filtro en memoria)
        const s = q.trim().toLowerCase();
        const filtered = rows.filter((c) => (c.name || "").toLowerCase().includes(s));
        setSearchRes(filtered);
      }
    })();
    return () => { cancel = true; };
  }, [q, searchAll, rows]);

  /* ========== 4) Fuente de lista (búsqueda vs set) ========== */
  const listToShow = useMemo(() => {
    if (q.trim()) return searchRes;
    return rows;
  }, [q, searchRes, rows]);

  /* ========== 5) Cargar detalle al abrir popup ========== */
  useEffect(() => {
    if (!detail) {
      setDetailData(null);
      setDetailError(null);
      setDetailLoading(false);
      setImgLargeUrl(null);
      setDetailIndex(-1);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        setDetailLoading(true);
        setDetailError(null);

        let fetched = null;

        // A) por scry_id (o id)
        const idGuess = detail?.scry_id || detail?.id || null;
        if (idGuess && window.api.scryCardDetail) {
          fetched = await window.api.scryCardDetail(idGuess);
          if (!cancelled) {
            if (fetched?.ok) setDetailData(fetched.data);
            else setDetailError(fetched?.error || "Error al cargar");
          }
        }

        // B) por nombre si A no trajo nada usable
        if (!cancelled && (!fetched || fetched?.ok === false) && window.api.scrySearchByName && detail?.name) {
          const results = await window.api.scrySearchByName(detail.name);
          if (!cancelled && Array.isArray(results) && results.length > 0) {
            setDetailData(results);
            fetched = { ok: true, data: results };
          }
        }

        // C) rehidratar si no hay imagen
        if (!cancelled) {
          const hasImg = !!pickSmallImage(fetched?.ok ? fetched.data : fetched);
          if (!hasImg) {
            const cardObj = unwrapDetail(fetched?.ok ? fetched.data : fetched) || {};
            const tryId = cardObj.id || idGuess || null;
            if (tryId && window.api.scryCardDetail) {
              const fresh = await window.api.scryCardDetail(tryId);
              if (!cancelled) {
                if (fresh?.ok) setDetailData(fresh.data);
                else setDetailError(fresh?.error || "Error al cargar");
              }
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[Colecciones] detail error:", e);
          setDetailError(String(e?.message || e));
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [detail]);

  /* ========== 6) Mantener índice coherente al cambiar la lista ========== */
  useEffect(() => {
    if (!detail) return;

    const curKey = cardKey(detail);
    const idx = listToShow.findIndex((c) => cardKey(c) === curKey);
    if (idx === -1) {
      // La carta abierta ya no está en la lista actual (p.ej., cambió set/búsqueda)
      setDetail(null);
      setDetailIndex(-1);
    } else {
      setDetailIndex(idx);
    }
  }, [listToShow, detail]);

  /* ========== 7) Acciones ========== */
  async function handleAddToCollection(card) {
    try {
      const payload = {
        name: card?.name,
        set_name: card?.set_name || setInfo?.name || "",
        rarity: card?.rarity || null,
        eur: (card?.eur != null) ? Number(card.eur) : null,
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
        set_name: card?.set_name || setInfo?.name || "",
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

  // Abrir popup poniendo también el índice actual
  function openDetailFromList(c) {
    const idx = listToShow.findIndex((x) => cardKey(x) === cardKey(c));
    setDetailIndex(idx);
    setDetail({
      name: c.name,
      set_name: c.set_name || setInfo?.name || "",
      scry_id: c.scry_id || c.id || null,
      collector_number: c.collector_number || "",
      rarity: c.rarity || "",
      eur: c.eur ?? null,
    });
  }

  // Navegación Anterior/Siguiente
  function openAt(idx) {
    if (idx < 0 || idx >= listToShow.length) return;
    const c = listToShow[idx];
    openDetailFromList(c);
  }
  function openPrev() { if (detailIndex > 0) openAt(detailIndex - 1); }
  function openNext() { if (detailIndex >= 0 && detailIndex < listToShow.length - 1) openAt(detailIndex + 1); }

  /* ========================= Render ========================= */

  return (
    <div className="colecciones">
      <h1 className="titulo">Colecciones</h1>

      {/* Buscador */}
      <div className="buscador">
        <input
          placeholder="Buscar por nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <label className="switch">
          <input
            type="checkbox"
            checked={searchAll}
            onChange={(e) => setSearchAll(e.target.checked)}
          />
          <span>Buscar en todas las ediciones</span>
        </label>
        <span className="contador">
          {q
            ? (searching ? "buscando…" : `${listToShow.length} resultados`)
            : `${rows.length} cartas en el set`}
        </span>
      </div>

      {/* Selector de set + info */}
      <div className="selector">
        <select value={sel} onChange={(e) => setSel(e.target.value)} className="select">
          <option value="">— Selecciona una edición —</option>
          {sets.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>

        <div className="meta">
          {sel && setInfo ? (
            <>
              <span className="tag">Año: {setInfo?.released_at ? new Date(setInfo.released_at).getFullYear() : "—"}</span>
              <span className="tag">Cartas: {setInfo?.card_count ?? "—"}</span>
              <span className="tag">Borde: {borderColor}</span>
              <span className="tag">Idioma: {lang}</span>
            </>
          ) : (
            <span className="muted">Selecciona una edición para ver sus cartas.</span>
          )}
        </div>
      </div>

      {loadingSets && <div className="estado">Cargando ediciones…</div>}
      {err && <div className="estado error">Error: {err}</div>}
      {!q && sel && loadingSetCards && <div className="estado">Cargando cartas del set…</div>}

      {/* Lista */}
      <div className="lista">
        {q && !searching && listToShow.length === 0 && (
          <div className="sin-resultados">No hay resultados para “{q}”.</div>
        )}

        {listToShow.map((c) => (
          <div key={`${c.id || c.scry_id || c.name}-${c.collector_number || ""}`} className="fila">
            <div className="izq">
              <button className="nombre-btn" onClick={() => openDetailFromList(c)}>
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

      {/* Popup detalle */}
      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {detail.name || "—"}
                {detailIndex >= 0 && (
                  <span className="subindex"> · {detailIndex + 1}/{listToShow.length}</span>
                )}
              </div>
              <div className="modal-header-actions">
                <button className="btn nav" onClick={openPrev} disabled={detailIndex <= 0}>← Anterior</button>
                <button className="btn nav" onClick={openNext} disabled={detailIndex < 0 || detailIndex >= listToShow.length - 1}>Siguiente →</button>
                <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
              </div>
            </div>

            <div className="modal-body">
              {detailLoading && <div className="muted">Cargando detalles…</div>}
              {detailError && <div className="error">Error al cargar detalles: {detailError}</div>}

              {!detailLoading && !detailError && (
                (() => {
                  const view = extractCardView(detailData);
                  const smallImg = pickSmallImage(detailData);
                  const largeImg = pickLargeImage(detailData);
                  return (
                    <>
                      <div className="info-cols">
                        <div className="kv">
                          <div><span className="k">Set</span> <span className="v">{view?.setName || "—"}{view?.setCode ? ` (${view.setCode})` : ""}</span></div>
                          <div><span className="k">Número</span> <span className="v">{view?.collector || "—"}</span></div>
                          <div><span className="k">Rareza</span> <span className="v">{view?.rarity || "—"}</span></div>

                          <div><span className="k">Coste</span> <span className="v mono">{view?.manaCost || "—"}</span></div>
                          <div><span className="k">Tipo</span> <span className="v">{view?.typeLine || "—"}</span></div>

                          {view?.power != null && view?.toughness != null && (
                            <div><span className="k">P/T</span> <span className="v">{view.power}/{view.toughness}</span></div>
                          )}
                          {view?.loyalty != null && (
                            <div><span className="k">Lealtad</span> <span className="v">{view.loyalty}</span></div>
                          )}

                          <div><span className="k">Colores</span> <span className="v">{(view?.colors || []).join(", ") || "—"}</span></div>
                          <div><span className="k">Identidad</span> <span className="v">{(view?.colorIdentity || []).join(", ") || "—"}</span></div>
                          <div><span className="k">Artista</span> <span className="v">{view?.artist || "—"}</span></div>

                          <div className="precios">
                            <span className="k">Precio</span>
                            <span className="v">
                              {view?.priceEur != null ? `EUR ${fmtEUR(view.priceEur).replace("€", "").trim()}` : "—"}
                              {view?.priceUsd != null ? ` · USD ${view.priceUsd.toFixed(2)}` : ""}
                              {view?.priceTix != null ? ` · TIX ${view.priceTix}` : ""}
                            </span>
                          </div>

                          <div className="texto">
                            <span className="k">Texto</span>
                            <span className="v v-block">
                              {view?.oracleText ? view.oracleText.split("\n").map((l, i) => <div key={i}>{l}</div>) : "—"}
                              {view?.flavorText && (
                                <div className="flavor">“{view.flavorText}”</div>
                              )}
                            </span>
                          </div>

                          <div className="links">
                            {view?.scryfallUrl && (
                              <a href={view.scryfallUrl} target="_blank" rel="noreferrer">Ver en Scryfall</a>
                            )}
                            {view?.rulingsUrl && (
                              <a href={view.rulingsUrl} target="_blank" rel="noreferrer">Rulings</a>
                            )}
                          </div>
                        </div>

                        <div className="imgwrap">
                          {smallImg ? (
                            <img
                              src={smallImg}
                              alt={view?.name || detail.name}
                              onClick={() => largeImg && setImgLargeUrl(largeImg)}
                              title={largeImg ? "Click para ver grande" : ""}
                              style={{ cursor: largeImg ? "zoom-in" : "default" }}
                            />
                          ) : (
                            <div className="noimg">Sin imagen</div>
                          )}
                        </div>
                      </div>

                      <div className="modal-actions">
                        <button className="btn" onClick={() => handleAddToCollection(detail)}>Añadir a mi colección</button>
                        <button className="btn" onClick={() => handleFollow(detail, true)}>Seguir</button>
                        <button className="btn" onClick={() => setDetail(null)}>Cerrar</button>
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* Popup imagen grande */}
      {imgLargeUrl && (
        <div className="overlay" onClick={() => setImgLargeUrl(null)}>
          <div className="modal-img" onClick={(e) => e.stopPropagation()}>
            <img src={imgLargeUrl} alt="Carta" />
            <button className="modal-close abs" onClick={() => setImgLargeUrl(null)}>✕</button>
          </div>
        </div>
      )}

      {/* ========================= Estilos (Things-like) ========================= */}
      <style>{`
        .colecciones { padding: 1.2rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .titulo { font-size: 1.125rem; font-weight: 600; color: #1e293b; }

        .buscador { display: flex; gap: 0.6rem; align-items: center; }
        .buscador input { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.5rem 0.75rem; background: #fff; }
        .switch { display: flex; gap: 0.4rem; align-items: center; color: #475569; font-size: 0.85rem; }
        .contador { font-size: 0.8rem; color: #64748b; white-space: nowrap; }

        .selector { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
        .select { border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.5rem 0.75rem; min-width: 260px; background: #fff; }
        .meta { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
        .tag { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; border-radius: 999px; padding: 0.25rem 0.6rem; font-size: 0.75rem; }
        .muted { color: #64748b; font-size: 0.9rem; }

        .lista { background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: auto; max-height: 66vh; }
        .fila { display: flex; justify-content: space-between; gap: 1rem; padding: 0.85rem 1rem; border-bottom: 1px solid #e2e8f0; }
        .fila:last-child { border-bottom: none; }
        .izq { min-width: 0; }
        .nombre-btn { font-weight: 600; color: #2563eb; background: transparent; border: 0; padding: 0; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nombre-btn:hover { text-decoration: underline; }
        .sub { color: #64748b; font-size: 0.8rem; }
        .der { display: flex; gap: 0.75rem; align-items: center; white-space: nowrap; }
        .precio { color: #0f172a; font-weight: 600; }
        .acciones { display: flex; gap: 0.5rem; }
        .btn { border: 1px solid #e2e8f0; background: white; border-radius: 10px; padding: 0.4rem 0.65rem; cursor: pointer; }
        .btn:hover { background: #f8fafc; }
        .estado { padding: 0.5rem; color: #475569; }
        .estado.error { color: #b91c1c; }

        /* Popup detalle */
        .overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.35); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .modal { width: min(920px, 92vw); background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 20px 50px rgba(15,23,42,0.25); overflow: hidden; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; gap: 8px; }
        .modal-title { font-weight: 600; color: #0f172a; }
        .subindex { color: #64748b; font-weight: 400; font-size: .9em; }
        .modal-header-actions { display: flex; gap: 6px; align-items: center; }
        .modal-close { border: 1px solid #e2e8f0; background: white; border-radius: 10px; width: 28px; height: 28px; cursor: pointer; }
        .modal-close:hover { background: #f1f5f9; }
        .btn.nav { padding: 6px 10px; }
        .btn.nav:disabled { opacity: .5; cursor: not-allowed; }

        .modal-body { padding: 14px; display: grid; gap: 12px; }
        .info-cols { display: grid; grid-template-columns: 1.2fr 300px; gap: 14px; align-items: start; }
        .kv { display: grid; gap: 8px; color: #0f172a; font-size: 0.95rem; }
        .k { color: #64748b; width: 100px; display: inline-block; }
        .v { font-weight: 500; }
        .v-block { display: block; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
        .texto .flavor { margin-top: 8px; color: #475569; font-style: italic; }
        .links { display: flex; gap: 10px; margin-top: 6px; }
        .imgwrap { display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; min-height: 300px; }
        .imgwrap img { max-width: 100%; max-height: 460px; border-radius: 10px; }
        .noimg { color: #64748b; font-size: 0.9rem; text-align: center; }
        .modal-actions { display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid #e2e8f0; padding-top: 10px; }

        /* Popup imagen grande */
        .modal-img { position: relative; background: #0b1220; border-radius: 16px; padding: 12px; box-shadow: 0 25px 60px rgba(0,0,0,.45); max-width: 92vw; max-height: 92vh; display: flex; align-items: center; justify-content: center; }
        .modal-img img { max-width: 88vw; max-height: 88vh; border-radius: 10px; }
        .modal-close.abs { position: absolute; top: 8px; right: 8px; background: #fff; }
      `}</style>
    </div>
  );
}
