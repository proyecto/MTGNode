import React, { useEffect, useState } from 'react';

// mini parser Markdown muy básico (negrita, cursiva, enlaces, saltos de línea)
function renderMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\n/g, '<br/>');
}

export default function Novedades() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('init');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setStatus('loading');
      setError('');
      const res = await window.api.newsList({ repo: 'proyecto/MTGNode', per_page: 10 }); // ⚠️ ajusta owner/repo real
      if (!res?.ok) {
        setError(res?.error || 'No se pudieron cargar las novedades');
        setStatus('error');
        return;
      }
      setItems(res.items || []);
      setStatus('ok');
    })();
  }, []);

  return (
    <div style={{ display:'grid', gap:12 }}>
      <h2 style={{ margin:0 }}>Novedades</h2>
      <div style={{ fontSize:12, opacity:.7 }}>Últimos cambios y actualizaciones de la aplicación</div>

      {status === 'loading' && <div style={{ opacity:.7 }}>Cargando…</div>}
      {status === 'error' && <div style={errBox}>⚠️ {error}</div>}

      {status === 'ok' && items.length === 0 && (
        <div style={{ opacity:.7 }}>No hay novedades por ahora.</div>
      )}

      {status === 'ok' && items.length > 0 && (
        <ul style={{ listStyle:'none', padding:0, margin:0 }}>
          {items.map(it => (
            <li key={it.id} style={row}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                <div style={{ width:'100%' }}>
                  <div style={{ fontWeight:600, marginBottom:4 }}>
                    {it.title}
                  </div>
                  <div style={{ fontSize:12, opacity:.75, marginBottom:8 }}>
                    {it.user ? `@${it.user} · ` : ''}Actualizado: {new Date(it.updated_at).toLocaleString()}
                  </div>
                  {it.body && (
                    <div
                      style={body}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(it.body) }}
                    />
                  )}
                  {!!it.labels?.length && (
                    <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                      {it.labels.map(lb => (
                        <span key={lb} style={tag}>{lb}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const row = { background:'#fff', border:'1px solid #eee', borderRadius:12, padding:16, marginBottom:10 };
const tag = { fontSize:11, background:'#f5f5f7', border:'1px solid #e5e5e5', borderRadius:8, padding:'2px 8px' };
const body = { fontSize:14, lineHeight:1.5, color:'#333' };
const errBox = { background:'#ffecec', border:'1px solid #ffc9c9', color:'#b00020', padding:10, borderRadius:8 };
