// Plateforme Instagram de l'onglet « Réseaux » : publication de Reels et
// statistiques du compte. Suit l'interface décrite dans ./index.js.
//
// Passe par l'API officielle « Instagram API with Unified Login » : c'est la
// seule méthode que Meta propose aux applis créées depuis octobre 2026
// (l'ancienne « connexion Instagram » n'y est plus disponible). Compte
// professionnel (Créateur ou Entreprise), sans page Facebook.
//   - connexion une fois via « Facebook Login for Business » (identifiant de
//     configuration INSTAGRAM_CONFIG_ID) ; on peut s'y connecter avec Instagram
//     ou Facebook. Le jeton obtenu (utilisateur système) n'expire pas : il est
//     gardé dans server/.reseau-instagram.json (non commité) ;
//   - appels sur graph.facebook.com, signés avec appsecret_proof ;
//   - publication : Instagram ne reçoit pas le fichier, il vient le chercher
//     sur une adresse publique. Un mini-serveur séparé (port
//     INSTAGRAM_PORT_PUBLIC, rendu public par Tailscale Funnel) sert donc
//     UNIQUEMENT les vidéos en cours d'envoi, sous un nom introuvable, le temps
//     qu'Instagram les récupère. Le reste de Log Pose n'est jamais exposé.
//     La vidéo est publiée tout de suite, en public : l'API n'a pas de brouillon ;
//   - stats : abonnés, puis vues (insights), likes et commentaires par post.
//
// Réglages dans .env : INSTAGRAM_APP_ID et INSTAGRAM_APP_SECRET (ceux de l'app
// Meta), INSTAGRAM_CONFIG_ID, INSTAGRAM_REDIRECT_URI et INSTAGRAM_URL_PUBLIQUE
// (voir .env.example).

import { createHmac, randomBytes } from 'node:crypto';
import { copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { ErreurReseau, etatsOAuth, stockageJeton } from './commun.js';

export const id = 'instagram';
export const nom = 'Instagram';
export const typesVideo = ['video/mp4', 'video/quicktime'];

const VERSION = 'v26.0';
const API = `https://graph.facebook.com/${VERSION}`;
const DIALOGUE = `https://www.facebook.com/${VERSION}/dialog/oauth`;
// Autorisations à cocher dans la configuration Meta (vérifiées après connexion).
const PERMISSIONS = ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'];

// Les stats sont gardées un moment : l'API limite le nombre d'appels.
const DUREE_CACHE_STATS = 10 * 60 * 1000;
// Posts remontés pour les stats (une demande de vues par post).
const MAX_POSTS = 60;
// Suivi du traitement d'une vidéo par Instagram avant publication.
const INTERVALLE_SUIVI = 15 * 1000;
const DUREE_MAX_SUIVI = 20 * 60 * 1000;

function reglages() {
  const {
    INSTAGRAM_APP_ID: appId,
    INSTAGRAM_APP_SECRET: secret,
    INSTAGRAM_CONFIG_ID: configId,
    INSTAGRAM_REDIRECT_URI: retour,
    INSTAGRAM_URL_PUBLIQUE: publique,
  } = process.env;
  return appId && secret && configId && retour && publique
    ? { appId, secret, configId, retour, publique: publique.replace(/\/+$/, '') }
    : null;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Appels à l'API ------------------------------------------------------------

// Ajoute le jeton et sa signature (appsecret_proof) à une adresse de l'API.
// Sert aussi pour les pages suivantes renvoyées par Meta.
function signer(url, accessToken) {
  const adresse = new URL(url);
  adresse.searchParams.set('access_token', accessToken);
  adresse.searchParams.set(
    'appsecret_proof',
    createHmac('sha256', reglages().secret).update(accessToken).digest('hex'),
  );
  return adresse.toString();
}

async function lireJson(url, init) {
  const reponse = await fetch(url, init);
  const data = await reponse.json().catch(() => ({}));
  if (!reponse.ok || data.error) {
    const erreur = data.error ?? {};
    throw new ErreurReseau(
      reponse.status >= 400 && reponse.status < 500 ? reponse.status : 502,
      messageErreur(erreur),
    );
  }
  return data;
}

function messageErreur(erreur) {
  if (erreur.code === 190) return 'La connexion Instagram n’est plus valable : relie le compte à nouveau.';
  if (erreur.code === 10 || erreur.code === 200) {
    return 'Une autorisation manque : vérifie la configuration Meta, puis délie et relie le compte Instagram.';
  }
  if (erreur.code === 100 && erreur.error_subcode === 33) {
    return 'Meta refuse l’accès à ce compte Instagram : délie puis relie-le en cochant bien ton compte.';
  }
  if (erreur.code === 4 || erreur.code === 17 || erreur.code === 32) {
    return 'Trop de demandes à Instagram : réessaie dans quelques minutes.';
  }
  return `Instagram a répondu : ${erreur.error_user_msg || erreur.message || 'erreur inconnue'}`;
}

// --- Jeton ------------------------------------------------------------------

const jeton = stockageJeton(id);

// Le jeton d'utilisateur système n'expire pas : pas de renouvellement.
async function jetonValide() {
  if (!reglages()) throw new ErreurReseau(503, 'Instagram n’est pas configuré dans .env.');
  const actuel = await jeton.lire();
  if (!actuel?.igId) throw new ErreurReseau(401, "Aucun compte Instagram n'est relié.");
  if (actuel.expireLe && actuel.expireLe < Date.now()) {
    await deconnecter();
    throw new ErreurReseau(401, 'La connexion Instagram a expiré : relie le compte à nouveau.');
  }
  return actuel;
}

// Appel à l'API avec le jeton du compte (paramètres dans l'adresse).
async function appeler(chemin, { methode = 'GET', params = {} } = {}) {
  const { accessToken } = await jetonValide();
  return appelerAvec(accessToken, `${API}${chemin}?${new URLSearchParams(params)}`, methode);
}

async function appelerAvec(accessToken, url, methode = 'GET') {
  try {
    return await lireJson(signer(url, accessToken), { method: methode });
  } catch (err) {
    if (err instanceof ErreurReseau && err.message.startsWith('La connexion Instagram n’est plus valable')) {
      await deconnecter();
    }
    throw err;
  }
}

// --- Connexion --------------------------------------------------------------

const etats = etatsOAuth();

export async function etat() {
  const actuel = reglages() ? await jeton.lire() : null;
  const relie = Boolean(actuel?.igId);
  return {
    id,
    nom,
    configure: Boolean(reglages()),
    connecte: relie,
    manque: relie && Array.isArray(actuel.scopes) ? PERMISSIONS.filter((s) => !actuel.scopes.includes(s)) : [],
    destination: actuel?.username ? `@${actuel.username} en Reel public` : 'Instagram en Reel public',
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
    config_id: r.configId,
    response_type: 'code',
    // Propose de se connecter avec Instagram OU Facebook. Sans ça, Meta
    // utilise d'office la session Facebook et ne liste que les comptes
    // Instagram rangés dans un portefeuille business de ce compte Facebook.
    prompt: 'login',
    state: etats.creer(randomBytes(16).toString('hex')),
  });
  return `${DIALOGUE}?${params}`;
}

// Code → jeton. La doc de Meta n'envoie que client_id, client_secret et code ;
// si Meta réclame quand même l'adresse de retour, on réessaie avec.
async function echangerCode(r, code) {
  const base = { client_id: r.appId, client_secret: r.secret, code };
  try {
    return await lireJson(`${API}/oauth/access_token?${new URLSearchParams(base)}`);
  } catch (err) {
    if (!/redirect_uri/i.test(err?.message ?? '')) throw err;
    return lireJson(`${API}/oauth/access_token?${new URLSearchParams({ ...base, redirect_uri: r.retour })}`);
  }
}

// Compte Instagram attribué à la connexion. Meta met parfois quelques secondes
// à le rendre visible : on réessaie, puis on regarde dans le portefeuille business.
async function trouverCompte(accessToken, idBusiness) {
  let derniereErreur;
  for (let essai = 0; essai < 4; essai++) {
    if (essai > 0) await attendre(2500);
    try {
      const { data = [] } = await appelerAvec(
        accessToken,
        `${API}/me/assigned_instagram_accounts?${new URLSearchParams({ fields: 'id,username' })}`,
      );
      if (data.length > 0) return data[0];
    } catch (err) {
      derniereErreur = err;
    }
  }
  if (idBusiness) {
    try {
      const { data = [] } = await appelerAvec(
        accessToken,
        `${API}/${idBusiness}/owned_instagram_accounts?${new URLSearchParams({ fields: 'id,username' })}`,
      );
      if (data.length > 0) return data[0];
    } catch (err) {
      derniereErreur = err;
    }
  }
  if (derniereErreur) console.error('[Log Pose] Recherche du compte Instagram :', derniereErreur.message);
  throw new ErreurReseau(
    400,
    "Aucun compte Instagram n'est rattaché à cette connexion : relance « Relier » et coche bien ton compte Instagram.",
  );
}

// Autorisations réellement accordées (null si Meta ne les donne pas).
async function lirePermissions(accessToken) {
  try {
    const { data = [] } = await appelerAvec(accessToken, `${API}/me/permissions`);
    return data.filter((p) => p.status === 'granted').map((p) => p.permission);
  } catch {
    return null;
  }
}

export async function terminerConnexion({ code, state, error, error_description, error_reason }) {
  if (error) throw new ErreurReseau(400, `Connexion annulée : ${error_description || error_reason || error}`);
  etats.verifier(state);
  if (!code) throw new ErreurReseau(400, 'Code de connexion manquant.');
  const r = reglages();
  if (!r) throw new ErreurReseau(503, 'Instagram n’est pas configuré dans .env.');

  const reponse = await echangerCode(r, String(code).replace(/#_$/, ''));
  const accessToken = reponse.access_token;
  if (!accessToken) throw new ErreurReseau(502, 'Meta n’a pas renvoyé de jeton de connexion.');

  let idBusiness = reponse.client_business_id ?? null;
  if (!idBusiness) {
    try {
      idBusiness = (await appelerAvec(accessToken, `${API}/me?fields=client_business_id`)).client_business_id ?? null;
    } catch {
      idBusiness = null;
    }
  }

  const compte = await trouverCompte(accessToken, idBusiness);
  const maintenant = Date.now();
  await jeton.sauver({
    accessToken,
    obtenuLe: maintenant,
    expireLe: reponse.expires_in ? maintenant + reponse.expires_in * 1000 : null,
    igId: compte.id,
    username: compte.username ?? null,
    idBusiness,
    scopes: await lirePermissions(accessToken),
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

  const { igId, accessToken } = await jetonValide();
  const moi = await appeler(`/${igId}`, {
    params: { fields: 'id,username,name,profile_picture_url,followers_count,media_count' },
  });

  const posts = [];
  let page = await appeler(`/${igId}/media`, { params: { fields: CHAMPS_POST, limit: '25' } });
  for (;;) {
    posts.push(...(page.data ?? []));
    const suivante = page.paging?.next;
    if (!suivante || posts.length >= MAX_POSTS) break;
    page = await appelerAvec(accessToken, suivante);
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
