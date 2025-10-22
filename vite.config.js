import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  base: './',            // ← indispensable para assets en file://
  build: { outDir: 'dist' } // o 'build', pero sé consistente
});
