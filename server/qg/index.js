// Onglet « QG » : le capitaine confie une mission à un membre de l'équipage
// (Nami, Robin, Franky, Brook, Zoro), et le serveur lance Claude Code sur ce
// PC avec la fiche de ce membre, sans interface (« claude -p »).
//
// Trois garanties :
//   1. L'abonnement Claude, jamais l'API payante : toutes les variables
//      ANTHROPIC_* (dont la clé du .env) sont retirées pour Claude Code, et la
//      mission s'arrête net si Claude Code annonce quand même une clé API
//      (champ apiKeySource du message de démarrage).
//   2. Bac à sable : Claude Code en mode restreint (--restricted), outils
//      limités, tout le reste refusé (dontAsk), fichiers confinés au dossier
//      equipage, et le gardien (./garde.js) qui vérifie chaque action.
//   3. Le quota : une mission à la fois par membre, 2 membres au travail
//      maximum, 30 minutes maximum par mission.
//
// Les fiches des membres restent dans ~/.claude/agents/ : elles sont relues
// à chaque mission, donc une fiche modifiée sert dès la mission suivante.

import { spawn, execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ErreurQG, extraireComptesProposes } from './comptes.js';

export { ErreurQG };

// --- Réglages faciles à changer -------------------------------------------

export const RACINE = (process.env.QG_EQUIPAGE ?? 'C:/Users/Borrelli/Desktop/dev/business/equipage').replace(/\\/g, '/');
const RECHERCHE = `${RACINE}/recherche`;
const AGENTS = join(homedir(), '.claude', 'agents');

const MAX_EN_MEME_TEMPS = 2;
const DUREE_MAX = 30 * 60 * 1000;
const MAX_HISTORIQUE = 300;
const MAX_ACTIVITES = 40;

// Outils permis depuis le QG. Chaque membre garde en plus les limites de sa
// propre fiche (Zoro, par exemple, ne fait que lire).
const OUTILS_QG = ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'WebSearch', 'WebFetch'];

export const MEMBRES = {
  nami: { nom: 'Nami', poste: 'Navigatrice' },
  robin: {
    nom: 'Robin',
    poste: 'Archéologue',
    dossier: RECHERCHE, // les scripts de recherche se lancent depuis ce dossier
    terminal: ['Bash(python .claude/skills/*)', 'Bash(python3 .claude/skills/*)'],
    consigne: `- Terminal : tu peux lancer UNIQUEMENT les scripts Python des skills, depuis le dossier de travail (equipage/recherche), une commande simple à la fois, avec « python » (pas « python3 ») : par exemple « python .claude/skills/tiktok-research/scripts/fetch_tiktok.py --days 30 -o tiktok-research/AAAA-MM-JJ_HHMM/raw.json ». Les scripts créent eux-mêmes leurs dossiers de sortie : pas de mkdir, pas de « python -c », pas de && ni de variables. Tout le reste est refusé.
- Comptes suivis : la liste est dans .claude/context/tiktok-accounts.md et instagram-accounts.md. Tu peux la lire, jamais la modifier : c'est le capitaine qui l'édite depuis le QG. Si tu repères des comptes intéressants, PROPOSE-LES tout à la fin de ta réponse dans ce bloc exact (une ligne par compte, 5 maximum) :
\`\`\`comptes-proposes
tiktok | @pseudo | pourquoi en quelques mots
instagram | @pseudo | pourquoi en quelques mots
\`\`\`
  Le capitaine les ajoute ou les ignore d'un clic.`,
  },
  franky: {
    nom: 'Franky',
    poste: 'Charpentier',
    consigne: `- Depuis le QG, tu ne touches à AUCUN code : tu n'as accès qu'au dossier equipage. Tu évalues, tu estimes et tu prépares des plans. Si tu écris un plan, range-le dans equipage/franky/. Le code se fait ensuite avec le capitaine dans Claude Code, au terminal.`,
  },
  brook: {
    nom: 'Brook',
    poste: 'Musicien',
    dossier: RECHERCHE,
    terminal: [
      'Bash(ffmpeg *)',
      'Bash(ffprobe *)',
      'Bash(python .claude/skills/video-content-analyzer/*)',
      'Bash(python3 .claude/skills/video-content-analyzer/*)',
    ],
    consigne: `- Terminal : tu peux lancer UNIQUEMENT ffmpeg, ffprobe et le script d'analyse vidéo (« python .claude/skills/video-content-analyzer/scripts/analyze_videos.py … »), une commande simple à la fois (pas de && ni de |), avec des fichiers situés dans le dossier equipage. Les vidéos à analyser doivent y être déposées (par exemple dans equipage/brook/videos/). Tout le reste est refusé.`,
  },
  zoro: { nom: 'Zoro', poste: 'Bretteur' },
};

const CONSIGNES_QG = (membre) => `

## Mission lancée depuis le QG de Log Pose

- Le capitaine n'est pas là pour te répondre pendant la mission : si la demande est floue, prends l'interprétation la plus logique et dis laquelle en une ligne.
- Tu peux lire et écrire UNIQUEMENT dans ${RACINE}. Tu ne modifies jamais de code, tu ne supprimes rien, tu ne publies et n'envoies rien.
- Une action refusée par le QG l'est volontairement : ne cherche pas à la contourner, signale ce qui t'a manqué.
${MEMBRES[membre].consigne ?? ''}
- Ta réponse finale est affichée dans Log Pose : rends un travail fini, en Markdown simple (titres, listes, tableaux), sans récit de ce que tu as essayé.`;

// --- Lancer Claude Code -----------------------------------------------------

// claude.exe installé par npm (le « claude » du terminal n'est qu'un raccourci
// vers lui) ; sinon l'installation native ; sinon la commande telle quelle.
export function cheminClaude() {
  const candidats = [
    process.env.QG_CLAUDE,
    process.env.APPDATA && join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'),
    join(homedir(), '.local', 'bin', process.platform === 'win32' ? 'claude.exe' : 'claude'),
  ];
  return candidats.find((c) => c && existsSync(c)) ?? 'claude';
}

// Variables retirées : la clé API et tout réglage de connexion Anthropic (pour
// rester sur l'abonnement), et les secrets de Log Pose (Gmail, TikTok…) dont
// une mission n'a pas besoin.
const VARIABLES_RETIREES =
  /^(ANTHROPIC_|CLAUDE_CODE_USE_|AWS_BEARER_TOKEN|GMAIL_|TIKTOK_|INSTAGRAM_|OLLAMA_|CERVEAU_|CLAUDECODE$|CLAUDE_CODE_ENTRYPOINT$)/;

export function environnement(membre, dossier) {
  const env = {};
  for (const [cle, valeur] of Object.entries(process.env)) {
    if (!VARIABLES_RETIREES.test(cle)) env[cle] = valeur;
  }
  return {
    ...env,
    QG_MEMBRE: membre,
    QG_RACINE: RACINE,
    QG_DOSSIER: dossier,
    // Les scripts Python lisent les listes de comptes sans préciser
    // l'encodage : sans ça, un accent ou un émoji dans une note les ferait planter.
    PYTHONUTF8: '1',
  };
}

// Fiche d'un membre : en-tête (outils, modèle…) + texte.
async function lireFiche(membre) {
  const texte = (await readFile(join(AGENTS, `${membre}.md`), 'utf8')).replace(/\r\n/g, '\n');
  const m = texte.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new ErreurQG(500, `Fiche de ${MEMBRES[membre].nom} illisible (${membre}.md).`);
  const entete = {};
  for (const ligne of m[1].split('\n')) {
    const i = ligne.indexOf(':');
    if (i > 0) entete[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
  }
  return { entete, texte: m[2] };
}

async function argumentsMission(membre) {
  const { entete, texte } = await lireFiche(membre);
  const infos = MEMBRES[membre];
  const dossier = infos.dossier ?? RACINE;
  // Outils : ceux de la fiche (toutes si non précisés), dans la limite du QG.
  const deLaFiche = entete.tools ? entete.tools.split(',').map((o) => o.trim()) : null;
  const outils = OUTILS_QG.filter((o) => !deLaFiche || deLaFiche.includes(o));
  if (infos.terminal && (!deLaFiche || deLaFiche.includes('Bash'))) outils.push('Bash');
  if (infos.terminal && (!deLaFiche || deLaFiche.includes('Skill'))) outils.push('Skill');

  const R = `/${RACINE.replace(/^([a-zA-Z]):/, (_, l) => `/${l.toLowerCase()}`)}`; // //c/Users/... (format des règles)
  const autorises = outils
    .filter((o) => o !== 'Bash')
    .map((o) => (o === 'Write' || o === 'Edit' ? `${o}(${R}/**)` : o));
  if (outils.includes('Bash')) autorises.push(...infos.terminal);

  const garde = fileURLToPath(new URL('./garde.js', import.meta.url)).replace(/\\/g, '/');
  const reglages = {
    hooks: {
      PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: `"${process.execPath.replace(/\\/g, '/')}" "${garde}"` }] }],
    },
  };
  const agent = { description: entete.description ?? infos.poste, prompt: texte + CONSIGNES_QG(membre), tools: outils };

  return {
    dossier,
    modele: entete.model,
    args: [
      '-p',
      '--agents', JSON.stringify({ [membre]: agent }),
      '--agent', membre,
      ...(entete.model ? ['--model', entete.model] : []),
      '--restricted',
      '--strict-mcp-config',
      '--settings', JSON.stringify(reglages),
      '--tools', outils.join(','),
      '--allowedTools', ...autorises,
      '--permission-mode', 'dontAsk',
      ...(dossier !== RACINE ? ['--add-dir', RACINE] : []),
      '--output-format', 'stream-json',
      '--verbose',
      '--no-session-persistence',
    ],
  };
}

// Arrête Claude Code ET ce qu'il a lancé (script Python, ffmpeg…). Sous
// Windows, tuer le processus seul laisserait tourner ses enfants.
export function arreter(enfant) {
  if (!enfant || enfant.exitCode !== null) return;
  if (process.platform === 'win32') execFile('taskkill', ['/pid', String(enfant.pid), '/T', '/F'], () => {});
  else enfant.kill('SIGTERM');
}

// --- Ce que fait le membre, en mots simples ---------------------------------

const court = (s, n = 60) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const nomFichier = (p) => String(p ?? '').split(/[\\/]/).filter(Boolean).pop() ?? '';

function decrireOutil(nom, entree = {}) {
  switch (nom) {
    case 'Read': return `lit ${nomFichier(entree.file_path)}`;
    case 'Write': return `écrit ${nomFichier(entree.file_path)}`;
    case 'Edit': return `modifie ${nomFichier(entree.file_path)}`;
    case 'Grep': return `cherche « ${court(entree.pattern, 30)} » dans les fichiers`;
    case 'Glob': return 'parcourt les fichiers';
    case 'WebSearch': return `cherche sur le web : ${court(entree.query, 50)}`;
    case 'WebFetch': {
      try {
        return `lit la page ${new URL(entree.url).hostname}`;
      } catch {
        return 'lit une page web';
      }
    }
    case 'Bash': {
      const cmd = String(entree.command ?? '');
      if (/^ffmpeg|^ffprobe/.test(cmd)) return 'travaille la vidéo (ffmpeg)';
      const script = cmd.match(/scripts\/([a-z_]+)\.py/)?.[1];
      return script ? `lance le script ${script}` : 'lance une commande';
    }
    case 'Skill': return `ouvre le skill ${entree.skill ?? ''}`.trim();
    case 'TodoWrite': return 'organise son travail';
    default: return `utilise ${nom}`;
  }
}

// --- État : membres au travail + historique ---------------------------------

const FICHIER_HISTORIQUE = new URL('../.qg-historique.json', import.meta.url);
let historique = null; // missions, la plus récente en premier
const enCours = new Map(); // membre → { mission, enfant, minuterie }
let quota = null; // dernier état du quota de l'abonnement remonté par Claude Code
const abonnes = new Set(); // flux en direct ouverts (onglet QG)

async function chargerHistorique() {
  if (historique) return historique;
  try {
    historique = JSON.parse(await readFile(FICHIER_HISTORIQUE, 'utf8'));
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
    historique = [];
  }
  // Missions coupées par un arrêt du serveur.
  for (const m of historique) {
    if (m.statut === 'travail') Object.assign(m, { statut: 'erreur', erreur: 'Log Pose a été fermé pendant la mission.', fin: m.fin ?? m.debut });
  }
  return historique;
}

let ecriture = Promise.resolve();
function sauver() {
  ecriture = ecriture
    .catch(() => {})
    .then(async () => {
      const temporaire = new URL('../.qg-historique.json.tmp', import.meta.url);
      await writeFile(temporaire, JSON.stringify(historique.slice(0, MAX_HISTORIQUE)));
      await rename(temporaire, FICHIER_HISTORIQUE);
    });
  return ecriture;
}

// Statut affiché : au travail, sinon celui de sa dernière mission du jour
// (fini / erreur), sinon en pause.
function statutDe(membre) {
  if (enCours.has(membre)) return 'travail';
  const derniere = historique?.find((m) => m.membre === membre);
  if (!derniere || derniere.vue) return 'pause';
  return derniere.statut === 'fini' ? 'fini' : derniere.statut === 'erreur' ? 'erreur' : 'pause';
}

export async function etatQG() {
  await chargerHistorique();
  return {
    membres: Object.entries(MEMBRES).map(([id, { nom, poste }]) => {
      const actif = enCours.get(id)?.mission;
      return {
        id,
        nom,
        poste,
        statut: statutDe(id),
        missionId: actif?.id ?? historique.find((m) => m.membre === id)?.id ?? null,
        activite: actif?.activites.at(-1)?.texte ?? null,
        depuis: actif?.debut ?? null,
      };
    }),
    auTravail: enCours.size,
    max: MAX_EN_MEME_TEMPS,
    quota,
    ...Object.assign({}, ...etatsEnPlus.map((lire) => lire())),
  };
}

export async function diffuser() {
  const message = `data: ${JSON.stringify(await etatQG())}\n\n`;
  for (const res of abonnes) res.write(message);
}

// Flux en direct (Server-Sent Events) : l'état complet à chaque changement.
export async function suivre(req, res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  abonnes.add(res);
  res.write(`data: ${JSON.stringify(await etatQG())}\n\n`);
  // Petit signe de vie régulier : garde la connexion ouverte à travers les proxys.
  const battement = setInterval(() => res.write(': ok\n\n'), 25000);
  req.on('close', () => {
    clearInterval(battement);
    abonnes.delete(res);
  });
}

export async function missions(membre) {
  await chargerHistorique();
  return membre ? historique.filter((m) => m.membre === membre) : historique;
}

export async function mission(id) {
  await chargerHistorique();
  const m = historique.find((x) => x.id === id);
  if (!m) throw new ErreurQG(404, 'Mission introuvable.');
  return m;
}

// Le capitaine a vu le résultat : le membre repasse en pause.
export async function marquerVue(id) {
  const m = await mission(id);
  if (m.statut !== 'travail' && !m.vue) {
    m.vue = true;
    await sauver();
    void diffuser();
  }
  return m;
}

// --- Une mission -----------------------------------------------------------

// interne : mission lancée par un parcours (consigne plus longue permise :
// elle contient le travail de l'étape précédente).
export async function lancerMission(membre, texte, { interne = false, parcoursId = null } = {}) {
  if (!Object.hasOwn(MEMBRES, membre)) throw new ErreurQG(404, `Membre inconnu : ${membre}`);
  const consigne = String(texte ?? '').trim();
  if (!consigne) throw new ErreurQG(400, 'Écris la mission avant de l’envoyer.');
  if (consigne.length > (interne ? 24000 : 4000)) throw new ErreurQG(400, 'Mission trop longue (4 000 caractères maximum).');
  const { nom } = MEMBRES[membre];
  if (enCours.has(membre)) throw new ErreurQG(409, `${nom} est déjà en mission : attends qu'elle finisse ou annule-la.`);
  if (enCours.size >= MAX_EN_MEME_TEMPS) {
    throw new ErreurQG(409, `Déjà ${MAX_EN_MEME_TEMPS} membres au travail : attends qu'un finisse (ça protège ton quota).`);
  }
  await chargerHistorique();
  const { args, dossier, modele } = await argumentsMission(membre);

  const m = {
    id: randomUUID(),
    membre,
    texte: consigne,
    debut: new Date().toISOString(),
    statut: 'travail',
    modele: modele ?? null,
    ...(parcoursId ? { parcoursId } : {}),
    activites: [{ a: new Date().toISOString(), texte: 'se met au travail' }],
  };
  // Réservé tout de suite : deux clics rapides ne lancent pas deux missions.
  const place = { mission: m, enfant: null, minuterie: null };
  enCours.set(membre, place);
  historique.unshift(m);

  let enfant;
  try {
    enfant = spawn(cheminClaude(), args, { cwd: dossier, env: environnement(membre, dossier), windowsHide: true });
  } catch (err) {
    enCours.delete(membre);
    Object.assign(m, { statut: 'erreur', fin: new Date().toISOString(), erreur: `Claude Code introuvable : ${err.message}` });
    await sauver();
    void diffuser();
    throw new ErreurQG(500, m.erreur);
  }
  place.enfant = enfant;
  place.minuterie = setTimeout(() => terminer(m, 'erreur', 'Mission arrêtée : plus de 30 minutes.'), DUREE_MAX);

  // La mission passe par l'entrée standard (pas d'argument qui pourrait être
  // pris pour une option).
  enfant.stdin.end(consigne);

  let tampon = '';
  enfant.stdout.setEncoding('utf8');
  enfant.stdout.on('data', (morceau) => {
    tampon += morceau;
    let i;
    while ((i = tampon.indexOf('\n')) >= 0) {
      const ligne = tampon.slice(0, i).trim();
      tampon = tampon.slice(i + 1);
      if (ligne) traiter(m, ligne);
    }
  });
  let erreurs = '';
  enfant.stderr.setEncoding('utf8');
  enfant.stderr.on('data', (d) => (erreurs = (erreurs + d).slice(-2000)));
  enfant.on('error', (err) => terminer(m, 'erreur', `Claude Code n'a pas pu démarrer : ${err.message}`));
  enfant.on('close', (code) => {
    if (m.statut === 'travail') {
      terminer(m, 'erreur', court(erreurs, 400) || `Claude Code s'est arrêté sans résultat (code ${code}).`);
    }
  });

  await sauver();
  void diffuser();
  return m;
}

function noter(m, texte) {
  m.activites.push({ a: new Date().toISOString(), texte });
  if (m.activites.length > MAX_ACTIVITES) m.activites.splice(0, m.activites.length - MAX_ACTIVITES);
  void diffuser();
}

function traiter(m, ligne) {
  let msg;
  try {
    msg = JSON.parse(ligne);
  } catch {
    return;
  }
  if (msg.type === 'system' && msg.subtype === 'init') {
    m.modele = msg.model ?? m.modele;
    // Le verrou de l'abonnement : la moindre clé API arrête tout.
    if (msg.apiKeySource && msg.apiKeySource !== 'none') {
      terminer(m, 'erreur', `Mission arrêtée : Claude Code voulait passer par une clé API payante (${msg.apiKeySource}) au lieu de ton abonnement.`);
    }
    return;
  }
  if (msg.type === 'rate_limit_event' && msg.rate_limit_info) {
    const r = msg.rate_limit_info;
    quota = { utilisation: r.utilization ?? null, periode: r.rateLimitType ?? null, statut: r.status ?? null, reprise: r.resetsAt ?? null };
    void diffuser();
    return;
  }
  if (msg.type === 'assistant') {
    for (const bloc of msg.message?.content ?? []) {
      if (bloc.type === 'tool_use') noter(m, decrireOutil(bloc.name, bloc.input));
    }
    return;
  }
  if (msg.type === 'result') {
    m.duree = msg.duration_ms ?? null;
    m.tours = msg.num_turns ?? null;
    m.refus = (msg.permission_denials ?? []).length;
    if (msg.subtype === 'success' && !msg.is_error) {
      const { texte, comptes } = extraireComptesProposes(String(msg.result ?? ''));
      m.resultat = texte;
      if (comptes.length) m.comptesProposes = comptes.map((c) => ({ ...c, decision: null }));
      terminer(m, 'fini');
    } else {
      terminer(m, 'erreur', court(msg.result || msg.errors?.join(' ') || msg.subtype, 400));
    }
  }
}

function terminer(m, statut, erreur) {
  if (m.statut !== 'travail') return;
  const place = enCours.get(m.membre);
  if (place?.mission === m) {
    clearTimeout(place.minuterie);
    enCours.delete(m.membre);
    arreter(place.enfant);
  }
  m.statut = statut;
  m.fin = new Date().toISOString();
  if (erreur) m.erreur = erreur;
  noter(m, statut === 'fini' ? 'a terminé' : statut === 'annulee' ? 'mission annulée' : 'a rencontré un problème');
  void sauver();
  for (const rappel of finDeMission) rappel(m);
}

// Pour les parcours (./parcours.js) : prévenus à la fin de chaque mission, et
// leur état ajouté à celui du QG.
const finDeMission = new Set();
export const surFinDeMission = (rappel) => finDeMission.add(rappel);
const etatsEnPlus = [];
export const ajouterAEtat = (lire) => etatsEnPlus.push(lire);
export const placesLibres = () => MAX_EN_MEME_TEMPS - enCours.size;
export const estOccupe = (membre) => enCours.has(membre);

export async function annulerMission(membre) {
  const place = enCours.get(membre);
  if (!place) throw new ErreurQG(409, `${MEMBRES[membre]?.nom ?? membre} n'a pas de mission en cours.`);
  terminer(place.mission, 'annulee');
  place.mission.vue = true; // annulée par le capitaine : rien à lui signaler
  await sauver();
  return place.mission;
}

// Arrêt du serveur (Ctrl+C, fermeture de l'appli) : les missions s'arrêtent avec lui.
export function arreterTout() {
  for (const { mission: m } of [...enCours.values()]) terminer(m, 'erreur', 'Log Pose a été fermé pendant la mission.');
}

// Décision du capitaine sur un compte proposé par Robin.
export async function deciderProposition(id, index, decision) {
  const m = await mission(id);
  const c = m.comptesProposes?.[index];
  if (!c) throw new ErreurQG(404, 'Proposition introuvable.');
  if (!['ajoute', 'ignore'].includes(decision)) throw new ErreurQG(400, 'Décision inconnue.');
  c.decision = decision;
  await sauver();
  return c;
}

export async function propositionsEnAttente() {
  await chargerHistorique();
  return historique.flatMap((m) =>
    (m.comptesProposes ?? []).map((c, index) => ({ ...c, index, missionId: m.id })).filter((c) => !c.decision),
  );
}
