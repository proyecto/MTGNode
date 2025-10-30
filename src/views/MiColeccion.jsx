// src/views/MiColeccion.jsx
import React, { useEffect, useMemo, useState } from 'react';

export default function MiColeccion() {
  const [stats, setStats] = useState({ totalCards: 0, invested: 0, current: 0 });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');
  const [savingPaid, setSavingPaid] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = await window.api.collectionStats();
      const list = await window.api.collectionListDetailed();
      setStats(s?.ok ? s.data : { totalCards: 0, invested: 0, current: 0 });
      setRows(list?.ok ? list.items : []);
      setLoading(false);
    })();
  }, []);

  async function reloadAll() {
    setLoading(true);
    const s = await window.api.collectionStats();
    const list = await window.api.collectionListDetailed();
    setStats(s?.ok ? s.data : { totalCards: 0, invested: 0, current: 0 });
    setRows(list?.ok ? list.items : []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const nq = norm(q);
    return rows.filter(r =>
      norm(r.name).includes(nq) ||
      String(r.collector_number || '').toLowerCase().includes(nq) ||
      norm(r.set_name || '').includes(nq)
    );
  }, [q, rows]);

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }

  function openDetail(row) {
    setSelected({
      id: row.card_id,
      name: row.name,
      set_name: row.set_name,
      collector_number: row.collector_number,
      rarity: row.rarity,
      eur: row.eur,
      eur_foil: row.eur_foil,
      image_normal: row.image_normal,
      qty: row.qty,
      paid_eur: row.paid_eur
    });
  }

  useEffect(() => {
    (async () => {
      if (!selected) return;
      setDetailStatus('loading');
      const res = await window.api.scryCardDetail(selected.id || selected.name);
      if (res?.ok) {
        setDetail(res.data);
        setDetailStatus('ok');
      } else {
        setDetail(null);
        setDetailStatus('error');
      }
    })();
  }, [selected]);

  async function savePaid() {
    if (!selected) return;
    setSavingPaid(true);
    const value = Number(selected.paid_eur);
    const res = await window.api.collectionUpdatePaid({ cardId: selected.id, paid_eur: isFinite(value) ? value : null });
    setSavingPaid(false);
    if (res?.ok) {
      await reloadAll();
      // refrescar dato en selección
      const updated = rows.find(r => r.card_id === selected.id);
      if (updated) {
        setSelected(s => s ? { ...s, paid_eur: updated.paid_eur } : s);
      }
    } else {
      alert(`Error guardando precio pagado: ${res?.error || 'desconocido'}`);
    }
  }

  const totalCountLabel = `${stats.totalCards || 0} cartas`;
  const investedLabel = money(stats.invested);
  const currentLabel = money(stats.current);
  const diff = (stats.current || 0) - (stats.invested || 0);
  const diffLabel = (diff >= 0 ? '+' : '') + money(diff);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Encabezado / KPIs */}
      <div style={kpiRow}>
        <KpiCard title="Cartas" value={totalCountLabel} />
        <KpiCard title="Invertido" value={investedLabel} />
        <KpiCard title="Valor actual" value={currentLabel} />
        <KpiCard title="Δ Valor" value={diffLabel} accent={diff >= 0 ? 'pos' : 'neg'} />
        <div style={{ marginLeft: 'auto' }}>
          <button style={btn} onClick={reloadAll}>Actualizar</button>
        </div>
      </div>

      {/* Buscador */}
      <div style={searchBar}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre / nº / set"
          style={searchInput}
        />
        {q && <button onClick={() => setQ('')} style={clearBtn} title="Limpiar">✕</button>}
        <div style={countBadge}>
          {loading ? 'Cargando…' : `${filtered.length} de ${rows.length}`}
        </div>
      </div>

      {/* Lista */}
      <div style={listWrap}>
        {loading ? (
          <div style={{ opacity: .7, padding: 12 }}>Cargando colección…</div>
        ) : !rows.length ? (
          <div style={{ opacity: .7, padding: 12 }}>Tu colección está vacía.</div>
        ) : filtered.length === 0 ? (
          <div style={{ opacity: .7, padding: 12 }}>Sin resultados para “{q}”.</div>
        ) : (
          <ul style={list}>
            {filtered.map(r => (
              <li key={r.card_id} style={row}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={qtyBadge}>{r.qty}</div>
                    <div>
                      <div
                        style={{ fontWeight: 600, cursor: 'pointer', color: '#007aff' }}
                        title="Ver detalle"
                        onClick={() => openDetail(r)}
                      >
                        {r.name}
                      </div>
                      <div style={{ fontSize: 12, opacity: .75 }}>
                        {r.set_name || '—'} · #{r.collector_number || '—'} · {r.rarity || '—'}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, opacity: .8 }}>
                    {money(r.eur)} (actual) · pagado: {r.paid_eur != null ? money(r.paid_eur) : '—'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Detalle modal */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          style={overlay}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          tabIndex={-1}
          onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
        >
          <div style={panel} onClick={e => e.stopPropagation()}>
            <div style={panelHeader}>
              <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selected.name}
              </div>
              <button style={btn} onClick={close}>Cerrar</button>
            </div>

            <div style={panelBody}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={leftCol}>
                  {selected.image_normal ? (
                    <img src={selected.image_normal} alt={selected.name} style={cardImg} />
                  ) : (
                    <div style={noImgBox}>Sin imagen</div>
                  )}
                </div>

                <div style={rightCol}>
                  <div style={section}>
                    <div style={sectionTitle}>Datos</div>
                    <div style={kv}><b>Set:</b> <span>{selected.set_name || '—'}</span></div>
                    <div style={kv}><b>Nº:</b> <span>{selected.collector_number || '—'}</span></div>
                    <div style={kv}><b>Rareza:</b> <span>{selected.rarity || '—'}</span></div>
                    <div style={kv}><b>Precio actual:</b> <span>{money(selected.eur)}</span></div>
                    <div style={kv}><b>Cantidad:</b> <span>{selected.qty}</span></div>
                  </div>

                  <div style={section}>
                    <div style={sectionTitle}>Coste</div>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <label style={label}>Pagado por carta (€)</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          min="0"
                          placeholder={String(selected.eur ?? '')}
                          value={selected.paid_eur ?? ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? null : Number(e.target.value);
                            setSelected(s => s ? { ...s, paid_eur: v } : s);
                          }}
                          style={input}
                        />
                        <button style={btn} onClick={useCurrentAsPaid}>Usar valor actual</button>
                        <button style={btn} disabled={savingPaid} onClick={savePaid}>
                          {savingPaid ? 'Guardando…' : 'Guardar'}
                        </button>
                      </div>
                      <div style={{ fontSize: 12, opacity: .75 }}>
                        Si dejas vacío, se considera sin dato (no contará como inversión).
                      </div>
                    </div>
                  </div>

                  <div style={section}>
                    <div style={sectionTitle}>Texto / Reglas</div>
                    {detailStatus === 'loading' && <div style={{ opacity: .8 }}>Cargando…</div>}
                    {detailStatus === 'error' && <div style={{ color: '#b00020' }}>Error al cargar detalles.</div>}
                    {detailStatus === 'ok' && detail?.oracle_text ? (
                      <div style={rulesBox}>{detail.oracle_text}</div>
                    ) : (
                      detailStatus === 'ok' && <div style={{ opacity: .6 }}>Sin texto disponible.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function close() {
    setSelected(null);
    setDetail(null);
    setDetailStatus('idle');
    setSavingPaid(false);
  }

  function useCurrentAsPaid() {
    setSelected(s => s ? { ...s, paid_eur: s.eur ?? 0 } : s);
  }
}

function money(n) {
  const v = Number(n);
  if (!isFinite(v)) return '—';
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function KpiCard({ title, value, accent }) {
  const color =
    accent === 'pos' ? '#0a7f2e' :
    accent === 'neg' ? '#b00020' : '#111';
  return (
    <div style={kpiCard}>
      <div style={{ fontSize: 12, opacity: .7 }}>{title}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

/* estilos */
const kpiRow = { display: 'flex', gap: 12, alignItems: 'stretch' };
const kpiCard = { border: '1px solid #e5e5e5', borderRadius: 12, padding: 12, minWidth: 140, background: '#fff' };

const btn = { padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e5e5', background: '#f5f5f7', cursor: 'pointer' };

const searchBar = { display: 'flex', alignItems: 'center', gap: 8 };
const searchInput = { flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc' };
const clearBtn = { border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 16, opacity: .5 };
const countBadge = { marginLeft: 'auto', fontSize: 12, padding: '4px 8px', borderRadius: 8, background: '#f5f5f7', border: '1px solid #e5e5e5' };

const listWrap = { maxHeight: '70vh', overflowY: 'auto', border: '1px solid #e5e5e5', borderRadius: 8, background: '#fff' };
const list = { listStyle: 'none', margin: 0, padding: 0 };
const row = { borderBottom: '1px solid #eee', padding: '8px 12px' };
const qtyBadge = { fontSize: 12, background: '#eef5ff', border: '1px solid #cfe1ff', borderRadius: 6, padding: '2px 6px', alignSelf: 'flex-start' };

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 };
const panel = { background: '#fff', borderRadius: 12, maxWidth: 980, width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
const panelHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #eee', background: '#f8f8f8', position: 'sticky', top: 0, zIndex: 2 };
const panelBody = { padding: 16, overflowY: 'auto' };

const leftCol = { flex: '0 0 auto' };
const rightCol = { flex: 1 };
const cardImg = { width: 260, borderRadius: 12, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' };
const noImgBox = { width: 260, height: 360, borderRadius: 12, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' };
const section = { marginBottom: 12 };
const sectionTitle = { fontSize: 14, fontWeight: 700, marginBottom: 6 };
const kv = { fontSize: 13, display: 'flex', gap: 6, alignItems: 'baseline' };
const label = { fontSize: 12, opacity: .8 };
const input = { padding: '8px 10px', borderRadius: 8, border: '1px solid #ccc', width: 160 };
const rulesBox = { fontSize: 13, whiteSpace: 'pre-wrap', background: '#fafafa', borderRadius: 8, padding: 8 };
