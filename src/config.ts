// URL du serveur relais (backend qui cache la clé API Anthropic).
// Par défaut vide = même origine : en dev, le front appelle « /api/... » et le
// proxy Vite (voir vite.config.ts) relaie vers http://localhost:3001. Ça évite
// tout souci de CORS et ça marche aussi depuis un téléphone sur le réseau local.
// Surchargeable via la variable d'environnement Vite VITE_API_URL au besoin
// (ex : URL du serveur déployé en prod).
export const API_URL = import.meta.env.VITE_API_URL ?? '';
