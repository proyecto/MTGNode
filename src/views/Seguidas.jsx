import React, { useEffect, useState } from 'react';

export default function Seguidas() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('init');

  async function load() {
    setStatus('cargando');
    const list = await window.api.listCards();
    const followed = (list || []).filter(r => r.followed === 1 || r.followed === true);
    setRows(followed);
    setStatus('ok');
  }

  useEffect(() => { load(); }, []);

  async function onToggle(id) {
    await window.api.toggleFollow(id);
    await load();
  }

  async function onAddToCollection(id) {
    await window.api.addToCollection(id, 1);
    // no cambiamos la lista de seguidas, solo añadimos a la colección
  }

  return (
    <div style={wrap}>
      <div style={header}>
        <h2 style={{ margin: 0 }}>Seguidas</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={load} style={btn}>Recargar</button>
        </div>
      </div>

      {status !== 'ok' ? (
        <div style={{ opacity:.7 }}>Cargando…</div>
      ) : rows.length === 0 ? (
        <div style={{ opacity:.7 }}>No hay cartas seguidas aún.</div>
      ) : (
        <ul style={list}>
          {rows.map(r => (
            <li key={r.id} style={row}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:600 }}>
                    {r.name} <span style={{ opacity:.6 }}>({r.edition || '—'})</span>
                  </div>
                  <div style={{ fontSize:12, opacity:.8 }}>
                    {r.rarity || '—'} · {Number(r.price_eur || 0)} €
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => onAddToCollection(r.id)} style={btn}>Añadir a colección</button>
                  <button onClick={() => onToggle(r.id)} style={btnAlt}>Dejar de seguir</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const wrap = { display:'grid', gap:12 };
const header = { display:'flex', alignItems:'center', justifyContent:'space-between' };
const list = { listStyle:'none', padding:0, margin:0 };
const row = { border:'1px solid #eee', borderRadius:12, padding:12, marginBottom:8, background:'#fff' };
const btn = { padding:'8px 12px', borderRadius:8, border:'1px solid #e5e5e5', background:'#f5f5f7', cursor:'pointer' };
const btnAlt = { ...btn, background:'#fff' };
