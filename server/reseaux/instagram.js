// Plateforme Instagram de l'onglet « Réseaux » : publication de Reels et
// statistiques du compte. Suit l'interface décrite dans ./index.js.
//
// Passe par l'API officielle « Instagram API with Instagram Login » (compte
// professionnel : Créateur ou Entreprise, sans page Facebook) :
//   - connexion OAuth une fois ; le jeton dure 60 jours et le serveur le
//     renouvelle tout seul (server/.reseau-instagram.json, non commité) ;
//   - publication : Instagram ne reçoit pas le fichier, il vient le chercher
//     sur une adresse publique. Un mini-serveur séparé (port
//     INSTAGRAM_PORT_PUBLIC, rendu public par Tailscale Funnel) sert donc
//     UNIQUEMENT les vidéos en cours d'envoi, sous un nom introuvable, le temps
//     qu'Instagram les récupère. Le reste de Log Pose n'est jamais exposé.
//     La vidéo est publiée tout de suite, en public : l'API n'a pas de brouillon ;
//   - stats : abonnés, puis vues (insights), likes et commentaires par post.
//
// Réglages dans .env : INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET,
// INSTAGRAM_REDIRECT_URI et INSTAGRAM_URL_PUBLIQUE (voir .env.example).

import { randomBytes } from 'node:crypto';
import { copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { ErreurReseau, etatsOAuth, stockageJeton } from './commun.js';

export const id = 'instagram';
export const nom = 'Instagram';
export const typesVideo = ['video/mp4', 'video/quicktime'];

const HOTE = 'https://graph.instagram.com';
const API = `${HOTE}/v26.0`;
const SCOPES = [
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
];

// Les stats sont gardées un moment : l'API limite le nombre d'appels.
const DUREE_CACHE_STATS = 10 * 60 * 1000;
// Posts remontés pour les stats (une demande de vues par post).
const MAX_POSTS = 60;
// Suivi du traitement d'une vidéo par Instagram avant publication.
const INTERVALLE_SUIVI = 15 * 1000;
const DUREE_MAX_SUIVI = 20 * 60 * 1000;

const JOUR = 24 * 60 * 60 * 1000;

function reglages() {
  const {
    INSTAGRAM_APP_ID: appId,
    INSTAGRAM_APP_SECRET: secret,
    INSTAGRAM_REDIRECT_URI: retour,
    INSTAGRAM_URL_PUBLIQUE: publique,
  } = process.env;
  return appId && secret && retour && publique
    ? { appId, secret, retour, publique: publique.replace(/\/+$/, '') }
    : null;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Jeton ------------------------------------------------------------------

const jeton = stockageJeton(id);

// Le jeton long dure 60 jours : renouvelé quand il lui en reste moins de 10
// (Instagram exige qu'il ait au moins 24 h).
async function jetonValide() {
  if (!reglages()) throw new ErreurReseau(503, 'Instagram n’est pas configuré dans .env.');
  const actuel = await jeton.lire();
  if (!actuel) throw new ErreurReseau(401, "Aucun compte Instagram n'est relié.");
  const maintenant = Date.now();
  if (actuel.expireLe < maintenant) {
    await deconnecter();
    throw new ErreurReseau(401, 'La connexion Instagram a expiré : relie le compte à nouveau.');
  }
  if (actuel.expireLe - maintenant < 10 * JOUR && maintenant - actuel.obtenuLe > JOUR) {
    try {
      const data = await lireJson(
        `${HOTE}/refresh_access_token?` +
          new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: actuel.accessToken }),
      );
      const nouveau = {
        ...actuel,
        accessToken: data.access_token,
        obtenuLe: maintenant,
        expireLe: maintenant + data.expires_in * 1000,
      };
      await jeton.sauver(nouveau);
      return nouveau;
    } catch (err) {
      // Le jeton actuel reste valable quelques jours : on réessaiera.
      console.error('[Log Pose] Renouvellement Instagram raté :', err?.message ?? err);
    }
  }
  return actuel;
}

async function lireJson(url, init) {
  const reponse = await fetch(url, init);
  const data = await reponse.json().catch(() => ({}));
  if (!reponse.ok || data.error || data.error_type) {
    const erreur = data.error ?? {};
    if (erreur.code === 190) await deconnecter();
    throw new ErreurReseau(
      reponse.status >= 400 && reponse.status < 500 ? reponse.status : 502,
      messageErreur(erreur, data),
    );
  }
  return data;
}

function messageErreur(erreur, data) {
  if (erreur.code === 190) return 'La connexion Instagram n’est plus valable : relie le compte à nouveau.';
  if (erreur.code === 10 || erreur.code === 200) {
    return 'Une autorisation manque : délie puis relie le compte Instagram en acceptant tout.';
  }
  if (erreur.code === 4 || erreur.code === 17 || erreur.code === 32) {
    return 'Trop de demandes à Instagram : réessaie dans quelques minutes.';
  }
  return `Instagram a répondu : ${erreur.error_user_msg || erreur.message || data.error_message || 'erreur inconnue'}`;
}

// Appel à l'API avec le jeton du compte (paramètres dans l'adresse, comme
// dans la documentation de Meta).
async function appeler(chemin, { methode = 'GET', params = {} } = {}) {
  const { accessToken } = await jetonValide();
  const url = `${API}${chemin}?${new URLSearchParams({ ...params, access_token: accessToken })}`;
  return lireJson(url, { method: methode });
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
    destination: 'Instagram en Reel public',
    conseil: null,
    publique: true,
    legende: true,
  };
}

export function lienConnexion() {
  const r = reglages();
  if (!r) throw new ErreurReseau(503, 'Instagram n’est pas configuré dans .env.');
  const params = new URLSearchParams({
    client_id: r.appId,
    redirect_uri: r.retour,
    response_type: 'code',
    scope: SCOPES.join(','),
    state: etats.creer(randomBytes(16).toString('hex')),
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

export async function terminerConnexion({ code, state, error, error_description, error_reason }) {
  if (error) throw new ErreurReseau(400, `Connexion annulée : ${error_description || error_reason || error}`);
  etats.verifier(state);
  if (!code) throw new ErreurReseau(400, 'Code de connexion manquant.');
  const r = reglages();

  // 1. Code → jeton court (1 h). La réponse est parfois enveloppée dans « data ».
  const reponse = await lireJson('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: r.appId,
      client_secret: r.secret,
      grant_type: 'authorization_code',
      redirect_uri: r.retour,
      code: String(code).replace(/#_$/, ''),
    }),
  });
  const court = reponse.data?.[0] ?? reponse;
  const permissions = Array.isArray(court.permissions)
    ? court.permissions
    : String(court.permissions ?? '').split(',');

  // 2. Jeton court → jeton long (60 jours).
  const long = await lireJson(
    `${HOTE}/access_token?` +
      new URLSearchParams({
        grant_type: 'ig_exchange_token',
        client_secret: r.secret,
        access_token: court.access_token,
      }),
  );

  // 3. Identifiant du compte professionnel, pour publier.
  const moi = await lireJson(
    `${API}/me?${new URLSearchParams({ fields: 'user_id,username', access_token: long.access_token })}`,
  );

  const maintenant = Date.now();
  await jeton.sauver({
    accessToken: long.access_token,
    obtenuLe: maintenant,
    expireLe: maintenant + long.expires_in * 1000,
    igId: moi.user_id ?? moi.id,
    username: moi.username,
    scopes: permissions,
  });
  cacheStats = null;
}

export async function deconnecter() {
  cacheStats = null;
  await jeton.effacer();
}

// --- Adresse publique des vidéos -----------------------------------------

// Vidéos en cours d'envoi : nom introuvable → chemin du fichier.
const videosPubliques = new Map();

// Mini-serveur à part, sur 127.0.0.1 uniquement : Tailscale Funnel le rend
// joignable depuis Internet. Il ne sert rien d'autre que ces vidéos.
export function demarrerServeurPublic() {
  if (!reglages()) return;
  const port = Number(process.env.INSTAGRAM_PORT_PUBLIC ?? 3002);
  const publicApp = express();
  publicApp.disable('x-powered-by');
  publicApp.get('/videos/:nom', (req, res) => {
    const chemin = videosPubliques.get(req.params.nom);
    if (!chemin) return res.status(404).end();
    res.sendFile(chemin);
  });
  publicApp.use((_req, res) => res.status(404).end());
  publicApp
    .listen(port, '127.0.0.1', () =>
      console.log(`[Log Pose] Vidéos Instagram servies sur le port ${port} (à rendre public avec Tailscale Funnel).`),
    )
    .on('error', (err) => console.error('[Log Pose] Serveur des vidéos Instagram :', err?.message ?? err));
}

// --- Publication d'un Reel --------------------------------------------------

// Suivi des envois (en mémoire : un redémarrage du serveur perd le suivi).
const envois = new Map();

// Garde une copie de la vidéo (le fichier reçu est supprimé dès la fin de la
// requête), la rend publique, puis demande à Instagram de créer le Reel.
export async function envoyerVideo(chemin, type, { legende = '' } = {}) {
  if (!typesVideo.includes(type)) throw new ErreurReseau(415, 'Instagram accepte les vidéos MP4 ou MOV.');
  const r = reglages();
  const { igId } = await jetonValide();
  const nomPublic = `${randomBytes(24).toString('hex')}.${type === 'video/quicktime' ? 'mov' : 'mp4'}`;
  const copie = join(tmpdir(), `log-pose-instagram-${nomPublic}`);
  await copyFile(chemin, copie);
  videosPubliques.set(nomPublic, copie);
  const nettoyer = async () => {
    videosPubliques.delete(nomPublic);
    await rm(copie, { force: true });
  };

  try {
    const { id: conteneur } = await appeler(`/${igId}/media`, {
      methode: 'POST',
      params: {
        media_type: 'REELS',
        video_url: `${r.publique}/videos/${nomPublic}`,
        ...(legende ? { caption: legende } : {}),
      },
    });
    envois.set(conteneur, { etat: 'en-cours' });
    void suivreEtPublier(igId, conteneur).finally(nettoyer);
    return { idEnvoi: conteneur };
  } catch (err) {
    await nettoyer();
    throw err;
  }
}

// Attend qu'Instagram ait récupéré et traité la vidéo, puis publie le Reel.
// Tourne côté serveur : fermer l'onglet n'empêche pas la publication.
async function suivreEtPublier(igId, conteneur) {
  const fin = Date.now() + DUREE_MAX_SUIVI;
  try {
    while (Date.now() < fin) {
      await attendre(INTERVALLE_SUIVI);
      const { status_code: code, status } = await appeler(`/${conteneur}`, {
        params: { fields: 'status_code,status' },
      });
      if (code === 'FINISHED') {
        await appeler(`/${igId}/media_publish`, { methode: 'POST', params: { creation_id: conteneur } });
        envois.set(conteneur, { etat: 'publiee' });
        cacheStats = null;
        return;
      }
      if (code === 'PUBLISHED') {
        envois.set(conteneur, { etat: 'publiee' });
        return;
      }
      if (code === 'ERROR' || code === 'EXPIRED') {
        envois.set(conteneur, { etat: 'echec', raison: status || code });
        return;
      }
    }
    envois.set(conteneur, { etat: 'echec', raison: 'Instagram a mis trop de temps à traiter la vidéo.' });
  } catch (err) {
    envois.set(conteneur, { etat: 'echec', raison: err?.message ?? 'erreur inconnue' });
  }
}

export async function statutEnvoi(idEnvoi) {
  return envois.get(idEnvoi) ?? { etat: 'echec', raison: 'Suivi perdu (serveur relancé) : regarde dans l’appli.' };
}

// --- Statistiques -----------------------------------------------------------

let cacheStats = null; // { le, stats }

const CHAMPS_POST = 'id,caption,media_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count';

// Vues et partages d'un post (insights). Certains vieux posts n'en ont pas :
// on garde alors ce qu'on sait.
async function insightsPost(idPost) {
  try {
    const { data = [] } = await appeler(`/${idPost}/insights`, { params: { metric: 'views,shares' } });
    const valeur = (nomMetrique) => {
      const m = data.find((d) => d.name === nomMetrique);
      return m?.values?.[0]?.value ?? m?.total_value?.value ?? null;
    };
    return { vues: valeur('views'), partages: valeur('shares') };
  } catch {
    return { vues: null, partages: null };
  }
}

export async function stats({ forcer = false } = {}) {
  if (!forcer && cacheStats && Date.now() - cacheStats.le < DUREE_CACHE_STATS) return cacheStats.stats;

  const moi = await appeler('/me', {
    params: { fields: 'user_id,username,name,profile_picture_url,followers_count,media_count' },
  });

  const posts = [];
  let page = await appeler('/me/media', { params: { fields: CHAMPS_POST, limit: '25' } });
  for (;;) {
    posts.push(...(page.data ?? []));
    const suivante = page.paging?.next;
    if (!suivante || posts.length >= MAX_POSTS) break;
    page = await lireJson(suivante);
  }
  posts.splice(MAX_POSTS);

  // Vues demandées par paquets de 10, pour ne pas inonder l'API.
  const insights = [];
  for (let i = 0; i < posts.length; i += 10) {
    insights.push(...(await Promise.all(posts.slice(i, i + 10).map((p) => insightsPost(p.id)))));
  }

  const releve = {
    compte: {
      nom: moi.username ? `@${moi.username}` : (moi.name ?? ''),
      avatar: moi.profile_picture_url ?? null,
      abonnes: moi.followers_count ?? 0,
      likes: null, // Instagram ne donne pas de total de likes du compte
      videos: moi.media_count ?? 0,
    },
    videos: posts.map((p, i) => ({
      id: p.id,
      titre: p.caption ?? '',
      publieeLe: new Date(p.timestamp).toISOString(),
      couverture: p.thumbnail_url ?? (p.media_type === 'VIDEO' ? null : (p.media_url ?? null)),
      lien: p.permalink ?? null,
      duree: 0,
      vues: insights[i].vues ?? 0,
      likes: p.like_count ?? null,
      commentaires: p.comments_count ?? null,
      partages: insights[i].partages,
    })),
    releveLe: new Date().toISOString(),
  };
  cacheStats = { le: Date.now(), stats: releve };
  return releve;
}
