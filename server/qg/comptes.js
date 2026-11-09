// Comptes suivis par Robin (onglet QG) : les tableaux de
// equipage/recherche/.claude/context/tiktok-accounts.md et instagram-accounts.md,
// ceux que lisent ses skills de recherche. Seul le capitaine les modifie
// (depuis le panneau de Robin) : Robin, lui, propose des comptes à la fin de
// ses missions, dans un bloc « comptes-proposes ».
//
// Format attendu par les scripts : une ligne « | Username | … » d'en-tête, puis
// une ligne par compte dont la 1re colonne commence par « @ ».

import { readFile, rename, writeFile } from 'node:fs/promises';

export class ErreurQG extends Error {
  constructor(statut, message) {
    super(message);
    this.statut = statut;
  }
}

const RACINE = (process.env.QG_EQUIPAGE ?? 'C:/Users/Borrelli/Desktop/dev/business/equipage').replace(/\\/g, '/');
const FICHIERS = {
  tiktok: `${RACINE}/recherche/.claude/context/tiktok-accounts.md`,
  instagram: `${RACINE}/recherche/.claude/context/instagram-accounts.md`,
};
export const PLATEFORMES_COMPTES = Object.keys(FICHIERS);

const ENTETE = {
  tiktok: '# Comptes TikTok suivis',
  instagram: '# Comptes Instagram suivis',
};
const INTRO = 'Robin propose des comptes, le capitaine valide. Garder 5 à 15 comptes de la même niche.';

function plateformeValide(p) {
  if (!Object.hasOwn(FICHIERS, p)) throw new ErreurQG(400, `Plateforme inconnue : ${p}`);
  return p;
}

// « @Pseudo », « pseudo », « tiktok.com/@pseudo » → « @pseudo ».
export function normaliserPseudo(brut) {
  const s = String(brut ?? '').trim().replace(/^https?:\/\/[^/]+\//i, '').replace(/^@/, '').replace(/\/.*$/, '');
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) throw new ErreurQG(400, `Pseudo invalide : « ${brut} » (lettres, chiffres, points et _ seulement).`);
  return `@${s.toLowerCase()}`;
}

// Une cellule de tableau Markdown : pas de « | » ni de retour à la ligne.
const cellule = (s, max = 140) => String(s ?? '').replace(/[|\s]+/g, ' ').trim().slice(0, max);

async function lireFichier(p) {
  try {
    return (await readFile(FICHIERS[p], 'utf8')).replace(/\r\n/g, '\n');
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
    return `${ENTETE[p]}\n\n${INTRO}\n\n| Username | Niche | Notes |\n|----------|-------|-------|\n`;
  }
}

function analyser(texte) {
  const lignes = texte.split('\n');
  const debut = lignes.findIndex((l) => /^\|\s*(Username|Handle)\b/i.test(l.trim()));
  const comptes = [];
  if (debut < 0) return { avant: lignes, comptes, apres: [] };
  let fin = debut + 1;
  for (; fin < lignes.length; fin++) {
    const l = lignes[fin].trim();
    if (!l.startsWith('|')) break;
    if (/^\|\s*-/.test(l)) continue;
    const parties = l.split('|').slice(1, -1).map((x) => x.trim());
    if (parties[0]?.startsWith('@') && !parties[0].startsWith('@example')) {
      comptes.push({ pseudo: parties[0], niche: parties[1] ?? '', note: parties[2] ?? '' });
    }
  }
  return { avant: lignes.slice(0, debut), comptes, apres: lignes.slice(fin) };
}

async function ecrireFichier(p, avant, comptes, apres) {
  const tableau = [
    '| Username | Niche | Notes |',
    '|----------|-------|-------|',
    ...comptes.map((c) => `| ${c.pseudo} | ${cellule(c.niche, 60)} | ${cellule(c.note)} |`),
  ];
  const texte = [...avant, ...tableau, ...apres].join('\n').replace(/\n*$/, '\n');
  const temporaire = `${FICHIERS[p]}.tmp`;
  await writeFile(temporaire, texte, 'utf8');
  await rename(temporaire, FICHIERS[p]);
}

// Une modification à la fois (deux clics rapides ne s'écrasent pas).
let file = Promise.resolve();
function enFile(tache) {
  const suite = file.catch(() => {}).then(tache);
  file = suite;
  return suite;
}

export async function lireComptes() {
  const tout = {};
  for (const p of PLATEFORMES_COMPTES) tout[p] = analyser(await lireFichier(p)).comptes;
  return tout;
}

export function ajouterCompte(plateforme, pseudo, note = '', niche = '') {
  const p = plateformeValide(plateforme);
  const nouveau = { pseudo: normaliserPseudo(pseudo), niche: cellule(niche, 60), note: cellule(note) };
  return enFile(async () => {
    const { avant, comptes, apres } = analyser(await lireFichier(p));
    if (comptes.some((c) => c.pseudo.toLowerCase() === nouveau.pseudo)) {
      throw new ErreurQG(409, `${nouveau.pseudo} est déjà suivi sur ${p === 'tiktok' ? 'TikTok' : 'Instagram'}.`);
    }
    await ecrireFichier(p, avant, [...comptes, nouveau], apres);
    return lireComptes();
  });
}

export function retirerCompte(plateforme, pseudo) {
  const p = plateformeValide(plateforme);
  const cible = normaliserPseudo(pseudo);
  return enFile(async () => {
    const { avant, comptes, apres } = analyser(await lireFichier(p));
    await ecrireFichier(p, avant, comptes.filter((c) => c.pseudo.toLowerCase() !== cible), apres);
    return lireComptes();
  });
}

// Retire le bloc « comptes-proposes » de la réponse de Robin et le lit :
//   ```comptes-proposes
//   tiktok | @pseudo | pourquoi
//   ```
export function extraireComptesProposes(texte) {
  const comptes = [];
  const propre = texte.replace(/```comptes-proposes\s*\n([\s\S]*?)```/g, (_, bloc) => {
    for (const ligne of bloc.split('\n')) {
      const [plateforme, pseudo, ...note] = ligne.split('|').map((x) => x.trim());
      if (!plateforme || !pseudo) continue;
      try {
        const p = plateformeValide(plateforme.toLowerCase());
        const c = { plateforme: p, pseudo: normaliserPseudo(pseudo), note: cellule(note.join(' ')) };
        if (!comptes.some((x) => x.plateforme === c.plateforme && x.pseudo === c.pseudo)) comptes.push(c);
      } catch {
        /* ligne mal formée : ignorée */
      }
    }
    return '';
  });
  return { texte: propre.trim(), comptes: comptes.slice(0, 10) };
}
