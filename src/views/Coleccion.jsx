import React, { useEffect, useState } from "react";

export default function Coleccion() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("init");

  async function load() {
    setStatus("cargando");
    const list = await window.api.collectionList();
    setRows(list || []);
    setStatus("ok");
  }

  useEffect(() => {
    load();
  }, []);

  async function onExportClick() {
    const res = await window.api.collectionExportCSV();
    if (res?.ok) {
      alert(`Exportado ${res.count} filas a:\n${res.path}`);
    } else if (res?.canceled) {
      // usuario canceló -> no hacemos nada
    } else {
      alert(`No se pudo exportar: ${res?.error || "error desconocido"}`);
    }
  }

  async function onImportClick() {
    const res = await window.api.collectionImportCSV();
    if (res?.ok) {
      alert(
        `Importación completada:\n` +
          `Añadidos: ${res.added}\n` +
          `Actualizados: ${res.updated}\n` +
          `Eliminados: ${res.removed}\n` +
          `Ignorados: ${res.ignored}\n` +
          `Archivo: ${res.path}`
      );
      await load();
    } else if (res?.canceled) {
      // usuario canceló -> no hacemos nada
    } else {
      alert(`No se pudo importar: ${res?.error || "error desconocido"}`);
    }
  }

  async function inc(cardId) {
    const row = rows.find((r) => r.card_id === cardId);
    const newQty = (row?.quantity || 0) + 1;
    await window.api.collectionUpdateQty(cardId, newQty);
    await load();
  }
  async function dec(cardId) {
    const row = rows.find((r) => r.card_id === cardId);
    const newQty = Math.max(0, (row?.quantity || 0) - 1);
    await window.api.collectionUpdateQty(cardId, newQty);
    await load();
  }
  async function remove(cardId) {
    await window.api.collectionRemove(cardId);
    await load();
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>Mi colección</h2>

      {status !== "ok" ? (
        <div style={{ opacity: 0.7 }}>Cargando…</div>
      ) : rows.length === 0 ? (
        <div style={{ opacity: 0.7 }}>
          Aún no has añadido cartas a tu colección.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map((r) => (
            <li key={r.collection_id} style={row}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {r.name}{" "}
                    <span style={{ opacity: 0.6 }}>({r.edition || "—"})</span>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {r.rarity || "—"} · {Number(r.price_eur || 0)} €
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.6 }}>
                    Añadida: {new Date(r.acquired_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => dec(r.card_id)} style={btn}>
                    –
                  </button>
                  <span style={{ minWidth: 24, textAlign: "center" }}>
                    {r.quantity}
                  </span>
                  <button onClick={() => inc(r.card_id)} style={btn}>
                    +
                  </button>
                  <button onClick={() => remove(r.card_id)} style={btnAlt}>
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={load} style={btn}>
          Recargar
        </button>
        <button onClick={onExportClick} style={btn}>
          Exportar CSV
        </button>
        <button onClick={onImportClick} style={btn}>
          Importar CSV
        </button>
      </div>
    </div>
  );
}

const row = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 12,
  marginBottom: 8,
  background: "#fff",
};
const btn = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid #e5e5e5",
  background: "#f5f5f7",
  cursor: "pointer",
};
const btnAlt = { ...btn, background: "#fff" };
