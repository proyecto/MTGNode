import React, { useEffect, useMemo, useState } from "react";

const fmtEUR = (n, sign = false) => {
  const v = Number(n || 0);
  const s = v.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
  return sign && v > 0 ? `+${s}` : s;
};

const CONDITION_OPTIONS = [
  { value: "NM", label: "Near Mint (NM)" },
  { value: "LP", label: "Lightly Played (LP)" },
  { value: "MP", label: "Moderately Played (MP)" },
  { value: "HP", label: "Heavily Played (HP)" },
  { value: "POOR", label: "Poor" },
];

export default function MiColeccion() {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ total: 0, invested: 0, current: 0, delta: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState("");

  const [detail, setDetail] = useState(null);

  // Form fields
  const [paidInput, setPaidInput] = useState("");
  const [conditionInput, setConditionInput] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const s = await window.api.collectionStats();
      const l =
        (await window.api.collectionListDetailed?.()) ||
        (await window.api.collectionList());
      if (s?.ok !== false)
        setStats({
          total: Number(s?.total || 0),
          invested: Number(s?.invested || 0),
          current: Number(s?.current || 0),
          delta: Number(s?.delta || 0),
        });
      if (l?.items && Array.isArray(l.items)) setRows(l.items);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Reset form when opening modal
  useEffect(() => {
    if (!detail) return;
    const initialPaid =
      detail?.paid_eur != null && !isNaN(detail.paid_eur)
        ? String(Number(detail.paid_eur).toFixed(2)).replace(".", ",")
        : "";
    setPaidInput(initialPaid);

    const c0 = String(detail?.condition || "").toUpperCase();
    setConditionInput(["NM", "LP", "MP", "HP", "POOR"].includes(c0) ? c0 : "");
  }, [detail]);

  async function handleSaveAll() {
    try {
      setFormError(null);
      if (!detail?.id) return;

      const rawPaid = (paidInput ?? "").toString().trim().replace(",", ".");
      const paid = rawPaid === "" ? 0 : Number(rawPaid);
      if (isNaN(paid) || paid < 0) {
        setFormError("Introduce un precio válido (≥ 0).");
        return;
      }

      const cond = String(conditionInput || "").toUpperCase();
      if (cond && !["NM", "LP", "MP", "HP", "POOR"].includes(cond)) {
        setFormError("Selecciona un estado válido.");
        return;
      }

      const fields = { paid_eur: paid, condition: cond };

      setSaving(true);
      const res = await window.api.collectionUpdateFields({
        cardId: detail.id,
        fields,
      });
      setSaving(false);

      if (!res || res.ok === false)
        return alert("Error al guardar: " + (res?.error || "desconocido"));
      if (typeof res.changes === "number" && res.changes === 0)
        return alert("No se actualizó ninguna fila.");

      setDetail(null);
      await loadData();
    } catch (e) {
      console.error("[MiColeccion] save error:", e);
      setFormError("No se pudo guardar los cambios.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      const cardId = detail?.id;
      if (!cardId) return alert("No se encontró ID.");
      if (!window.confirm("¿Eliminar esta carta de tu colección?")) return;
      const res = await window.api.collectionRemove({ cardId });
      setDetail(null);
      await loadData();
    } catch (e) {
      alert("Error eliminando: " + (e?.message || e));
    }
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(s) ||
        (r.set_name || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <div className="mi-coleccion">
      <h1 className="titulo">Mi colección</h1>

      <div className="resumen">
        <div className="resumen-item">
          <div className="resumen-label">Cartas</div>
          <div className="resumen-valor">{stats.total} cartas</div>
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

      <div className="buscador">
        <input
          placeholder="Buscar por nombre o set"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button onClick={loadData}>Actualizar</button>
      </div>

      {loading && <div className="estado">Cargando…</div>}
      {err && <div className="estado error">Error: {err}</div>}

      {!loading && !err && (
        <div className="lista">
          {filtered.map((r) => (
            <div key={r.id} className="fila">
              <div>
                <strong>
                  <button
                    className="nombre-btn"
                    onClick={() => setDetail(r)}
                  >
                    {r.name}
                  </button>
                </strong>{" "}
                – {r.set_name}
              </div>
              <div>{fmtEUR(r.eur)}</div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div className="overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{detail.name}</div>
              <button className="modal-close" onClick={() => setDetail(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-row">
                <span className="k">Precio compra</span>
                <input
                  className="input"
                  value={paidInput}
                  onChange={(e) => setPaidInput(e.target.value)}
                  placeholder="Ej: 10,00"
                />
              </div>

              <div className="modal-row">
                <span className="k">Estado</span>
                <select
                  className="input"
                  value={conditionInput}
                  onChange={(e) => setConditionInput(e.target.value)}
                >
                  <option value="">— Selecciona —</option>
                  {CONDITION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <div style={{ color: "#dc2626", marginTop: 6 }}>{formError}</div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn" onClick={handleDelete}>
                Eliminar
              </button>
              <button className="btn btn-primary" onClick={handleSaveAll} disabled={saving}>
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .mi-coleccion {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .titulo {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e293b;
        }
        .resumen {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 0.75rem;
        }
        .resumen-item {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 0.75rem;
        }
        .resumen-label {
          color: #64748b;
          font-size: 0.75rem;
        }
        .resumen-valor {
          font-weight: 600;
        }
        .positivo {
          color: #059669;
        }
        .negativo {
          color: #dc2626;
        }
        .buscador {
          display: flex;
          gap: 0.5rem;
        }
        .buscador input {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 0.5rem;
        }
        .lista {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: white;
          max-height: 70vh;
          overflow: auto;
        }
        .fila {
          display: flex;
          justify-content: space-between;
          padding: 0.6rem 1rem;
          border-bottom: 1px solid #e2e8f0;
        }
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .modal {
          background: white;
          border-radius: 10px;
          width: min(600px, 90%);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          padding: 0.8rem 1rem;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .modal-body {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .modal-row {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }
        .modal-row .k {
          width: 120px;
          color: #64748b;
        }
        .input {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 0.4rem 0.6rem;
        }
        .modal-actions {
          display: flex;
          justify-content: space-between;
          padding: 0.8rem 1rem;
          border-top: 1px solid #e2e8f0;
        }
        .btn {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: white;
          padding: 0.5rem 1rem;
          cursor: pointer;
        }
        .btn:hover {
          background: #f8fafc;
        }
        .btn-primary {
          border-color: #2563eb;
          background: #2563eb;
          color: white;
        }
        .btn-primary:hover {
          background: #1d4ed8;
        }
      `}</style>
    </div>
  );
}
