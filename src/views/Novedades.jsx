import React from 'react';

export default function Novedades() {
  return (
    <div style={card}>
      <h2 style={h2}>Novedades</h2>
      <p style={p}>
        Bienvenido. Aquí podrás publicar actualizaciones de la app y del mundo MTG.
      </p>
      <ul style={ul}>
        <li>✔️ Base Electron + React + SQLite funcionando</li>
        <li>✔️ Estructura MVC en el backend lista</li>
        <li>➡️ Próximo: vistas funcionales y acciones (seguir, colección)</li>
      </ul>
    </div>
  );
}

const card = { background:'#fff', padding:20, borderRadius:16, boxShadow:'0 6px 20px rgba(0,0,0,.06)' };
const h2 = { margin:'0 0 8px' };
const p  = { margin:'6px 0 12px', opacity:.8 };
const ul = { margin:0, paddingLeft:18 };
