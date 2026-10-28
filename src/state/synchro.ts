// Synchronisation des données entre appareils (PC, téléphone via Tailscale).
// Chaque appareil garde ses données dans son localStorage, et le serveur relais
// (server/donnees.js) en garde une copie. Par clé, la version la plus récente
// gagne :
// - à l'ouverture (en attendant le serveur au plus un instant), on récupère les versions du
//   serveur plus récentes que les nôtres (et on envoie les nôtres sinon) ;
// - à chaque changement, la nouvelle version part au serveur ;
// - quand l'appli revient au premier plan (et toutes les 30 s), on regarde si
//   un autre appareil a changé quelque chose : si oui, on recharge la page.

import { API_URL } from '../config';

const CLES = ['log-pose-state', 'log-pose-habitudes', 'log-pose-budget', 'log-pose-cerveau-categories'] as const;
type Cle = (typeof CLES)[number];

// Horodatage de la dernière version connue, par clé.
const CLE_HORODATAGES = 'log-pose-synchro';
const DELAI_ENVOI_MS = 800;
const INTERVALLE_VERIF_MS = 30_000;
const DELAI_DEMARRAGE_MS = 3000;
// Temps qu'on accepte d'attendre le serveur avant d'afficher l'appli.
const ATTENTE_MAX_MS = 600;

type Entree = { valeur: string; maj: number };

// Les données d'avant la synchro (jamais datées) ne partent au serveur que
// depuis le PC, où elles ont été créées : un téléphone encore vide ne doit pas
// les écraser.
const SUR_LE_PC = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

function lireHorodatages(): Partial<Record<Cle, number>> {
  try {
    return JSON.parse(localStorage.getItem(CLE_HORODATAGES) ?? '{}');
  } catch {
    return {};
  }
}

function noterHorodatage(cle: Cle, maj: number) {
  const tout = lireHorodatages();
  tout[cle] = maj;
  try {
    localStorage.setItem(CLE_HORODATAGES, JSON.stringify(tout));
  } catch {
    /* quota : tant pis */
  }
}

async function lireServeur(delaiMs?: number): Promise<Partial<Record<Cle, Entree>>> {
  const reponse = await fetch(`${API_URL}/api/donnees`, {
    signal: delaiMs ? AbortSignal.timeout(delaiMs) : undefined,
  });
  if (!reponse.ok) throw new Error(`Serveur : ${reponse.status}`);
  return reponse.json();
}

// Clés modifiées ici et pas encore envoyées.
const aEnvoyer = new Set<Cle>();
let minuteur: ReturnType<typeof setTimeout> | undefined;

async function envoyer(cle: Cle, garderOuverte = false): Promise<void> {
  const valeur = localStorage.getItem(cle);
  if (valeur == null) return;
  const maj = lireHorodatages()[cle] ?? 0;
  const reponse = await fetch(`${API_URL}/api/donnees/${cle}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valeur, maj }),
    keepalive: garderOuverte,
  });
  if (!reponse.ok) throw new Error(`Serveur : ${reponse.status}`);
}

async function envoyerTout(garderOuverte = false) {
  clearTimeout(minuteur);
  for (const cle of [...aEnvoyer]) {
    try {
      await envoyer(cle, garderOuverte);
      aEnvoyer.delete(cle);
    } catch {
      // Serveur injoignable : on retentera à la prochaine vérification.
    }
  }
}

// Les hooks écrivent leur état une première fois au montage : ce n'est pas un
// changement de Louis, on ne le date pas (sinon un appareil vide écraserait
// les données des autres).
const dejaEcrites = new Set<Cle>();

// À utiliser à la place de localStorage.setItem pour les clés synchronisées.
export function enregistrer(cle: Cle, valeur: string) {
  const premiere = !dejaEcrites.has(cle);
  dejaEcrites.add(cle);
  if (localStorage.getItem(cle) === valeur) return;
  localStorage.setItem(cle, valeur);
  if (premiere) return;
  noterHorodatage(cle, Date.now());
  aEnvoyer.add(cle);
  clearTimeout(minuteur);
  minuteur = setTimeout(() => void envoyerTout(), DELAI_ENVOI_MS);
}

// Recopie les versions du serveur plus récentes que les nôtres. Renvoie vrai
// si quelque chose a changé ici.
function appliquer(serveur: Partial<Record<Cle, Entree>>): boolean {
  const horodatages = lireHorodatages();
  let change = false;
  for (const cle of CLES) {
    const distante = serveur[cle];
    const locale = horodatages[cle];
    if (distante && (locale === undefined || distante.maj > locale) && !aEnvoyer.has(cle)) {
      if (localStorage.getItem(cle) !== distante.valeur) {
        localStorage.setItem(cle, distante.valeur);
        change = true;
      }
      noterHorodatage(cle, distante.maj);
    } else if (locale !== undefined ? !distante || locale > distante.maj : !distante && SUR_LE_PC) {
      // Le serveur n'a pas notre version (premier lancement, ou envoi raté).
      if (localStorage.getItem(cle) != null) aEnvoyer.add(cle);
    }
  }
  return change;
}

async function verifier() {
  if (document.visibilityState !== 'visible') return;
  await envoyerTout();
  try {
    if (appliquer(await lireServeur())) window.location.reload();
  } catch {
    // Serveur injoignable : on garde les données de cet appareil.
  }
}

// À attendre avant d'afficher l'appli, pour que les hooks lisent des données
// à jour. On n'attend le serveur qu'un court instant : s'il répond plus tard
// avec du nouveau, on recharge la page ; s'il est injoignable, on reste sur
// les données de cet appareil.
export async function demarrerSynchro() {
  let affichee = false;
  const lecture = lireServeur(DELAI_DEMARRAGE_MS)
    .then((serveur) => {
      const change = appliquer(serveur);
      void envoyerTout();
      if (change && affichee) window.location.reload();
    })
    .catch(() => {
      // Serveur injoignable : on démarre avec les données locales.
    });
  await Promise.race([lecture, new Promise((r) => setTimeout(r, ATTENTE_MAX_MS))]);
  affichee = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void envoyerTout(true);
    else void verifier();
  });
  setInterval(() => void verifier(), INTERVALLE_VERIF_MS);
}
