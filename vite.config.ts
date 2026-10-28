import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  // React Compiler : mémorise tout seul les composants, pour que seul ce qui
  // change soit redessiné (changement d'onglet, rafraîchissements en fond…).
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  server: {
    // Écoute aussi hors de ce PC, pour ouvrir le site depuis le téléphone via
    // Tailscale (adresse en 100.x.x.x ou nom en .ts.net).
    host: true,
    allowedHosts: ['.ts.net'],
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
