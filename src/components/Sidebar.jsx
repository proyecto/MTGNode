import React from 'react';

const items = [
  { key: 'novedades', label: 'Novedades', emoji: '📰' },
  { key: 'seguidas', label: 'Seguidas', emoji: '⭐' },
  { key: 'coleccion', label: 'Mi colección', emoji: '📦' },
  { key: 'colecciones', label: 'Colecciones', emoji: '📚' }
];

export default function Sidebar({ active, onChange }) {
  return (
    <nav style={{ display: 'grid', gap: 8 }}>
      {items.map(it => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          style={btn(active === it.key)}
        >
          <span style={{ marginRight: 8 }}>{it.emoji}</span>{it.label}
        </button>
      ))}
    </nav>
  );
}

function btn(active) {
  return {
    textAlign: 'left',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #e5e5e5',
    background: active ? '#f5f5f7' : '#fff',
    cursor: 'pointer'
  };
}
