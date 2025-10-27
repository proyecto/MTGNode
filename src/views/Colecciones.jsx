// src/views/Colecciones.jsx
import React, { useEffect, useMemo, useState } from 'react';

export default function Colecciones() {
  // --------- estado base ----------
  const [sets, setSets] = useState([]);
  const [selected, setSelected] = useState('');
  const [meta, setMeta] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  // --------- búsqueda global ----------
  const [globalMode, setGlobalMode] = useState(false);
  const [globalItems, setGlobalItems] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  // --------- detalle / scryfall extra ----------
  const [selectedCard, setSelectedCard] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');

  // --------- zoom imagen ----------
  const [imageZoomSrc, setImageZoomSrc] = useState(null);

  // --------- responsive ----------
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)');
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  // --------- acciones ----------
  const [actionStatus, setActionStatus] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // --------- carga sets ----------
  useEffect(() => {
    (async () => {
      const list = await window.api.scrySets();
      setSets(list || []);
      if (list && list.length) setSelected(list[0].code);
    })();
  }, []);

  // --------- carga cartas del set ----------
  useEffect(() => {
    if (!selected) return;
    (async () => {
      setLoading(true);
      const info = await window.api.scrySetInfo(selected);
      setMeta(info || null);
      const rows = await window.api.scryCardsBySet(selected);
      setCards(rows || []);
      setLoading(false);
      setQ('');
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

  const listSource = globalMode ? globalItems : filtered;

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

  // --------- fetch scryfall ----------
  useEffect(() => {
    if (!selectedCard) return;
    (async () => {
      console.log('[DETAIL] fetching from Scryfall…');
      setDetailStatus('loading');
      setDetailData(null);
      const res = await window.api.scryCardDetail(selectedCard.id || selectedCard.name);
      if (res?.ok) {
        setDetailData(res.data);
        setDetailStatus('ok');
      } else {
        console.warn('[DETAIL] fetch error', res?.error);
        setDetailStatus('error');
      }
    })();
  }, [selectedCard]);

  // --------- navegación ----------
  const currentIndex = useMemo(() => (
    selectedCard ? listSource.findIndex(x => x.id === selectedCard.id) : -1
  ), [selectedCard, listSource]);

  function goRel(delta) {
    if (!selectedCard) return;
    const i = currentIndex;
    if (i < 0) return;
    const j = i + delta;
    if (j < 0 || j >= listSource.length) return;
    setSelectedCard(listSource[j]);
  }
  const goPrev = () => goRel(-1);
  const goNext = () => goRel(1);

  // --------- acciones rápidas ----------
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
    setActionStatus(res?.ok ? 'Añadida a Mi colección ✅' : `Error ❌ ${res?.error || ''}`);
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
    setActionStatus(res?.ok ? 'Marcada como seguida ⭐' : `Error ❌ ${res?.error || ''}`);
    setActionBusy(false);
    setTimeout(() => setActionStatus(''), 2000);
  }

  // --------- zoom ----------
  function openImageZoom(src) { if (src) setImageZoomSrc(src); }
  function closeImageZoom() { setImageZoomSrc(null); }

  // --------- render ----------
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Selector de set */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 14, opacity: .8 }}>Colección</label>
        <select
          value={selected}
          onChange={e => { setSelected(e.target.value); setGlobalMode(false); }}
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
      {!globalMode && (
        <div style={metaBox}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {meta?.name || '—'} <span style={{ opacity: .6 }}>({meta?.code?.toUpperCase() || '—'})</span>
          </div>
          <div style={{ fontSize: 13, opacity: .8 }}>
            Año de publicación: <b>{year}</b> · Cartas: <b>{meta?.count ?? 0}</b>
          </div>
        </div>
      )}

      {/* Meta global */}
      {globalMode && (
        <div style={{ ...metaBox, background: '#f5faff', borderColor: '#cfe8ff' }}>
          <div style={{ fontWeight: 700 }}>Resultados globales para “{q}”</div>
          <div style={{ fontSize: 13, opacity: .8 }}>
            Coincidencias: <b>{globalItems.length}</b> · Todas las colecciones
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div style={searchBar}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por nombre o nº"
          style={searchInput}
        />
        {q && <button onClick={() => setQ('')} style={clearBtn} title="Limpiar">✕</button>}

        <button
          onClick={async () => {
            if (!q.trim()) { alert('Introduce un término de búsqueda'); return; }
            setGlobalLoading(true);
            const res = await window.api.scrySearchByName({ q, limit: 100 });
            setGlobalLoading(false);
            if (res?.ok) {
              setGlobalItems(res.items || []);
              setGlobalMode(true);
              console.log('[GLOBAL SEARCH] ok', { q, total: res.total });
              alert(`(Global) ${res.total} coincidencias para “${q}”`);
            } else {
              alert(`(Global) Error: ${res?.error || 'desconocido'}`);
            }
          }}
          style={btn}
        >
          Buscar global
        </button>

        {globalMode && (
          <button
            onClick={() => { setGlobalMode(false); setGlobalItems([]); }}
            style={btn}
          >
            Salir búsqueda global
          </button>
        )}

        <div style={countBadge}>
          {globalMode
            ? (globalLoading ? 'Buscando…' : `${listSource.length} resultados globales`)
            : (loading ? 'Cargando…' : `${filtered.length} de ${cards.length}`)}
        </div>
      </div>

      {/* Lista */}
      <div style={listWrap}>
        {globalMode ? (
          globalLoading ? (
            <div style={{ opacity: .7, padding: 12 }}>Buscando en todas las colecciones…</div>
          ) : listSource.length === 0 ? (
            <div style={{ opacity: .7, padding: 12 }}>Sin resultados globales para “{q}”.</div>
          ) : (
            <ul style={list}>
              {listSource.map(c => (
                <li key={c.id} style={row}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={numberBadge}>{c.collector_number || '—'}</div>
                      <div>
                        <div
                          style={{ fontWeight: 600, cursor: 'pointer', color: '#007aff' }}
                          onClick={() => openDetail(c)}
                        >
                          {c.name}
                        </div>
                        <div style={{ fontSize: 12, opacity: .75 }}>
                          {c.set_name || '—'} · {c.rarity || '—'}
                          {typeof c.eur === 'number' ? ` · ${c.eur} €` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          loading ? (
            <div style={{ opacity: .7, padding: 12 }}>Cargando cartas…</div>
          ) : !cards.length ? (
            <div style={{ opacity: .7, padding: 12 }}>No hay cartas en este set.</div>
          ) : filtered.length === 0 ? (
            <div style={{ opacity: .7, padding: 12 }}>Sin resultados para “{q}”.</div>
          ) : (
            <ul style={list}>
              {listSource.map(c => (
                <li key={c.id} style={row}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={numberBadge}>{c.collector_number || '—'}</div>
                      <div>
                        <div
                          style={{ fontWeight: 600, cursor: 'pointer', color: '#007aff' }}
                          onClick={() => openDetail(c)}
                        >
                          {c.name}
                        </div>
                        <div style={{ fontSize: 12, opacity: .75 }}>
                          {c.rarity || '—'}
                          {typeof c.eur === 'number' ? ` · ${c.eur} €` : ''}
                          {typeof c.eur_foil === 'number' ? ` · foil ${c.eur_foil} €` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
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
              <div style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedCard.name}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button style={btn} onClick={goPrev} disabled={currentIndex <= 0}>◀︎ Anterior</button>
                <button style={btn} onClick={goNext} disabled={currentIndex >= listSource.length - 1}>Siguiente ▶︎</button>
                <button style={btn} onClick={addToCollectionFromDetail} disabled={actionBusy}>📦 Añadir</button>
                <button style={btn} onClick={followFromDetail} disabled={actionBusy}>⭐ Seguir</button>
                <button style={btn} onClick={closeDetail}>Cerrar</button>
              </div>
            </div>

            <div style={panelBody}>
              {actionStatus && <div style={statusMsg}>{actionStatus}</div>}

              <div style={{ display: 'flex', gap: 16, flexDirection: isNarrow ? 'column' : 'row' }}>
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
                      <div style={{ fontSize: 13, opacity: .8 }}>Cargando datos ampliados…</div>
                    )}
                    {detailStatus === 'error' && (
                      <div style={errorBox}>Error al cargar detalles.</div>
                    )}
                    {detailStatus === 'ok' && detailData && (
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={kv}><b>Artista:</b> <span>{detailData.artist || '—'}</span></div>
                        <div style={kv}><b>Color identidad:</b> <span>{detailData.color_identity?.join(', ') || '—'}</span></div>
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

      {/* Zoom Imagen */}
      {imageZoomSrc && (
        <div
          style={zoomOverlay}
          onClick={(e) => { if (e.target === e.currentTarget) closeImageZoom(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') closeImageZoom(); }}
          tabIndex={-1}
        >
          <img src={imageZoomSrc} alt="Carta" style={zoomImg} onClick={(e) => e.stopPropagation()} />
          <button style={zoomCloseBtn} onClick={closeImageZoom}>Cerrar</button>
        </div>
      )}
    </div>
  );
}

// ---------------- estilos ----------------
const select = { padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e5e5' };

const btn = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid #e5e5e5',
  background: '#f5f5f7',
  cursor: 'pointer'
};

const countBadge = {
  marginLeft: 'auto',
  fontSize: 12,
  padding: '4px 8px',
  borderRadius: 8,
  background: '#f5f5f7',
  border: '1px solid #e5e5e5'
};

const metaBox = {
  border: '1px solid #ddd',
  borderRadius: 12,
  padding: 12,
  background: '#fafafa'
};

const searchBar = {
  display: 'flex',
  alignItems: 'center',
  gap: 8
};

const searchInput = {
  flex: 1,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid #ccc'
};

const clearBtn = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 16,
  opacity: .5
};

const listWrap = {
  maxHeight: '70vh',
  overflowY: 'auto',
  border: '1px solid #e5e5e5',
  borderRadius: 8,
  background: '#fff'
};

const list = {
  listStyle: 'none',
  margin: 0,
  padding: 0
};

const row = {
  borderBottom: '1px solid #eee',
  padding: '8px 12px'
};

const numberBadge = {
  fontSize: 12,
  background: '#f1f1f1',
  borderRadius: 6,
  padding: '2px 6px',
  alignSelf: 'flex-start'
};

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
  padding: 20
};

const panel = {
  background: '#fff',
  borderRadius: 12,
  maxWidth: 900,
  width: '100%',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
};

const panelHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 14px',
  borderBottom: '1px solid #eee',
  background: '#f8f8f8',
  position: 'sticky',
  top: 0,
  zIndex: 2
};

const panelBody = {
  padding: 16,
  overflowY: 'auto'
};

const statusMsg = {
  margin: '0 0 12px 0',
  fontSize: 12,
  background: '#f5faff',
  border: '1px solid #cfe8ff',
  color: '#074b8a',
  padding: '6px 10px',
  borderRadius: 8
};

const colLeft = { flex: '0 0 auto' };
const colRight = { flex: 1 };

const cardImg = {
  width: 260,
  borderRadius: 12,
  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  cursor: 'zoom-in'
};

const noImgBox = {
  width: 260,
  height: 360,
  borderRadius: 12,
  background: '#f5f5f5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#888'
};

const section = { marginBottom: 12 };
const sectionTitle = { fontSize: 14, fontWeight: 700, marginBottom: 6 };
const kv = { fontSize: 13, display: 'flex', gap: 6 };
const rulesBox = { fontSize: 13, whiteSpace: 'pre-wrap', background: '#fafafa', borderRadius: 8, padding: 8 };
const flavorBox = { fontStyle: 'italic', opacity: .8, marginTop: 6 };
const errorBox = { fontSize: 13, color: '#b00020' };

const zoomOverlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.8)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 2000
};

const zoomImg = {
  maxHeight: '90vh',
  maxWidth: '90vw',
  borderRadius: 12,
  boxShadow: '0 2px 10px rgba(0,0,0,0.6)'
};

const zoomCloseBtn = {
  position: 'fixed',
  top: 20,
  right: 20,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid #fff',
  background: 'rgba(255,255,255,0.2)',
  color: '#fff',
  cursor: 'pointer',
  fontWeight: 600
};
