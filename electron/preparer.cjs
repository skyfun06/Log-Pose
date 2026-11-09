// Note le chemin du projet pour l'appli installée (electron/projet.json, non
// commité) : elle y lance le serveur et y trouve le .env et les données.
const fs = require('node:fs');
const path = require('node:path');

const dossier = path.join(__dirname, '..');
fs.writeFileSync(path.join(__dirname, 'projet.json'), JSON.stringify({ dossier }, null, 2));
console.log(`Appli reliée au projet : ${dossier}`);
