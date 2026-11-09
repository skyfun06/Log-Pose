// Gardien des missions du QG : Claude Code lance ce script avant CHAQUE action
// d'un membre (crochet « PreToolUse », voir lancerMission dans ./index.js).
// Il reçoit l'action en JSON sur l'entrée standard et la bloque (code de
// sortie 2, raison sur la sortie d'erreur) si elle sort des règles :
//   - fichiers : lecture et écriture uniquement dans le dossier equipage ;
//     jamais les .env (clés), jamais les skills ni les listes de comptes ;
//   - terminal : aucun, sauf les commandes exactes prévues pour Robin et Brook ;
//   - connecteurs (Gmail, Docs…) : jamais.
// Deuxième verrou : Claude Code est déjà lancé en mode restreint, qui refuse
// tout ce qui n'est pas autorisé. Le gardien rattrape ce que ce mode laisse
// passer d'office (les commandes « de lecture » comme ls ou cat).

import { isAbsolute, relative, resolve, sep } from 'node:path';

const RACINE = resolve(process.env.QG_RACINE ?? '');
const MEMBRE = process.env.QG_MEMBRE ?? '';

const OUTILS_LIBRES = new Set(['WebSearch', 'WebFetch', 'Skill', 'TodoWrite']);
const OUTILS_FICHIERS = new Set(['Read', 'Grep', 'Glob', 'Write', 'Edit']);

// Terminal : ce que chaque membre a le droit de lancer (1er mot, 2e mot).
const SCRIPTS_RECHERCHE =
  /^\.claude\/skills\/(tiktok-research|instagram-research|video-content-analyzer)\/scripts\/[a-z_]+\.py$/;
const SCRIPT_ANALYSE_VIDEO = '.claude/skills/video-content-analyzer/scripts/analyze_videos.py';
const COMMANDES = {
  robin: (mots) => ['python', 'python3'].includes(mots[0]) && SCRIPTS_RECHERCHE.test(mots[1] ?? ''),
  brook: (mots) =>
    ['ffmpeg', 'ffprobe'].includes(mots[0]) ||
    (['python', 'python3'].includes(mots[0]) && mots[1] === SCRIPT_ANALYSE_VIDEO),
};

function refuser(raison) {
  process.stderr.write(`Refusé par le QG de Log Pose : ${raison}`);
  process.exit(2);
}

function dansEquipage(chemin) {
  const rel = relative(RACINE, resolve(process.env.QG_DOSSIER ?? RACINE, chemin));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

// Fichiers jamais touchés, même dans equipage.
function interdit(chemin, ecriture) {
  const rel = relative(RACINE, resolve(process.env.QG_DOSSIER ?? RACINE, chemin)).split(sep).join('/');
  if (/(^|\/)\.env(\.|$)/.test(rel) && !rel.endsWith('.env.example')) return 'les fichiers .env contiennent des clés';
  if (ecriture && rel.startsWith('recherche/.claude/')) {
    return rel.startsWith('recherche/.claude/context/')
      ? 'la liste des comptes suivis se modifie depuis le panneau du QG (propose les comptes à la place)'
      : 'les skills ne se modifient pas depuis le QG';
  }
  return null;
}

// Découpe une commande en mots (guillemets compris). Les caractères qui
// enchaînent, redirigent ou substituent des commandes sont refusés avant.
function mots(commande) {
  const liste = [];
  for (const m of commande.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) liste.push(m[1] ?? m[2] ?? m[3]);
  return liste;
}

function verifierCommande(commande) {
  const autorise = COMMANDES[MEMBRE];
  if (!autorise) return refuser(`${MEMBRE || 'ce membre'} n'a pas accès au terminal.`);
  if (/[;&|`$<>\n\r(){}\\*?!]/.test(commande)) {
    return refuser('une seule commande simple à la fois (pas de ; && | > $ ou jokers).');
  }
  const m = mots(commande.trim());
  if (!autorise(m)) return refuser(`commande non prévue pour ${MEMBRE} : « ${m[0] ?? ''} ».`);
  // Les arguments ne doivent jamais viser un chemin hors du dossier equipage.
  // (Le script lui-même, 2e mot après « python », est déjà vérifié ci-dessus.)
  for (const arg of m.slice(m[0].startsWith('python') ? 2 : 1)) {
    if (arg.includes('..')) return refuser('pas de « .. » dans les chemins.');
    const absolu = /^[a-zA-Z]:[\\/]/.test(arg) || arg.startsWith('/') || arg.startsWith('~');
    if (absolu && !dansEquipage(arg)) return refuser(`chemin hors du dossier equipage : ${arg}`);
    if (!absolu && arg.includes('/') && !arg.startsWith('-') && interdit(arg, true)) {
      return refuser(interdit(arg, true));
    }
  }
}

let entree = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (entree += d));
process.stdin.on('end', () => {
  let action;
  try {
    action = JSON.parse(entree);
  } catch {
    return refuser('action illisible.');
  }
  const outil = String(action.tool_name ?? '');
  const params = action.tool_input ?? {};

  if (OUTILS_LIBRES.has(outil)) return process.exit(0);
  if (outil === 'Bash') {
    verifierCommande(String(params.command ?? ''));
    return process.exit(0);
  }
  if (OUTILS_FICHIERS.has(outil)) {
    const chemin = params.file_path ?? params.path ?? '.';
    if (!dansEquipage(String(chemin))) return refuser(`hors du dossier equipage : ${chemin}`);
    // Glob accepte aussi un motif absolu (« C:/Users/** ») : vérifié pareil.
    const motif = String(params.pattern ?? '');
    if (outil === 'Glob' && (isAbsolute(motif) || motif.includes('..')) && !dansEquipage(motif)) {
      return refuser(`hors du dossier equipage : ${motif}`);
    }
    const raison = interdit(String(chemin), outil === 'Write' || outil === 'Edit');
    if (raison) return refuser(raison);
    return process.exit(0);
  }
  refuser(`l'outil ${outil} n'est pas autorisé depuis le QG.`);
});
