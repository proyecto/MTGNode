// src/views/MiColeccion.jsx
import React, { useEffect, useMemo, useState } from "react";

/* ========================= Utils y helpers ========================= */

// Intenta escoger la edición correcta entre varios resultados con el mismo nombre
function pickBestMatchBySetAndNumber(results, detail) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const setName = (detail?.set_name || "").toLowerCase();
  const cn = String(detail?.collector_number || "").toLowerCase();

  // 1) Match por set_name + collector_number (si lo tenemos)
  if (setName && cn) {
    const exact = results.find(r =>
      (r.set_name || "").toLowerCase() === setName &&
      String(r.collector_number || "").toLowerCase() === cn
    );
    if (exact) return exact;
  }

  // 2) Match por set_name
  if (setName) {
    const bySet = results.find(r =>
      (r.set_name || "").toLowerCase() === setName
    );
    if (bySet) return bySet;
  }

  // 3) Último recurso: el primero
  return results[0];
}

const fmtEUR = (n, sign = false) => {
  const v = Number(n || 0);
  const s = v.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
  return sign && v > 0 ? `+${s}` : s;
};

// --- helpers de detalle (mismos que en Colecciones) ---
function unwrapDetail(obj) {
  if (!obj) return null;
  const lvl1 = obj?.data ?? obj;
  const lvl2 = lvl1?.data ?? lvl1?.card ?? lvl1;
  if (Array.isArray(lvl2?.data) && lvl2.data.length > 0) return lvl2.data[0];
  if (Array.isArray(lvl2) && lvl2.length > 0) return lvl2[0];
  return lvl2;
}
function chooseFace(card) {
  if (!card) return null;
  if (Array.isArray(card.card_faces) && card.card_faces.length) return card.card_faces[0];
  return card;
}
function pickSmallImage(detailData) {
  const c = unwrapDetail(detailData);
  if (!c) return null;
  const face = chooseFace(c);
  const fi = face?.image_uris;
  if (fi) return fi.normal || fi.large || fi.png || fi.art_crop || fi.border_crop || fi.small || null;
  const iu = c.image_uris;
  if (iu) return iu.normal || iu.large || iu.png || iu.art_crop || iu.border_crop || iu.small || null;
  return null;
}
function pickLargeImage(detailData) {
  const c = unwrapDetail(detailData);
  if (!c) return null;
  const face = chooseFace(c);
  const fi = face?.image_uris;
  if (fi) return fi.large || fi.png || fi.border_crop || fi.art_crop || fi.normal || fi.small || null;
  const iu = c.image_uris;
  if (iu) return iu.large || iu.png || iu.border_crop || iu.art_crop || iu.normal || iu.small || null;
  return null;
}
function pickScryfallUrl(detailData) {
  const c = unwrapDetail(detailData);
  return c?.scryfall_uri || c?.uri || null;
}
function pickRulingsUrl(detailData) {
  const c = unwrapDetail(detailData);
  return c?.rulings_uri || null;
}
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
    name, manaCost, typeLine, oracleText, flavorText,
    power, toughness, loyalty, artist, colors, colorIdentity,
    rarity, setName, setCode, collector,
    priceEur, priceUsd, priceTix,
    scryfallUrl: pickScryfallUrl(c),
    rulingsUrl: pickRulingsUrl(c),
  };
}

/* ========================= Vista ========================= */

export default function MiColeccion() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0, invested: 0, current: 0, delta: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");

  // Detalle + imagen grande
  const [detail, setDetail] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [imgLargeUrl, setImgLargeUrl] = useState(null);

  // Formulario popup
  const [priceInput, setPriceInput] = useState("");
  const [conditionInput, setConditionInput] = useState("");
  const [commentInput, setCommentInput] = useState("");

  async function loadData() {
    setLoading(true); setErr(null);
    try {
      const s = await window.api.collectionStats();
      const l = (await window.api.collectionListDetailed?.()) || (await window.api.collectionList());
      if (s?.ok !== false) {
        setStats({
          total: Number(s?.total || 0),
          invested: Number(s?.invested || 0),
          current: Number(s?.current || 0),
          delta: Number(s?.delta || 0),
        });
      }
      if (l?.items && Array.isArray(l.items)) setRows(l.items);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadData(); }, []);

  // Cargar detalle + inicializar formulario
  useEffect(() => {
    if (!detail) {
      setDetailData(null);
      setDetailLoading(false);
      setDetailError(null);
      setImgLargeUrl(null);
      setPriceInput(""); setConditionInput(""); setCommentInput("");
      return;
    }

    // Inicial rápido: si ya hay paid_eur -> ese; si no, usa eur de la fila como valor provisional
    const initialPrice =
      detail?.paid_eur != null ? Number(detail.paid_eur)
        : (detail?.eur != null ? Number(detail.eur) : 0);
    setPriceInput(Number.isFinite(initialPrice) && initialPrice > 0 ? String(initialPrice) : "");

    setConditionInput(detail?.condition || "");
    setCommentInput(detail?.comment || "");

    let cancelled = false;
    (async () => {
      try {
        setDetailLoading(true); setDetailError(null);

        // A) por scry_id (o id)
        let fetched = null;
        const idGuess = (typeof detail?.scry_id === "string" && detail.scry_id.length === 36)
          ? detail.scry_id : null;

        if (idGuess && window.api.scryCardDetail) {
          const r = await window.api.scryCardDetail(idGuess);
          if (!cancelled) {
            if (r?.ok) {
              setDetailData(r.data);
              fetched = r;
            } else setDetailError(r?.error || "Error al cargar");
          }
        }

        // B) por nombre si A no funcionó
        if (
          !cancelled &&
          (!fetched || fetched?.ok === false) &&
          window.api.scrySearchByName &&
          detail?.name
        ) {
          const results = await window.api.scrySearchByName(detail.name);

          if (!cancelled && Array.isArray(results) && results.length > 0) {
            // ⟵ AQUÍ aseguramos elegir la edición correcta
            const picked = pickBestMatchBySetAndNumber(results, detail);

            // Normalizamos `fetched` y `detailData` para que el resto de la vista funcione igual
            const finalPayload = picked ? { ok: true, data: picked } : { ok: true, data: results };
            setDetailData(finalPayload.data);
            fetched = finalPayload;
          }
        }

        // Si aún no hay precio pagado y tenemos precio de Scryfall -> ponerlo por defecto
        if (!cancelled && (detail?.paid_eur == null || Number(detail.paid_eur) === 0)) {
          const view = extractCardView(fetched);
          if (view?.priceEur != null && (priceInput === "" || Number(priceInput) === 0)) {
            setPriceInput(String(view.priceEur));
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

  // Guardar precio + estado + comentario
  async function handleSave() {
    try {
      const cardId = detail?.id;
      if (!cardId) return;
      const payload = {
        cardId,
        paid_eur: priceInput === "" ? null : Number(priceInput),
        condition: conditionInput || null,
        comment: commentInput || null,
      };
      const res = await window.api.collectionUpdatePaid(payload);
      if (res?.ok === false) {
        alert("Error al guardar: " + (res?.error || "desconocido"));
        return;
      }
      await loadData();
      setDetail((d) => d ? { ...d, ...payload } : d);
    } catch (e) {
      alert("Error al guardar: " + (e?.message || e));
    }
  }

  // Eliminar
  async function handleDelete() {
    try {
      const cardId = detail?.id;
      if (!cardId) return;
      if (!window.confirm("¿Eliminar esta carta de tu colección?")) return;
      const res = await window.api.collectionRemove({ cardId });
      if (res?.ok === false) {
        alert("No se pudo eliminar: " + (res?.error || "desconocido"));
        return;
      }
      setDetail(null);
      await loadData();
    } catch (e) {
      alert("No se pudo eliminar la carta: " + (e?.message || e));
    }
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) =>
      (r.name || "").toLowerCase().includes(s) ||
      String(r.collector_number || "").toLowerCase().includes(s) ||
      (r.set_name || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <div className="mi-coleccion">
      <h1 className="titulo">Mi colección</h1>

      {/* Resumen */}
      <div className="resumen">
        <div className="resumen-item">
          <div className="resumen-label">Cartas</div>
          <div className="resumen-valor">{stats.total || rows.length} cartas</div>
        </div>
        <div className="resumen-item">
          <div className="resumen-label">Invertido</div>
          <div className="resumen-valor">{fmtEUR(stats.invested)}</div>
        </div>
        <div className="resumen-item">
          <div className="resumen-label">Valor actual</div>
          <div className="resumen-valor">{fmtEUR(stats.current)}</div>
        </div>
        <div className="resumen-item">
          <div className="resumen-label">Δ Valor</div>
          <div className={`resumen-valor ${stats.delta >= 0 ? "positivo" : "negativo"}`}>
            {fmtEUR(stats.delta, true)}
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="buscador">
        <input
          placeholder="Buscar por nombre / nº / set"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="contador">{filtered.length} de {rows.length}</span>
        <button onClick={loadData}>Actualizar</button>
      </div>

      {loading && <div className="estado">Cargando…</div>}
      {err && <div className="estado error">Error: {err}</div>}

      {/* Lista */}
      {!loading && !err && (
        <div className="lista">
          {filtered.length === 0 && <div className="sin-resultados">No hay resultados.</div>}
          {filtered.map((r) => {
            const qty = Number(r.qty || 0);
            const eur = Number(r.eur || 0);
            const paid = r.paid_eur != null ? Number(r.paid_eur || 0) : null;
            const currentRow = Number(r.current_row != null ? r.current_row : qty * eur);
            const investedRow = paid != null ? qty * paid : null;
            return (
              <div key={r.id} className="fila">
                <div className="fila-izq">
                  <div className="cantidad">{qty}</div>
                  <div className="info">
                    <button
                      className="nombre-btn"
                      onClick={() => setDetail({ from: "mi-coleccion", ...r })}
                      title="Ver detalle"
                    >
                      {r.name || "—"}
                    </button>
                    <div className="detalle">
                      #{r.collector_number || "—"} · {r.set_name || "—"} · {r.rarity || "—"}
                      <button
                        className="detalle-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetail({ from: "mi-coleccion", ...r });
                        }}
                      >
                        Ver
                      </button>
                    </div>
                  </div>
                </div>
                <div className="fila-der">
                  <div>
                    {fmtEUR(currentRow)} <span className="actual">(actual)</span>
                  </div>
                  <div className="pagado">
                    pagado: {investedRow != null ? fmtEUR(investedRow) : "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POPUP DETALLE */}
      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{detail.name || "—"}</div>
              <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
            </div>

            <div className="modal-body">
              {detailLoading && <div className="muted">Cargando detalle…</div>}
              {detailError && <div className="error">Error: {detailError}</div>}

              {/* Bloque de info rica (igual que en Colecciones) */}
              {(() => {
                const view = extractCardView(detailData);
                const smallImg = pickSmallImage(detailData);
                const largeImg = pickLargeImage(detailData);

                return (
                  <div className="info-cols">
                    <div className="kv">
                      <div><span className="k">Set</span> <span className="v">{view?.setName || "—"}{view?.setCode ? ` (${view.setCode})` : ""}</span></div>
                      <div><span className="k">Número</span> <span className="v">{view?.collector || detail?.collector_number || "—"}</span></div>
                      <div><span className="k">Rareza</span> <span className="v">{view?.rarity || detail?.rarity || "—"}</span></div>
                      <div><span className="k">Coste</span> <span className="v mono">{view?.manaCost || "—"}</span></div>
                      <div><span className="k">Tipo</span> <span className="v">{view?.typeLine || "—"}</span></div>
                      {(view?.power != null && view?.toughness != null) && (
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
                          {view?.priceEur != null ? `EUR ${view.priceEur.toFixed(2)}` : "—"}
                          {view?.priceUsd != null ? ` · USD ${view.priceUsd.toFixed(2)}` : ""}
                          {view?.priceTix != null ? ` · TIX ${view.priceTix}` : ""}
                        </span>
                      </div>
                      <div className="texto">
                        <span className="k">Texto</span>
                        <span className="v v-block">
                          {view?.oracleText
                            ? view.oracleText.split("\n").map((l, i) => <div key={i}>{l}</div>)
                            : "—"}
                          {view?.flavorText && <div className="flavor">“{view.flavorText}”</div>}
                        </span>
                      </div>
                      <div className="links">
                        {view?.scryfallUrl && <a href={view.scryfallUrl} target="_blank" rel="noreferrer">Ver en Scryfall</a>}
                        {view?.rulingsUrl && <a href={view.rulingsUrl} target="_blank" rel="noreferrer">Rulings</a>}
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
                );
              })()}

              {/* Formulario (precio, estado, comentario) */}
              <div className="form-sep" />
              <div className="form-row">
                <label className="form-label">Precio de compra (€)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label className="form-label">Estado</label>
                <select
                  className="form-input"
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                >
                  <option value="">— sin estado —</option>
                  <option value="M">Mint (M)</option>
                  <option value="NM">Near Mint (NM)</option>
                  <option value="EX">Excellent (EX)</option>
                  <option value="GD">Good (GD)</option>
                  <option value="LP">Light Played (LP)</option>
                  <option value="PL">Played (PL)</option>
                  <option value="PO">Poor (PO)</option>
                </select>
              </div>
              <div className="form-row" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Comentario</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Notas sobre la carta (edición, vendedor, etc.)"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDelete}>Eliminar de mi colección</button>
              <div style={{ flex: 1 }} />
              <button className="btn" onClick={handleSave}>Guardar</button>
              <button className="btn" onClick={() => setDetail(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Imagen grande */}
      {imgLargeUrl && (
        <div className="overlay" onClick={() => setImgLargeUrl(null)}>
          <div className="modal-img" onClick={(e) => e.stopPropagation()}>
            <img src={imgLargeUrl} alt="Carta" />
            <button className="modal-close abs" onClick={() => setImgLargeUrl(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Estilos locales (alineados con Colecciones) */}
      <style jsx>{`
        .mi-coleccion { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .titulo { font-size: 1.125rem; font-weight: 600; color: #1e293b; }
        .resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
        .resumen-item { background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.75rem; }
        .resumen-label { color: #64748b; font-size: 0.75rem; }
        .resumen-valor { font-weight: 600; font-size: 1rem; color: #0f172a; }
        .resumen-valor.positivo { color: #059669; }
        .resumen-valor.negativo { color: #dc2626; }

        .buscador { display: flex; gap: 0.5rem; align-items: center; }
        .buscador input { flex: 1; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.4rem 0.6rem; background: white; font-size: 0.875rem; }
        .buscador button { border: 1px solid #e2e8f0; background: white; border-radius: 0.5rem; padding: 0.4rem 0.75rem; font-size: 0.875rem; cursor: pointer; }
        .buscador button:hover { background: #f8fafc; }
        .contador { font-size: 0.75rem; color: #64748b; white-space: nowrap; }

        .lista { background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: auto; max-height: 66vh; }
        .fila { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; }
        .fila:last-child { border-bottom: none; }
        .fila-izq { display: flex; align-items: start; gap: 0.75rem; min-width: 0; }
        .cantidad { width: 1.75rem; height: 1.75rem; display: flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; border-radius: 0.375rem; background: #f8fafc; font-size: 0.875rem; }
        .info { min-width: 0; }
        .nombre-btn { font-weight: 600; color: #2563eb; background: transparent; border: 0; padding: 0; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .nombre-btn:hover { text-decoration: underline; }
        .detalle { font-size: 0.75rem; color: #64748b; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .detalle-link { border: 1px solid #e2e8f0; background: #fff; border-radius: 6px; padding: 2px 6px; font-size: 0.75rem; cursor: pointer; }
        .detalle-link:hover { background: #f1f5f9; }
        .fila-der { text-align: right; font-size: 0.875rem; color: #334155; white-space: nowrap; }
        .actual { color: #64748b; }
        .pagado { font-size: 0.75rem; color: #64748b; }
        .sin-resultados { padding: 1.5rem; text-align: center; color: #64748b; }

        /* Popup */
        .overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .modal { width: min(920px, 92vw); background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 20px 50px rgba(15,23,42,0.25); overflow: hidden; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
        .modal-title { font-weight: 600; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .modal-close { border: 1px solid #e2e8f0; background: white; border-radius: 8px; width: 28px; height: 28px; cursor: pointer; }
        .modal-close:hover { background: #f1f5f9; }
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

        .form-sep { height: 1px; background: #e2e8f0; }
        .form-row { display: grid; grid-template-columns: 160px 1fr; gap: 10px; align-items: center; }
        .form-label { color: #64748b; font-size: 0.85rem; }
        .form-input { border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; padding: 6px 8px; font-size: 0.9rem; }

        .modal-actions { display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid #e2e8f0; padding: 10px 14px; }
        .btn { border: 1px solid #e2e8f0; background: white; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
        .btn:hover { background: #f8fafc; }
        .btn-danger { border-color: #fecaca; color: #b91c1c; }
        .btn-danger:hover { background: #fee2e2; }

        /* Imagen grande */
        .modal-img { position: relative; background: #0b1220; border-radius: 16px; padding: 12px; box-shadow: 0 25px 60px rgba(0,0,0,.45); max-width: 92vw; max-height: 92vh; display: flex; align-items: center; justify-content: center; }
        .modal-img img { max-width: 88vw; max-height: 88vh; border-radius: 10px; }
        .modal-close.abs { position: absolute; top: 8px; right: 8px; background: #fff; }
        .estado { padding: 0.5rem; color: #475569; }
        .estado.error { color: #b91c1c; }
      `}</style>
    </div>
  );
}
