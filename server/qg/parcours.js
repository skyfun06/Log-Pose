// Ordres automatiques du QG : un ordre écrit SANS nom de membre passe par le
// « second ». Il lit la demande et choisit le parcours adapté dans
// equipage/CIRCUIT-IDEES.md (ex. vidéo : Robin → Brook → Zoro). Le capitaine
// valide (ou modifie) le parcours, puis les étapes s'enchaînent une par une :
// chaque membre reçoit le travail du précédent, et le résultat final arrive
// dans le journal de bord.
//
// Le second : Claude Code en Haiku (le moins cher), sur l'abonnement, SANS
// AUCUN outil (il ne lit, n'écrit et ne cherche rien : le circuit lui est
// donné dans sa consigne). Mêmes verrous que les missions : mode restreint,
// tout refusé, gardien, et arrêt net si une clé API apparaît.
//
// Les limites restent celles du QG : une étape à la fois par parcours, et
// une étape attend tant que son membre est occupé ou que 2 membres travaillent.

import { spawn } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  ErreurQG,
  MEMBRES,
  RACINE,
  ajouterAEtat,
  annulerMission,
  arreter,
  cheminClaude,
  diffuser,
  environnement,
  estOccupe,
  lancerMission,
  placesLibres,
  surFinDeMission,
} from './index.js';

const MAX_ETAPES = 5;
const MAX_TRAVAIL_PRECEDENT = 12000; // caractères du résultat transmis à l'étape suivante
const DUREE_PASSATION = 7000; // le membre marche jusqu'à la pièce du suivant (scène)
const ATTENTE_PLACE = 8000; // nouvelle tentative quand l'étape attend une place

const FICHIER = new URL('../.qg-parcours.json', import.meta.url);
let liste = null; // parcours, le plus récent en premier
let passation = null; // { de, vers, a } : animation de la scène

async function charger() {
  if (liste) return liste;
  try {
    liste = JSON.parse(await readFile(FICHIER, 'utf8'));
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
    liste = [];
  }
  for (const p of liste) {
    if (p.statut === 'travail') Object.assign(p, { statut: 'erreur', erreur: 'Log Pose a été fermé pendant le parcours.' });
  }
  return liste;
}

let ecriture = Promise.resolve();
function sauver() {
  ecriture = ecriture
    .catch(() => {})
    .then(async () => {
      const temporaire = new URL('../.qg-parcours.json.tmp', import.meta.url);
      await writeFile(temporaire, JSON.stringify(liste.slice(0, 200)));
      await rename(temporaire, FICHIER);
    });
  return ecriture;
}

// État ajouté à celui du QG (flux en direct) : parcours en cours et passation.
ajouterAEtat(() => ({
  parcours: (liste ?? [])
    .filter((p) => p.statut === 'travail')
    .map((p) => ({ id: p.id, etape: p.etape, etapes: p.etapes.map(({ membre, statut }) => ({ membre, statut })) })),
  passation: passation && Date.now() - passation.a < DUREE_PASSATION ? passation : null,
}));

// --- Le second : choisir le parcours ----------------------------------------------

const noms = Object.entries(MEMBRES)
  .map(([id, m]) => `${id} (${m.nom}, ${m.poste})`)
  .join(', ');

async function consigneDuSecond(demande) {
  const circuit = await readFile(`${RACINE}/CIRCUIT-IDEES.md`, 'utf8').catch(() => '');
  return `Tu es le second du navire. Le capitaine donne un ordre sans dire à qui. Choisis le parcours adapté dans le circuit ci-dessous et écris, pour chaque membre, une consigne courte et précise (1 à 3 phrases) adaptée à son rôle et à la demande.

Membres possibles : ${noms}. Maximum ${MAX_ETAPES} étapes. Une demande simple peut n'avoir qu'une étape. N'invente aucun membre.

<circuit>
${circuit}
</circuit>

<ordre_du_capitaine>
${demande}
</ordre_du_capitaine>

Réponds UNIQUEMENT avec ce JSON, sans texte autour :
{"type": "nom du parcours", "raison": "pourquoi ce parcours, en une phrase", "etapes": [{"membre": "robin", "consigne": "..."}]}`;
}

function lireJson(texte) {
  const debut = texte.indexOf('{');
  const fin = texte.lastIndexOf('}');
  if (debut < 0 || fin <= debut) throw new ErreurQG(502, 'Le second n’a pas su proposer de parcours. Reformule l’ordre ou choisis un membre.');
  try {
    return JSON.parse(texte.slice(debut, fin + 1));
  } catch {
    throw new ErreurQG(502, 'Réponse du second illisible. Réessaie.');
  }
}

// Vérifie et nettoie un parcours (venu du second ou modifié par le capitaine).
function nettoyer(etapes) {
  if (!Array.isArray(etapes) || etapes.length === 0) throw new ErreurQG(400, 'Le parcours est vide.');
  if (etapes.length > MAX_ETAPES) throw new ErreurQG(400, `${MAX_ETAPES} étapes maximum.`);
  return etapes.map((e) => {
    const membre = String(e?.membre ?? '').toLowerCase();
    if (!Object.hasOwn(MEMBRES, membre)) throw new ErreurQG(400, `Membre inconnu dans le parcours : ${e?.membre}`);
    return { membre, consigne: String(e?.consigne ?? '').trim().slice(0, 1000) };
  });
}

export async function proposerParcours(demande) {
  const texte = String(demande ?? '').trim();
  if (!texte) throw new ErreurQG(400, 'Écris l’ordre avant de l’envoyer.');
  if (texte.length > 4000) throw new ErreurQG(400, 'Ordre trop long (4 000 caractères maximum).');
  const garde = fileURLToPath(new URL('./garde.js', import.meta.url)).replace(/\\/g, '/');
  const reglages = {
    hooks: { PreToolUse: [{ matcher: '*', hooks: [{ type: 'command', command: `"${process.execPath.replace(/\\/g, '/')}" "${garde}"` }] }] },
  };
  const args = [
    '-p',
    '--model', 'haiku',
    '--restricted',
    '--strict-mcp-config',
    '--settings', JSON.stringify(reglages),
    '--tools', '',
    '--permission-mode', 'dontAsk',
    '--output-format', 'stream-json',
    '--verbose',
    '--no-session-persistence',
  ];
  const enfant = spawn(cheminClaude(), args, { cwd: RACINE, env: environnement('second', RACINE), windowsHide: true });
  enfant.stdin.end(await consigneDuSecond(texte));

  const reponse = await new Promise((resoudre, rejeter) => {
    let tampon = '';
    let resultat = null;
    const minuterie = setTimeout(() => {
      arreter(enfant);
      rejeter(new ErreurQG(504, 'Le second met trop de temps à répondre. Réessaie.'));
    }, 120000);
    enfant.stdout.setEncoding('utf8');
    enfant.stdout.on('data', (morceau) => {
      tampon += morceau;
      let i;
      while ((i = tampon.indexOf('\n')) >= 0) {
        const ligne = tampon.slice(0, i).trim();
        tampon = tampon.slice(i + 1);
        let msg;
        try {
          msg = JSON.parse(ligne);
        } catch {
          continue;
        }
        // Le verrou de l'abonnement, comme pour les missions.
        if (msg.type === 'system' && msg.subtype === 'init' && msg.apiKeySource && msg.apiKeySource !== 'none') {
          arreter(enfant);
          clearTimeout(minuterie);
          rejeter(new ErreurQG(500, `Arrêté : le second voulait passer par une clé API payante (${msg.apiKeySource}).`));
        }
        if (msg.type === 'result') resultat = msg;
      }
    });
    enfant.on('error', (err) => {
      clearTimeout(minuterie);
      rejeter(new ErreurQG(500, `Claude Code n'a pas pu démarrer : ${err.message}`));
    });
    enfant.on('close', () => {
      clearTimeout(minuterie);
      if (resultat?.subtype === 'success' && !resultat.is_error) resoudre(String(resultat.result ?? ''));
      else rejeter(new ErreurQG(502, `Le second n'a pas répondu (${resultat?.result ?? 'arrêt inattendu'}).`));
    });
  });

  const json = lireJson(reponse);
  return { texte, type: String(json.type ?? 'Parcours').slice(0, 80), raison: String(json.raison ?? '').slice(0, 300), etapes: nettoyer(json.etapes) };
}

// --- Enchaîner les étapes -------------------------------------------------------

export async function lancerParcours(demande, etapes, type = 'Parcours') {
  await charger();
  const p = {
    id: randomUUID(),
    texte: String(demande ?? '').trim().slice(0, 4000),
    type: String(type).slice(0, 80),
    debut: new Date().toISOString(),
    statut: 'travail',
    etape: 0,
    etapes: nettoyer(etapes).map((e) => ({ ...e, statut: 'attente', missionId: null })),
  };
  if (!p.texte) throw new ErreurQG(400, 'Ordre vide.');
  liste.unshift(p);
  await sauver();
  void demarrerEtape(p);
  return p;
}

function consigneEtape(p, k) {
  const e = p.etapes[k];
  const chemin = p.etapes.map((x, i) => `${i === k ? '▶ ' : ''}${MEMBRES[x.membre].nom}`).join(' → ');
  const avant = k > 0 ? p.etapes[k - 1] : null;
  const travail = avant?.resultat
    ? `\n\nTravail de l'étape précédente (${MEMBRES[avant.membre].nom}) — appuie-toi dessus, ne recommence pas de zéro :\n<travail_precedent>\n${avant.resultat.slice(0, MAX_TRAVAIL_PRECEDENT)}\n</travail_precedent>`
    : '';
  const fin = k === p.etapes.length - 1 ? '\n\nTu es la dernière étape : ta réponse est le résultat final que lira le capitaine.' : '\n\nTa réponse sera transmise au membre suivant : rends un travail qu’il pourra utiliser directement.';
  return `Ordre du capitaine : « ${p.texte} »\nParcours : ${chemin} (étape ${k + 1}/${p.etapes.length}).\nTa consigne : ${e.consigne || p.texte}${travail}${fin}`;
}

async function demarrerEtape(p) {
  if (p.statut !== 'travail') return;
  const e = p.etapes[p.etape];
  // Une place libre et le membre disponible, sinon on patiente.
  if (estOccupe(e.membre) || placesLibres() <= 0) {
    e.statut = 'attente';
    setTimeout(() => void demarrerEtape(p), ATTENTE_PLACE);
    return;
  }
  try {
    const m = await lancerMission(e.membre, consigneEtape(p, p.etape), { interne: true, parcoursId: p.id });
    Object.assign(e, { statut: 'travail', missionId: m.id });
  } catch (err) {
    if (err?.statut === 409) {
      setTimeout(() => void demarrerEtape(p), ATTENTE_PLACE); // pris entre-temps : on patiente
      return;
    }
    Object.assign(p, { statut: 'erreur', erreur: err?.message ?? 'erreur inconnue', fin: new Date().toISOString() });
  }
  await sauver();
  void diffuser();
}

surFinDeMission((m) => {
  if (!m.parcoursId || !liste) return;
  const p = liste.find((x) => x.id === m.parcoursId);
  if (!p || p.statut !== 'travail') return;
  const e = p.etapes[p.etape];
  if (e.missionId !== m.id) return;
  e.statut = m.statut;
  if (m.statut !== 'fini') {
    Object.assign(p, { statut: m.statut === 'annulee' ? 'annule' : 'erreur', erreur: m.erreur ?? 'Étape annulée.', fin: new Date().toISOString() });
    void sauver();
    void diffuser();
    return;
  }
  e.resultat = m.resultat ?? '';
  if (p.etape === p.etapes.length - 1) {
    Object.assign(p, { statut: 'fini', resultat: e.resultat, fin: new Date().toISOString() });
    void sauver();
    void diffuser();
    return;
  }
  // Passation : le membre porte son travail jusqu'à la pièce du suivant.
  p.etape += 1;
  passation = { de: m.membre, vers: p.etapes[p.etape].membre, a: Date.now() };
  void sauver();
  void diffuser();
  setTimeout(() => void demarrerEtape(p), DUREE_PASSATION);
});

export async function listeParcours() {
  return charger();
}

export async function annulerParcours(id) {
  await charger();
  const p = liste.find((x) => x.id === id);
  if (!p || p.statut !== 'travail') throw new ErreurQG(409, 'Ce parcours n’est pas en cours.');
  Object.assign(p, { statut: 'annule', fin: new Date().toISOString() });
  // L'étape en cours s'arrête aussi.
  const e = p.etapes[p.etape];
  if (e?.statut === 'travail') await annulerMission(e.membre).catch(() => {});
  await sauver();
  void diffuser();
  return p;
}
