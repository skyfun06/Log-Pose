// URL du serveur relais (backend qui cache la clé API).
// Surchargeable via la variable d'environnement Vite VITE_API_URL au besoin.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
