// Plateforme TikTok de l'onglet « Réseaux » : envoi de vidéos en brouillon et
// statistiques du compte. Suit l'interface décrite dans ./index.js.
//
// Passe par l'API officielle (TikTok for Developers) :
//   - Login Kit : le compte se relie une fois, le serveur garde le jeton (et le
//     renouvelle tout seul) dans server/.reseau-tiktok.json (non commité) ;
//   - Content Posting API, « upload » : la vidéo part dans la boîte de
//     réception TikTok ; une notification dans l'appli permet de la finir
//     (son, texte) et de la publier. Pas besoin d'audit de l'appli pour ça ;
//   - video.list + user.info : vues, likes, commentaires, partages, abonnés.
//
// Réglages dans .env : TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET et
// TIKTOK_REDIRECT_URI (voir .env.example).

import { randomBytes } from 'node:crypto';
import { open, stat } from 'node:fs/promises';
import { ErreurReseau, etatsOAuth, stockageJeton } from './commun.js';

export const id = 'tiktok';
export const nom = 'TikTok';
export const typesVideo = ['video/mp4', 'video/quicktime', 'video/webm'];

const API = 'https://open.tiktokapis.com';
const SCOPES = ['user.info.basic', 'user.info.stats', 'video.list', 'video.upload'];

// Les stats sont gardées un moment : l'API limite le nombre d'appels.
const DUREE_CACHE_STATS = 10 * 60 * 1000;
// Vidéos remontées pour les stats (20 par page côté TikTok).
const MAX_VIDEOS = 60;

function reglages() {
  const { TIKTOK_CLIENT_KEY: cle, TIKTOK_CLIENT_SECRET: secret, TIKTOK_REDIRECT_URI: retour } =
    process.env;
  return cle && secret && retour ? { cle, secret, retour } : null;
}

// --- Jeton ------------------------------------------------------------------

const jeton = stockageJeton(id);

// Échange un code (connexion) ou un jeton de renouvellement contre un jeton.
async function demanderJeton(parametres) {
  const r = reglages();
  const reponse = await fetch(`${API}/v2/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: r.cle, client_secret: r.secret, ...parametres }),
  });
  const data = await reponse.json().catch(() => ({}));
  if (!reponse.ok || data.error || !data.access_token) {
    throw new ErreurReseau(
      502,
      `TikTok a refusé la connexion : ${data.error_description || data.error || reponse.status}`,
    );
  }
  const maintenant = Date.now();
  return {
    accessToken: data.access_token,
    expireLe: maintenant + data.expires_in * 1000,
    refreshToken: data.refresh_token,
    refreshExpireLe: maintenant + data.refresh_expires_in * 1000,
    openId: data.open_id,
    scopes: String(data.scope ?? '').split(','),
  };
}

// Jeton valide, renouvelé s'il expire dans moins de 5 minutes (il dure 24 h ;
// le renouvellement, un an).
async function jetonValide() {
  if (!reglages()) throw new ErreurReseau(503, 'TikTok n’est pas configuré dans .env.');
  const actuel = await jeton.lire();
  if (!actuel) throw new ErreurReseau(401, "Aucun compte TikTok n'est relié.");
  if (actuel.expireLe - Date.now() > 5 * 60 * 1000) return actuel.accessToken;
  if (actuel.refreshExpireLe < Date.now()) {
    await deconnecter();
    throw new ErreurReseau(401, 'La connexion TikTok a expiré : relie le compte à nouveau.');
  }
  const nouveau = await demanderJeton({
    grant_type: 'refresh_token',
    refresh_token: actuel.refreshToken,
  });
  await jeton.sauver(nouveau);
  return nouveau.accessToken;
}

// Appel à l'API TikTok avec le jeton du compte. Les erreurs TikTok arrivent
// dans { error: { code, message } } (code « ok » = succès).
async function appeler(chemin, { methode = 'GET', corps } = {}) {
  const reponse = await fetch(`${API}${chemin}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${await jetonValide()}`,
      ...(corps ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
    },
    ...(corps ? { body: JSON.stringify(corps) } : {}),
  });
  const data = await reponse.json().catch(() => ({}));
  const code = data.error?.code;
  if (!reponse.ok || (code && code !== 'ok')) {
    if (code === 'access_token_invalid') await deconnecter();
    throw new ErreurReseau(reponse.status >= 400 ? reponse.status : 502, messageErreur(code, data));
  }
  return data.data ?? {};
}

function messageErreur(code, data) {
  switch (code) {
    case 'access_token_invalid':
      return 'La connexion TikTok n’est plus valable : relie le compte à nouveau.';
    case 'scope_not_authorized':
      return 'Une autorisation manque : relie le compte à nouveau et coche tout.';
    case 'spam_risk_too_many_pending_share':
      return 'TikTok limite à 5 brouillons en attente par 24 h : publie ou supprime ceux de ta boîte de réception.';
    case 'rate_limit_exceeded':
      return 'Trop de demandes à TikTok d’un coup : réessaie dans une minute.';
    default:
      return `TikTok a répondu : ${data.error?.message || code || 'erreur inconnue'}`;
  }
}

// --- Connexion --------------------------------------------------------------

const etats = etatsOAuth();

export async function etat() {
  const actuel = reglages() ? await jeton.lire() : null;
  return {
    id,
    nom,
    configure: Boolean(reglages()),
    connecte: Boolean(actuel),
    manque: actuel ? SCOPES.filter((s) => !actuel.scopes?.includes(s)) : [],
    destination: 'tes brouillons TikTok',
    conseil: 'ouvre la notification dans l’appli TikTok pour publier',
    publique: false,
    legende: false,
  };
}

export function lienConnexion() {
  const r = reglages();
  if (!r) throw new ErreurReseau(503, 'TikTok n’est pas configuré dans .env.');
  const params = new URLSearchParams({
    client_key: r.cle,
    scope: SCOPES.join(','),
    response_type: 'code',
    redirect_uri: r.retour,
    state: etats.creer(randomBytes(16).toString('hex')),
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
}

// Termine la connexion avec le code renvoyé par TikTok sur l'adresse de retour.
export async function terminerConnexion({ code, state, error, error_description }) {
  if (error) throw new ErreurReseau(400, `Connexion annulée : ${error_description || error}`);
  etats.verifier(state);
  if (!code) throw new ErreurReseau(400, 'Code de connexion manquant.');
  await jeton.sauver(
    await demanderJeton({ code, grant_type: 'authorization_code', redirect_uri: reglages().retour }),
  );
  cacheStats = null;
}

export async function deconnecter() {
  cacheStats = null;
  await jeton.effacer();
}

// --- Envoi d'une vidéo ------------------------------------------------------

const MO = 1024 * 1024;

// Découpage imposé par TikTok : morceaux de 5 à 64 Mo, envoyés dans l'ordre ;
// le dernier absorbe le reste (jusqu'à 128 Mo). Sous 5 Mo : un seul morceau.
function decoupage(taille) {
  if (taille <= 64 * MO) return { tailleMorceau: taille, nombre: 1 };
  const tailleMorceau = 10 * MO;
  return { tailleMorceau, nombre: Math.floor(taille / tailleMorceau) };
}

// Envoie la vidéo (fichier temporaire) dans la boîte de réception TikTok.
// Renvoie l'identifiant d'envoi, à suivre avec statutEnvoi(). La légende ne
// sert pas : elle s'écrit dans l'appli TikTok, au moment de publier.
export async function envoyerVideo(chemin, type) {
  if (!typesVideo.includes(type)) throw new ErreurReseau(415, 'TikTok accepte les vidéos MP4, MOV ou WebM.');
  const { size: taille } = await stat(chemin);
  if (taille === 0) throw new ErreurReseau(400, 'La vidéo est vide.');
  if (taille > 4 * 1024 * MO) throw new ErreurReseau(400, 'TikTok refuse les vidéos de plus de 4 Go.');
  const { tailleMorceau, nombre } = decoupage(taille);

  const { publish_id: idEnvoi, upload_url: adresse } = await appeler(
    '/v2/post/publish/inbox/video/init/',
    {
      methode: 'POST',
      corps: {
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: taille,
          chunk_size: tailleMorceau,
          total_chunk_count: nombre,
        },
      },
    },
  );

  const fichier = await open(chemin);
  try {
    for (let i = 0; i < nombre; i++) {
      const debut = i * tailleMorceau;
      const fin = i === nombre - 1 ? taille : debut + tailleMorceau;
      const morceau = Buffer.alloc(fin - debut);
      await fichier.read(morceau, 0, morceau.length, debut);
      const reponse = await fetch(adresse, {
        method: 'PUT',
        headers: {
          'Content-Type': type,
          'Content-Range': `bytes ${debut}-${fin - 1}/${taille}`,
        },
        body: morceau,
      });
      if (!reponse.ok) {
        throw new ErreurReseau(502, `Envoi interrompu par TikTok (morceau ${i + 1}/${nombre}, code ${reponse.status}).`);
      }
    }
  } finally {
    await fichier.close();
  }
  return { idEnvoi };
}

// Où en est l'envoi : « en-cours », « recue » (dans la boîte de réception
// TikTok), « publiee » ou « echec ».
export async function statutEnvoi(idEnvoi) {
  const data = await appeler('/v2/post/publish/status/fetch/', {
    methode: 'POST',
    corps: { publish_id: idEnvoi },
  });
  switch (data.status) {
    case 'SEND_TO_USER_INBOX':
      return { etat: 'recue' };
    case 'PUBLISH_COMPLETE':
      cacheStats = null;
      return { etat: 'publiee' };
    case 'FAILED':
      return { etat: 'echec', raison: data.fail_reason ?? 'raison inconnue' };
    default:
      return { etat: 'en-cours' };
  }
}

// --- Statistiques -----------------------------------------------------------

let cacheStats = null; // { le, stats }

const CHAMPS_COMPTE = 'open_id,display_name,avatar_url,follower_count,likes_count,video_count';
const CHAMPS_VIDEO =
  'id,title,video_description,create_time,cover_image_url,share_url,duration,view_count,like_count,comment_count,share_count';

export async function stats({ forcer = false } = {}) {
  if (!forcer && cacheStats && Date.now() - cacheStats.le < DUREE_CACHE_STATS) return cacheStats.stats;

  const { user } = await appeler(`/v2/user/info/?fields=${CHAMPS_COMPTE}`);
  const videos = [];
  let curseur;
  do {
    const page = await appeler(`/v2/video/list/?fields=${CHAMPS_VIDEO}`, {
      methode: 'POST',
      corps: { max_count: 20, ...(curseur ? { cursor: curseur } : {}) },
    });
    videos.push(...(page.videos ?? []));
    curseur = page.has_more ? page.cursor : null;
  } while (curseur && videos.length < MAX_VIDEOS);

  const releve = {
    compte: {
      nom: user?.display_name ?? '',
      avatar: user?.avatar_url ?? null,
      abonnes: user?.follower_count ?? 0,
      likes: user?.likes_count ?? 0,
      videos: user?.video_count ?? 0,
    },
    videos: videos.map((v) => ({
      id: v.id,
      titre: v.title || v.video_description || '',
      publieeLe: new Date(v.create_time * 1000).toISOString(),
      couverture: v.cover_image_url ?? null,
      lien: v.share_url ?? null,
      duree: v.duration ?? 0,
      vues: v.view_count ?? 0,
      likes: v.like_count ?? 0,
      commentaires: v.comment_count ?? 0,
      partages: v.share_count ?? 0,
    })),
    releveLe: new Date().toISOString(),
  };
  cacheStats = { le: Date.now(), stats: releve };
  return releve;
}
