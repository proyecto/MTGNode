// src/views/Colecciones.jsx
import React, { useEffect, useMemo, useState } from 'react';

export default function Colecciones() {
  // --------- estado base (sets, cartas, búsqueda) ----------
  const [sets, setSets] = useState([]);
  const [selected, setSelected] = useState('');  // código de set
  const [meta, setMeta] = useState(null);        // { code, name, released_at, count }
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState(''); // búsqueda

  // --------- detalle / scryfall extra ----------
  const [selectedCard, setSelectedCard] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle'); // idle|loading|ok|error

  // --------- zoom imagen ----------
  const [imageZoomSrc, setImageZoomSrc] = useState(null);

  // --------- responsive (2 col -> 1 col) ----------
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  // --------- acciones en popup ----------
  const [actionStatus, setActionStatus] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // --------- carga de sets al abrir ----------
  useEffect(() => {
    (async () => {
      const list = await window.api.scrySets();
      setSets(list || []);
      if (list && list.length) setSelected(list[0].code);
    })();
  }, []);

  // --------- carga de cartas del set seleccionado ----------
  useEffect(() => {
    if (!selected) return;
    (async () => {
      setLoading(true);
      const info = await window.api.scrySetInfo(selected);
      setMeta(info || null);
      const rows = await window.api.scryCardsBySet(selected);
      setCards(rows || []);
      setLoading(false);
      setQ(''); // limpiar búsqueda al cambiar de set
    })();
  }, [selected]);

  // --------- utilidades ----------
  const year = useMemo(() => {
    if (!meta?.released_at) return '—';
    const d = new Date(meta.released_at);
    return Number.isNaN(d.getTime()) ? meta.released_at : String(d.getFullYear());
  }, [meta]);

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
  }

  const filtered = useMemo(() => {
    if (!q) return cards;
    const nq = norm(q);
    return cards.filter(c =>
      norm(c.name).includes(nq) ||
      String(c.collector_number || '').toLowerCase().includes(nq)
    );
  }, [q, cards]);

  async function recargarActual() {
    if (!selected) return;
    setLoading(true);
    const info = await window.api.scrySetInfo(selected);
    setMeta(info || null);
    const rows = await window.api.scryCardsBySet(selected);
    setCards(rows || []);
    setLoading(false);
  }

  // --------- abrir/cerrar detalle ----------
  function openDetail(card) {
    console.log('[DETAIL] open', { id: card.id, name: card.name });
    setSelectedCard(card);
  }
  function closeDetail() {
    console.log('[DETAIL] close');
    setSelectedCard(null);
    setDetailData(null);
    setDetailStatus('idle');
    setImageZoomSrc(null);
    setActionStatus('');
    setActionBusy(false);
  }

  // --------- fetch extra a scryfall al abrir el detalle ----------
  useEffect(() => {
    if (!selectedCard) return;
    (async () => {
      console.log('[DETAIL] fetching from Scryfall…');
      setDetailStatus('loading');
      setDetailData(null);
      const res = await window.api.scryCardDetail(selectedCard.id || selectedCard.name);
      if (res?.ok) {
        console.log('[DETAIL] fetched OK');
        setDetailData(res.data);
        setDetailStatus('ok');
      } else {
        console.warn('[DETAIL] fetch error', res?.error);
        setDetailStatus('error');
      }
    })();
  }, [selectedCard]);

  // --------- navegación dentro del popup ----------
  const currentIndex = useMemo(() => (
    selectedCard ? filtered.findIndex(x => x.id === selectedCard.id) : -1
  ), [selectedCard, filtered]);

  function goRel(delta) {
    if (!selectedCard) return;
    const i = currentIndex;
    if (i < 0) return;
    const j = i + delta;
    if (j < 0 || j >= filtered.length) {
      console.log('[DETAIL] nav blocked', { i, delta, len: filtered.length });
      return;
    }
    console.log('[DETAIL] nav', { from: i, to: j, id: filtered[j].id });
    setSelectedCard(filtered[j]);
  }
  const goPrev = () => goRel(-1);
  const goNext = () => goRel(1);

  // --------- acciones rápidas en el popup ----------
  async function addToCollectionFromDetail() {
    if (!selectedCard) return;
    setActionBusy(true);
    setActionStatus('Añadiendo…');
    const res = await window.api.scryAddToCollection({
      name: selectedCard.name,
      set_name: selectedCard.set_name || meta?.name || '',
      rarity: selectedCard.rarity,
      eur: selectedCard.eur,
      qty: 1
    });
    console.log('[DETAIL] addToCollection result', res);
    setActionStatus(res?.ok ? 'Añadida a Mi colección ✅' : `Error al añadir ❌ ${res?.error || ''}`);
    setActionBusy(false);
    setTimeout(() => setActionStatus(''), 2000);
  }

  async function followFromDetail() {
    if (!selectedCard) return;
    setActionBusy(true);
    setActionStatus('Marcando como seguida…');
    const res = await window.api.scryFollow({
      name: selectedCard.name,
      set_name: selectedCard.set_name || meta?.name || '',
      rarity: selectedCard.rarity,
      eur: selectedCard.eur,
      follow: true
    });
    console.log('[DETAIL] follow result', res);
    setActionStatus(res?.ok ? 'Marcada como seguida ⭐' : `Error al seguir ❌ ${res?.error || ''}`);
    setActionBusy(false);
    setTimeout(() => setActionStatus(''), 2000);
  }

  // --------- zoom imagen ----------
  function openImageZoom(src) {
    if (!src) return;
    console.log('[DETAIL] image zoom open');
    setImageZoomSrc(src);
  }
  function closeImageZoom() {
    console.log('[DETAIL] image zoom close');
    setImageZoomSrc(null);
  }

  // --------- render ----------
  return (
    <div style={{ display:'grid', gap:16 }}>
      {/* Selector de set */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <label style={{ fontSize:14, opacity:.8 }}>Colección</label>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          style={select}
        >
          {sets.map(s => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code.toUpperCase()})
            </option>
          ))}
        </select>
        <button onClick={recargarActual} style={btn}>Recargar</button>
      </div>

      {/* Meta del set */}
      <div style={metaBox}>
        <div style={{ fontSize:16, fontWeight:700 }}>
          {meta?.name || '—'} <span style={{ opacity:.6 }}>({meta?.code?.toUpperCase() || '—'})</span>
        </div>
        <div style={{ fontSize:13, opacity:.8 }}>
          Año de publicación: <b>{year}</b> · Número de cartas: <b>{meta?.count ?? 0}</b>
        </div>
      </div>

      {/* Búsqueda */}
      <div style={searchBar}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre o nº"
          style={searchInput}
        />
        {q && <button onClick={() => setQ('')} style={clearBtn} title="Limpiar">✕</button>}
        <div style={countBadge}>
          {loading ? 'Cargando…' : `${filtered.length} de ${cards.length}`}
        </div>
      </div>

      {/* Lista */}
      <div style={listWrap}>
        {loading ? (
          <div style={{ opacity:.7, padding:12 }}>Cargando cartas…</div>
        ) : !cards.length ? (
          <div style={{ opacity:.7, padding:12 }}>No hay cartas en este set.</div>
        ) : filtered.length === 0 ? (
          <div style={{ opacity:.7, padding:12 }}>Sin resultados para “{q}”.</div>
        ) : (
          <ul style={list}>
            {filtered.map(c => (
              <li key={c.id} style={row}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                  <div style={{ display:'flex', gap:12 }}>
                    <div style={numberBadge}>{c.collector_number || '—'}</div>
                    <div>
                      <div
                        style={{ fontWeight:600, cursor:'pointer', color:'#007aff' }}
                        onClick={() => openDetail(c)}
                      >
                        {c.name}
                      </div>
                      <div style={{ fontSize:12, opacity:.75 }}>
                        {c.rarity || '—'}
                        {typeof c.eur === 'number' ? ` · ${c.eur} €` : ''}
                        {typeof c.eur_foil === 'number' ? ` · foil ${c.eur_foil} €` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display:'flex', gap:8 }}>
                    <button
                      onClick={async () => {
                        await window.api.scryAddToCollection({
                          name: c.name,
                          set_name: meta?.name || '',
                          rarity: c.rarity,
                          eur: c.eur,
                          qty: 1
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
                          set_name: meta?.name || '',
                          rarity: c.rarity,
                          eur: c.eur,
                          follow: true
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

      {/* Overlay Detalle */}
      {selectedCard && (
        <div
          role="dialog"
          aria-modal="true"
          style={overlay}
          onClick={(e) => { if (e.target === e.currentTarget) closeDetail(); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeDetail();
            if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
            if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
          }}
          tabIndex={-1}
        >
          <div style={panel}>
            <div style={panelHeader}>
              <div style={{ fontWeight:700, fontSize:16, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {selectedCard.name}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button style={btn} onClick={goPrev} disabled={currentIndex <= 0}>◀︎ Anterior</button>
                <button style={btn} onClick={goNext} disabled={currentIndex < 0 || currentIndex >= filtered.length - 1}>Siguiente ▶︎</button>
                <button style={btn} onClick={addToCollectionFromDetail} disabled={actionBusy}>📦 Añadir</button>
                <button style={btn} onClick={followFromDetail} disabled={actionBusy}>⭐ Seguir</button>
                <button style={btn} onClick={closeDetail}>Cerrar</button>
              </div>
            </div>

            <div style={panelBody}>
              {actionStatus && <div style={statusMsg}>{actionStatus}</div>}

              <div style={{ display:'flex', gap:16, flexDirection: isNarrow ? 'column' : 'row' }}>
                {/* Col izquierda: imagen */}
                <div style={colLeft}>
                  {selectedCard.image_normal ? (
                    <img
                      src={selectedCard.image_normal}
                      alt={selectedCard.name}
                      style={cardImg}
                      onClick={() => openImageZoom(selectedCard.image_normal)}
                    />
                  ) : (
                    <div style={noImgBox}>Sin imagen</div>
                  )}
                </div>

                {/* Col derecha: datos */}
                <div style={colRight}>
                  <div style={section}>
                    <div style={sectionTitle}>Datos</div>
                    <div style={kv}><b>Edición:</b> <span>{selectedCard.set_name || '—'}</span></div>
                    <div style={kv}><b>Número:</b> <span>{selectedCard.collector_number || '—'}</span></div>
                    <div style={kv}><b>Rareza:</b> <span>{selectedCard.rarity || '—'}</span></div>
                    <div style={kv}>
                      <b>Precio:</b>{' '}
                      <span>
                        {typeof selectedCard.eur === 'number' ? `${selectedCard.eur} €` : '—'}{' '}
                        {typeof selectedCard.eur_foil === 'number' ? `(Foil ${selectedCard.eur_foil} €)` : ''}
                      </span>
                    </div>
                    {selectedCard.type_line && (
                      <div style={kv}><b>Tipo:</b> <span>{selectedCard.type_line}</span></div>
                    )}
                  </div>

                  {selectedCard.oracle_text && (
                    <div style={section}>
                      <div style={sectionTitle}>Texto</div>
                      <div style={rulesBox}>{selectedCard.oracle_text}</div>
                    </div>
                  )}

                  <div style={section}>
                    <div style={sectionTitle}>Info ampliada</div>
                    {detailStatus === 'loading' && (
                      <div style={{ fontSize:13, opacity:.8 }}>Cargando datos ampliados…</div>
                    )}
                    {detailStatus === 'error' && (
                      <div style={errorBox}>(DEBUG) Error al cargar detalles.</div>
                    )}
                    {detailStatus === 'ok' && detailData && (
                      <div style={{ display:'grid', gap:6 }}>
                        <div style={kv}><b>Artista:</b> <span>{detailData.artist || '—'}</span></div>
                        <div style={kv}><b>Color identidad:</b> <span>{detailData.color_identity?.join(', ') || '—'}</span></div>
                        <div style={kv}>
                          <b>Legal en:</b>{' '}
                          <span>
                            {Object.entries(detailData.legalities || {})
                              .filter(([_, v]) => v === 'legal')
                              .map(([f]) => f)
                              .join(', ') || '—'}
                          </span>
                        </div>
                        {detailData.flavor_text && (
                          <div style={flavorBox}>“{detailData.flavor_text}”</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay Zoom Imagen */}
      {imageZoomSrc && (
        <div
          style={zoomOverlay}
          onClick={(e) => { if (e.target === e.currentTarget) closeImageZoom(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closeImageZoom(); }}
          tabIndex={-1}
        >
          <img
            src={imageZoomSrc}
            alt="Carta"
            style={zoomImg}
            onClick={(e) => e.stopPropagation()}
          />
          <button style={zoomCloseBtn} onClick={closeImageZoom}>Cerrar</button>
        </div>
      )}
    </div>
  );
}

// ---------------- estilos ----------------
const select = {
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #e5e5e5',
  background: '#fff',
  minWidth: 260
};
const btn = {
  padding:'6px 10px',
  borderRadius:8,
  border:'1px solid #e5e5e5',
  background:'#f5f5f7',
  cursor:'pointer'
};
const metaBox = { background:'#fff', border:'1px solid #eee', borderRadius:12, padding:12 };
const listWrap = { background:'#fff', border:'1px solid #eee', borderRadius:12, height:'60vh', overflowY:'auto' };
const list = { listStyle:'none', padding:0, margin:0 };
const row = { padding:'10px 12px', borderBottom:'1px solid #f0f0f0' };
const numberBadge = { minWidth:44, textAlign:'center', border:'1px solid #eee', borderRadius:8, padding:'6px 8px', background:'#fafafa' };

const searchBar = { display:'grid', gridTemplateColumns:'1fr auto auto', alignItems:'center', gap:8 };
const searchInput = { padding:'10px 12px', borderRadius:10, border:'1px solid #e5e5e5', outline:'none', background:'#fff' };
const clearBtn = { padding:'8px 12px', borderRadius:8, border:'1px solid #e5e5e5', background:'#fff', cursor:'pointer' };
const countBadge = { fontSize:12, opacity:.75, padding:'0 6px' };

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
  width: 'min(860px, 95vw)',
  maxHeight: '85vh',
  overflow: 'hidden',
  background: '#fff',
  border: '1px solid #e5e5e5',
  borderRadius: 12,
  boxShadow: '0 10px 30px rgba(0,0,0,0.15)'
};
const panelHeader = {
  position: 'sticky', top: 0, zIndex: 1,
  display: 'flex', justifyContent:'space-between', alignItems:'center', gap:12,
  padding: 12, background:'#fff', borderBottom:'1px solid #f0f0f0',
  borderTopLeftRadius:12, borderTopRightRadius:12
};
const panelBody = { padding:16, overflowY:'auto', maxHeight:'calc(85vh - 54px)' };

const statusMsg = {
  margin: '0 0 12px 0',
  fontSize: 12,
  background: '#f5faff',
  border: '1px solid #cfe8ff',
  color: '#074b8a',
  padding: '6px 10px',
  borderRadius: 8
};

const colLeft = { minWidth: 223 };
const colRight = { minWidth: 0, flex: 1 };

const cardImg = {
  width: 223, height: 310, objectFit: 'cover',
  borderRadius: 8, border: '1px solid #eee', cursor: 'zoom-in'
};
const noImgBox = {
  width:223, height:310, display:'flex',
  alignItems:'center', justifyContent:'center',
  background:'#fafafa', border:'1px solid #eee', borderRadius:8, color:'#999'
};

const section = { display:'grid', gap:8, marginBottom:16 };
const sectionTitle = { fontSize:12, textTransform:'uppercase', letterSpacing:'.06em', opacity:.7 };
const kv = { display:'flex', gap:6, fontSize:13, alignItems:'baseline', lineHeight:1.4 };
const rulesBox = {
  whiteSpace:'pre-wrap', lineHeight:1.5, fontSize:13,
  background:'#fafafa', padding:8, borderRadius:8, border:'1px solid #eee'
};
const flavorBox = { marginTop:6, fontStyle:'italic', opacity:.85 };

const zoomOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.8)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1100,
  padding: 12
};
const zoomImg = {
  maxWidth: '95vw', maxHeight: '95vh',
  borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display:'block'
};
const zoomCloseBtn = {
  position: 'fixed', top: 16, right: 16,
  padding:'8px 12px', borderRadius:8,
  border:'1px solid rgba(255,255,255,0.35)',
  background:'rgba(255,255,255,0.1)', color:'#fff',
  cursor:'pointer', backdropFilter: 'blur(6px)'
};
