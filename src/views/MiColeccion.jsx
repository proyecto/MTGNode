import React, { useEffect, useMemo, useState } from "react";

// Formateo de moneda
const fmtEUR = (n, sign = false) => {
  const v = Number(n || 0);
  const s = v.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
  return sign && v > 0 ? `+${s}` : s;
};

// Helper (por si usamos búsqueda/empate por set en siguientes pasos)
function pickBySet(candidates, setName) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const byExact = candidates.find(
    (c) => (c.set_name || "").toLowerCase() === (setName || "").toLowerCase()
  );
  return byExact || candidates[0];
}

export default function MiColeccion() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    invested: 0,
    current: 0,
    delta: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");

  const [detail, setDetail] = useState(null); // datos básicos (fila)
  const [detailData, setDetailData] = useState(null); // datos ricos (scry)
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // input de precio de compra en el modal
  const [paidInput, setPaidInput] = useState(""); // string controlado
  const [savingPaid, setSavingPaid] = useState(false); // estado de guardado
  const [paidError, setPaidError] = useState(null); // validación

  async function loadData() {
    setLoading(true);
    setErr(null);
    try {
      const s = await window.api.collectionStats();
      const l =
        (await window.api.collectionListDetailed?.()) ||
        (await window.api.collectionList());

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
      console.error("[MiColeccion] load error:", e);
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Cargar detalle al abrir popup
  useEffect(() => {
    if (!detail) {
      setDetailData(null);
      setDetailLoading(false);
      setDetailError(null);
      // resetear input al cerrar
      setPaidInput("");
      setPaidError(null);
      return;
    }

    // inicializar input con paid_eur (si hay)
    const initialPaid =
      detail?.paid_eur != null && !isNaN(detail.paid_eur)
        ? String(Number(detail.paid_eur).toFixed(2)).replace(".", ",")
        : "";
    setPaidInput(initialPaid);
    setPaidError(null);

    (async () => {
      try {
        setDetailLoading(true);
        setDetailError(null);

        const scryId = detail?.scry_id;
        if (scryId && window.api.scryCardDetail) {
          const d = await window.api.scryCardDetail(scryId);
          console.log("[DETAIL] from scry_id:", d);
          setDetailData({ source: "scry_id", data: d });
          return;
        }

        // Primer fallback local (nombre + set)
        if (window.api.scryFindByNameSet && detail?.name && detail?.set_name) {
          const local = await window.api.scryFindByNameSet(
            detail.name,
            detail.set_name
          );
          if (local?.ok) {
            console.log("[DETAIL] from local set match:", local);
            setDetailData({ source: "local-set", data: local });
            return;
          }
        }

        // Segundo fallback (búsqueda por nombre)
        if (window.api.scrySearchByName && detail?.name) {
          const results = await window.api.scrySearchByName(detail.name);
          console.log(
            "[DETAIL] search results:",
            results?.length,
            results?.slice?.(0, 3)
          );
          const picked = pickBySet(results || [], detail?.set_name);
          if (picked) {
            setDetailData({ source: "search-fallback", data: picked });
            return;
          }
        }

        throw new Error("No se encontró detalle por nombre/set.");
      } catch (e) {
        console.error("[DETAIL] error:", e);
        setDetailError(String(e?.message || e));
        setDetailData(null);
      } finally {
        setDetailLoading(false);
      }
    })();
  }, [detail]);

  // Guardar precio de compra
  async function handleSavePaid() {
    try {
      setPaidError(null);
      if (!detail?.id) return;

      // normalizar: comas -> punto, quitar espacios
      const raw = (paidInput ?? "").toString().trim().replace(",", ".");
      if (raw === "") {
        // Tratamos vacío como 0 (o podríamos dejarlo como NULL si tu backend lo soporta)
        const res = await window.api.collectionUpdatePaid({
          cardId: detail.id,
          paid_eur: 0,
        });
        console.log("[MiColeccion] update paid (empty->0) res:", res);
      } else {
        const num = Number(raw);
        if (isNaN(num) || num < 0) {
          setPaidError("Introduce un número válido (≥ 0)");
          return;
        }
        setSavingPaid(true);
        const res = await window.api.collectionUpdatePaid({
          cardId: detail.id,
          paid_eur: num,
        });
        console.log("[MiColeccion] update paid res:", res);
        if (!res || res.ok === false) {
          alert("No se pudo guardar: " + (res?.error || "error desconocido"));
          setSavingPaid(false);
          return;
        }
        if (typeof res.changes === "number" && res.changes === 0) {
          alert("No se actualizó ninguna fila (¿id incorrecto?)");
          setSavingPaid(false);
          return;
        }
      }

      // refrescar datos y cerrar modal
      setSavingPaid(false);
      setDetail(null);
      await loadData();
    } catch (e) {
      console.error("[MiColeccion] update paid error:", e);
      setSavingPaid(false);
      setPaidError("No se pudo guardar el precio.");
    }
  }

  // Eliminar carta (usa el id de la fila de collection)
  async function handleDelete() {
    try {
      const cardId = detail?.id ?? detail?.card_id ?? detail?.scry_id;
      if (!cardId) {
        alert("No se encontró identificador para borrar esta carta.");
        return;
      }
      const confirmed = window.confirm("¿Eliminar esta carta de tu colección?");
      if (!confirmed) return;

      const res = await window.api.collectionRemove({ cardId });
      console.log("[MiColeccion] remove result:", res);

      setDetail(null);
      await loadData();
    } catch (e) {
      console.error("[MiColeccion] remove error:", e);
      alert("No se pudo eliminar la carta: " + (e?.message || e));
    }
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(s) ||
        String(r.collector_number || "")
          .toLowerCase()
          .includes(s) ||
        (r.set_name || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <div className="mi-coleccion">
      <h1 className="titulo">Mi colección</h1>

      {/* Tarjetas de resumen */}
      <div className="resumen">
        <div className="resumen-item">
          <div className="resumen-label">Cartas</div>
          <div className="resumen-valor">
            {stats.total || rows.length} cartas
          </div>
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
          <div
            className={`resumen-valor ${
              stats.delta >= 0 ? "positivo" : "negativo"
            }`}
          >
            {fmtEUR(stats.delta, true)}
          </div>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="buscador">
        <input
          placeholder="Buscar por nombre / nº / set"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="contador">
          {filtered.length} de {rows.length}
        </span>
        <button onClick={loadData}>Actualizar</button>
      </div>

      {loading && <div className="estado">Cargando…</div>}
      {err && <div className="estado error">Error: {err}</div>}

      {/* Lista */}
      {!loading && !err && (
        <div className="lista">
          {filtered.length === 0 && (
            <div className="sin-resultados">No hay resultados.</div>
          )}

          {filtered.map((r) => {
            const qty = Number(r.qty || 0);
            const eur = Number(r.eur || 0);
            const paid = r.paid_eur != null ? Number(r.paid_eur || 0) : null;
            const currentRow = Number(
              r.current_row != null ? r.current_row : qty * eur
            );
            const investedRow = paid != null ? qty * paid : null;

            return (
              <div key={r.id} className="fila">
                <div className="fila-izq">
                  <div className="cantidad">{qty}</div>

                  <div className="info">
                    {/* Nombre (abre popup) */}
                    <button
                      className="nombre-btn"
                      onClick={() => {
                        console.log("[DETAIL] open from MiColeccion (name)", r);
                        setDetail({ from: "mi-coleccion", ...r });
                      }}
                      title="Ver detalle"
                    >
                      {r.name || "—"}
                    </button>

                    <div className="detalle">
                      #{r.collector_number || "—"} · {r.set_name || "—"} ·{" "}
                      {r.rarity || "—"}
                      <button
                        className="detalle-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log(
                            "[DETAIL] open from MiColeccion (link)",
                            r
                          );
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
                    {fmtEUR(currentRow)}{" "}
                    <span className="actual">(actual)</span>
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

      {/* POPUP */}
      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{detail.name || "—"}</div>
              <button className="modal-close" onClick={() => setDetail(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              {detailLoading && (
                <div style={{ gridColumn: "1 / -1", color: "#64748b" }}>
                  Cargando detalle…
                </div>
              )}
              {detailError && (
                <div style={{ gridColumn: "1 / -1", color: "#dc2626" }}>
                  Error: {detailError}
                </div>
              )}
              {!detailLoading && !detailError && detailData && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    color: "#334155",
                    fontSize: "0.9rem",
                  }}
                >
                  Detalle recibido (
                  {detailData.source === "scry_id"
                    ? "por scry_id"
                    : detailData.source}
                  ). Revisa la consola para ver el objeto completo.
                </div>
              )}

              <div className="modal-row">
                <span className="k">Set</span>
                <span className="v">{detail.set_name || "—"}</span>
              </div>
              <div className="modal-row">
                <span className="k">Número</span>
                <span className="v">{detail.collector_number || "—"}</span>
              </div>
              <div className="modal-row">
                <span className="k">Rareza</span>
                <span className="v">{detail.rarity || "—"}</span>
              </div>
              <div className="modal-row">
                <span className="k">Cantidad</span>
                <span className="v">{detail.qty ?? "—"}</span>
              </div>

              {/* --- Input de precio de compra --- */}
              <div className="modal-row" style={{ alignItems: "center" }}>
                <span className="k">Precio compra</span>
                <div
                  className="v"
                  style={{ display: "flex", gap: 8, alignItems: "center" }}
                >
                  <input
                    className="input"
                    placeholder="Ej: 12,50"
                    value={paidInput}
                    onChange={(e) => {
                      setPaidInput(e.target.value);
                      setPaidError(null);
                    }}
                    inputMode="decimal"
                  />
                  <button
                    className="btn"
                    disabled={savingPaid}
                    onClick={handleSavePaid}
                  >
                    {savingPaid ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
              {paidError && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    color: "#dc2626",
                    fontSize: "0.85rem",
                  }}
                >
                  {paidError}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={() => setDetail(null)}>
                Cerrar
              </button>
              <button className="btn btn-danger" onClick={handleDelete}>
                Eliminar de mi colección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos locales */}
      <style jsx>{`
        .mi-coleccion {
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

        .resumen {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.75rem;
        }
        .resumen-item {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.75rem;
        }
        .resumen-label {
          color: #64748b;
          font-size: 0.75rem;
        }
        .resumen-valor {
          font-weight: 600;
          font-size: 1rem;
          color: #0f172a;
        }
        .resumen-valor.positivo {
          color: #059669;
        }
        .resumen-valor.negativo {
          color: #dc2626;
        }

        .buscador {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        .buscador input {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.4rem 0.6rem;
          background: white;
          font-size: 0.875rem;
        }
        .buscador button {
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 0.5rem;
          padding: 0.4rem 0.75rem;
          font-size: 0.875rem;
          cursor: pointer;
        }
        .buscador button:hover {
          background: #f8fafc;
        }
        .contador {
          font-size: 0.75rem;
          color: #64748b;
          white-space: nowrap;
        }

        .lista {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 0.75rem;
          overflow: auto;
          max-height: 66vh;
        }
        .fila {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e2e8f0;
        }
        .fila:last-child {
          border-bottom: none;
        }
        .fila-izq {
          display: flex;
          align-items: start;
          gap: 0.75rem;
          min-width: 0;
        }
        .cantidad {
          width: 1.75rem;
          height: 1.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #e2e8f0;
          border-radius: 0.375rem;
          background: #f8fafc;
          font-size: 0.875rem;
        }
        .info {
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
        .detalle {
          font-size: 0.75rem;
          color: #64748b;
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        .detalle-link {
          border: 1px solid #e2e8f0;
          background: #fff;
          border-radius: 6px;
          padding: 2px 6px;
          font-size: 0.75rem;
          cursor: pointer;
        }
        .detalle-link:hover {
          background: #f1f5f9;
        }

        .fila-der {
          text-align: right;
          font-size: 0.875rem;
          color: #334155;
          white-space: nowrap;
        }
        .actual {
          color: #64748b;
        }
        .pagado {
          font-size: 0.75rem;
          color: #64748b;
        }
        .sin-resultados {
          padding: 1.5rem;
          text-align: center;
          color: #64748b;
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
          width: min(740px, 92vw);
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
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .modal-row {
          display: flex;
          gap: 10px;
        }
        .modal-row .k {
          width: 120px;
          color: #64748b;
          font-size: 0.85rem;
        }
        .modal-row .v {
          color: #0f172a;
          font-weight: 500;
        }
        .modal-actions {
          display: flex;
          justify-content: space-between;
          padding: 12px 14px;
          border-top: 1px solid #e2e8f0;
          gap: 8px;
        }
        .btn {
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          padding: 8px 12px;
          cursor: pointer;
        }
        .btn:hover {
          background: #f8fafc;
        }
        .btn-danger {
          border-color: #fecaca;
          color: #b91c1c;
        }
        .btn-danger:hover {
          background: #fee2e2;
        }

        .input {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 10px;
          min-width: 140px;
        }
        .input:focus {
          outline: none;
          border-color: #94a3b8;
          box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.25);
        }
      `}</style>
    </div>
  );
}
