import React, { useState } from 'react';
import Novedades from './views/Novedades.jsx';
import Seguidas from './views/Seguidas.jsx';
import Coleccion from './views/Coleccion.jsx';
import Colecciones from './views/Colecciones.jsx';
import Sidebar from './components/Sidebar.jsx';

export default function App() {
  const [view, setView] = useState('novedades'); // novedades | seguidas | coleccion | colecciones

  return (
    <div style={appWrap}>
      <aside style={aside}>
        <div style={brand}>MTG Gestor</div>
        <Sidebar active={view} onChange={setView} />
      </aside>

      <main style={main}>
        {view === 'novedades' && <Novedades />}
        {view === 'seguidas' && <Seguidas />}
        {view === 'coleccion' && <Coleccion />}
        {view === 'colecciones' && <Colecciones />}
      </main>
    </div>
  );
}

const appWrap = {
  display: 'grid',
  gridTemplateColumns: '240px 1fr',
  height: '100vh',
  fontFamily: '-apple-system, system-ui, Segoe UI, Roboto, sans-serif',
  background: '#f5f5f7'
};

const aside = {
  borderRight: '1px solid #e8e8e8',
  padding: 16,
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: 12
};

const brand = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 0.2
};

const main = {
  padding: 20,
  overflow: 'auto'
};
