import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy vers le serveur relais (server/index.js, « npm run server ») :
      // le front appelle « /api/... » et Vite relaie vers localhost:3001.
      // Évite les soucis de CORS en dev et marche aussi depuis un téléphone
      // connecté au réseau local.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
