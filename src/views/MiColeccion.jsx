import React, { useEffect, useMemo, useState } from "react";

// Formateo de moneda
const fmtEUR = (n, sign = false) => {
  const v = Number(n || 0);
  const s = v.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
  return sign && v > 0 ? `+${s}` : s;
};

export default function MiColeccion() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0, invested: 0, current: 0, delta: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null); // popup

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

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(r =>
      (r.name || "").toLowerCase().includes(s) ||
      String(r.collector_number || "").toLowerCase().includes(s) ||
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

      {/* Lista de cartas */}
      {!loading && !err && (
        <div className="lista">
          {filtered.length === 0 && (
            <div className="sin-resultados">No hay resultados.</div>
          )}

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
                    {/* Nombre (clic también abre popup) */}
                    <button
                      className="nombre-btn"
                      onClick={() => {
                        console.log('[DETAIL] open from MiColeccion (name)', r);
                        setDetail({ from: 'mi-coleccion', ...r });
                      }}
                      title="Ver detalle"
                    >
                      {r.name || "—"}
                    </button>

                    <div className="detalle">
                      #{r.collector_number || "—"} · {r.set_name || "—"} · {r.rarity || "—"}
                      {/* Enlace "Ver" como en Colecciones */}
                      <button
                        className="detalle-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('[DETAIL] open from MiColeccion (link)', r);
                          setDetail({ from: 'mi-coleccion', ...r });
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

      {/* POPUP de detalle (sólo apertura por ahora) */}
      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{detail.name || "—"}</div>
              <button className="modal-close" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="modal-row">
                <span className="k">Set</span><span className="v">{detail.set_name || "—"}</span>
              </div>
              <div className="modal-row">
                <span className="k">Número</span><span className="v">{detail.collector_number || "—"}</span>
              </div>
              <div className="modal-row">
                <span className="k">Rareza</span><span className="v">{detail.rarity || "—"}</span>
              </div>
              <div className="modal-row">
                <span className="k">Cantidad</span><span className="v">{detail.qty ?? "—"}</span>
              </div>
              {/* El contenido “rico” lo añadimos después */}
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setDetail(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos locales (consistentes con el resto de vistas) */}
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
        .modal { width: min(680px, 92vw); background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25); overflow: hidden; }
        .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
        .modal-title { font-weight: 600; color: #0f172a; }
        .modal-close { border: 1px solid #e2e8f0; background: white; border-radius: 8px; width: 28px; height: 28px; cursor: pointer; }
        .modal-close:hover { background: #f1f5f9; }
        .modal-body { padding: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .modal-row { display: flex; gap: 10px; }
        .modal-row .k { width: 120px; color: #64748b; font-size: 0.85rem; }
        .modal-row .v { color: #0f172a; font-weight: 500; }
        .modal-actions { display: flex; justify-content: flex-end; padding: 12px 14px; border-top: 1px solid #e2e8f0; gap: 8px; }
        .btn { border: 1px solid #e2e8f0; background: white; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
        .btn:hover { background: #f8fafc; }
      `}</style>
    </div>
  );
}
