// Serveur relais Log Pose
// Unique rôle : cacher la clé API Anthropic et relayer les conversations entre
// le front (Vite) et l'API Claude. La clé n'est JAMAIS envoyée au front.
//
// La route /api/chat accepte une conversation complète au format Anthropic
// (blocs texte / image / tool_use / tool_result) plus une liste d'outils, et
// renvoie la réponse en streaming NDJSON :
//   {"type":"texte","texte":"..."}          → morceau de texte au fil de l'eau
//   {"type":"fin","contenu":[...],"stop_reason":"..."} → réponse complète
//   {"type":"erreur","erreur":"..."}        → erreur survenue en cours de flux
//
// La clé se lit uniquement depuis process.env.ANTHROPIC_API_KEY (chargée depuis
// le fichier .env via le flag --env-file-if-exists du script npm "server").

import { createWriteStream, existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { releverCourrier } from './mails.js';
import { creerRecap, listerRecaps, planifierReleves } from './recaps.js';
import { ecrireDonnee, lireDonnees } from './donnees.js';
import {
  ErreurCerveau,
  ajouterFichier,
  demander,
  listerFichiers,
  modifierFichier,
  relancerAnalyse,
  reprendreAnalyses,
  supprimerFichier,
  trouverFichier,
} from './cerveau.js';
import {
  ErreurReseau,
  TYPES_VIDEO,
  demarrerReseaux,
  envoyerPartout,
  etatReseaux,
  plateforme,
} from './reseaux/index.js';

// --- Réglages faciles à changer -------------------------------------------

// Haiku 4.5 : rapide, économique, et gère la vision + les outils — tout ce
// qu'il faut pour que le Capitaine lise un planning et remplisse l'agenda.
// Surchargeable via ANTHROPIC_MODEL dans .env (ex : "claude-sonnet-5" pour
// encore plus de précision, plus cher).
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5';

// Plafond de tokens en sortie : limite le coût de chaque réponse. Assez large
// pour qu'une capture de planning avec beaucoup de services passe en un tour.
const MAX_TOKENS = 4096;

const PORT = process.env.PORT ?? 3001;

// --- Client Anthropic (créé à la demande) ---------------------------------
// On ne crée pas le client au démarrage : sans clé, le SDK lèverait une erreur
// et ferait planter le serveur. On le crée paresseusement, seulement si la clé
// est présente, pour que le serveur puisse démarrer même sans clé.
let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    // Une clé créée « hors workspace » exige l'en-tête anthropic-workspace-id :
    // on le renseigne depuis ANTHROPIC_WORKSPACE_ID (.env) si présent.
    client = new Anthropic({
      ...(process.env.ANTHROPIC_WORKSPACE_ID
        ? { defaultHeaders: { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } }
        : {}),
    }); // lit ANTHROPIC_API_KEY depuis l'env
  }
  return client;
}

// --- App -------------------------------------------------------------------
const app = express();
app.use(cors()); // utile si le front n'est pas servi via le proxy Vite
// Les images (base64) gonflent vite le corps des requêtes : limite large.
app.use(express.json({ limit: '25mb' }));

// Petit point de contrôle pour vérifier que le serveur tourne (et si la clé est là).
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL });
});

// Route unique : relaie une conversation vers Claude, en streaming NDJSON.
app.post('/api/chat', async (req, res) => {
  const anthropic = getClient();
  if (!anthropic) {
    return res.status(503).json({
      error:
        "Clé API manquante : renseigne ANTHROPIC_API_KEY dans le fichier .env, puis relance le serveur.",
    });
  }

  const { systemPrompt, messages, tools } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "Requête invalide : 'messages' doit être un tableau non vide.",
    });
  }

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(Array.isArray(tools) && tools.length > 0 ? { tools } : {}),
      messages,
    });

    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    // Chaque morceau de texte part immédiatement vers le front.
    stream.on('text', (texte) => {
      res.write(JSON.stringify({ type: 'texte', texte }) + '\n');
    });

    // Message final complet : contient les blocs texte ET les appels d'outils
    // (tool_use) que le front doit exécuter puis renvoyer.
    const final = await stream.finalMessage();
    res.write(
      JSON.stringify({ type: 'fin', contenu: final.content, stop_reason: final.stop_reason }) +
        '\n',
    );
    res.end();
  } catch (err) {
    // On loggue le minimum côté serveur, et on renvoie un message clair au front.
    // Les messages d'erreur du SDK ne contiennent jamais la clé.
    console.error('[Log Pose] Erreur API Anthropic:', err?.status ?? '', err?.message ?? err);
    const message = "Erreur lors de l'appel à l'API Claude : " + (err?.message ?? 'inconnue');
    if (res.headersSent) {
      // Le flux avait commencé : on signale l'erreur dans le flux puis on ferme.
      res.write(JSON.stringify({ type: 'erreur', erreur: message }) + '\n');
      res.end();
    } else {
      res.status(err?.status ?? 500).json({ error: message });
    }
  }
});

// Le courrier et les récaps sont privés : cors() étant ouvert, n'importe quel site visité dans
// le navigateur pourrait sinon interroger ce serveur et lire la réponse. On ne
// sert donc que les pages ouvertes depuis cette machine ou le réseau local.
function origineLocale(req, res, next) {
  const origine = req.headers.origin;
  if (!origine) return next(); // même origine (proxy Vite) : pas d'en-tête Origin
  try {
    const hote = new URL(origine).hostname;
    if (
      hote === 'localhost' ||
      hote === '127.0.0.1' ||
      hote === '[::1]' ||
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hote) ||
      // Tailscale : adresses 100.64.0.0/10 et noms en .ts.net
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(hote) ||
      hote.endsWith('.ts.net')
    ) {
      return next();
    }
  } catch {
    // Origin illisible : refusé ci-dessous.
  }
  res.status(403).json({ error: 'Accessible uniquement depuis le réseau local.' });
}

// Données synchronisées entre le PC et le téléphone (voir server/donnees.js).
app.get('/api/donnees', origineLocale, async (_req, res) => {
  try {
    res.json(await lireDonnees());
  } catch (err) {
    console.error('[Log Pose] Erreur données:', err?.message ?? err);
    res.status(500).json({ error: 'Impossible de lire les données : ' + (err?.message ?? 'inconnue') });
  }
});

app.put('/api/donnees/:cle', origineLocale, async (req, res) => {
  try {
    const { valeur, maj } = req.body ?? {};
    res.json(await ecrireDonnee(req.params.cle, valeur, maj));
  } catch (err) {
    res.status(400).json({ error: err?.message ?? 'Donnée refusée.' });
  }
});

// Mails importants des boîtes Gmail (voir server/mails.js). « ?forcer=1 »
// ignore le relevé gardé en mémoire.
app.get('/api/mails', origineLocale, async (req, res) => {
  try {
    res.json(await releverCourrier({ forcer: req.query.forcer === '1' }));
  } catch (err) {
    console.error('[Log Pose] Erreur courrier:', err?.message ?? err);
    res.status(500).json({ error: 'Impossible de relever le courrier : ' + (err?.message ?? 'inconnue') });
  }
});

// Récaps du matin et du soir (voir server/recaps.js). Le GET renvoie
// l'historique et le créneau en cours ; le POST crée le récap du créneau à
// partir du planning et des habitudes fournis par le front.
app.get('/api/recaps', origineLocale, async (_req, res) => {
  try {
    res.json(await listerRecaps());
  } catch (err) {
    console.error('[Log Pose] Erreur récaps:', err?.message ?? err);
    res.status(500).json({ error: 'Impossible de lire les récaps : ' + (err?.message ?? 'inconnue') });
  }
});

app.post('/api/recaps', origineLocale, async (req, res) => {
  try {
    const { planning, habitudes, contexte, refaire } = req.body ?? {};
    res.json(await creerRecap({ planning, habitudes, contexte }, { refaire: refaire === true }));
  } catch (err) {
    console.error('[Log Pose] Erreur récap:', err?.message ?? err);
    res.status(500).json({ error: 'Impossible de préparer le récap : ' + (err?.message ?? 'inconnue') });
  }
});

// Second cerveau (voir server/cerveau.js) : fichiers déposés avec leurs infos,
// retrouvés en posant la question en langage naturel.
function erreurCerveau(res, err, contexte) {
  if (err instanceof ErreurCerveau) return res.status(err.statut).json({ error: err.message });
  console.error(`[Log Pose] Erreur cerveau (${contexte}):`, err?.message ?? err);
  res.status(500).json({ error: `${contexte} : ${err?.message ?? 'erreur inconnue'}` });
}

app.get('/api/cerveau', origineLocale, async (_req, res) => {
  try {
    res.json(await listerFichiers());
  } catch (err) {
    erreurCerveau(res, err, 'Impossible de lire le cerveau');
  }
});

// Le fichier arrive brut dans le corps (toujours en application/octet-stream,
// sinon un .json serait avalé par express.json) ; ses infos (nom, catégorie,
// type réel...) dans l'en-tête X-Cerveau-Infos, en JSON encodé (accents compris).
app.post(
  '/api/cerveau',
  origineLocale,
  express.raw({ type: () => true, limit: '200mb' }),
  async (req, res) => {
    try {
      let infos = {};
      try {
        infos = JSON.parse(decodeURIComponent(req.get('x-cerveau-infos') ?? '{}'));
      } catch {
        throw new ErreurCerveau(400, 'Infos du fichier illisibles.');
      }
      if (!Buffer.isBuffer(req.body)) throw new ErreurCerveau(400, 'Fichier manquant.');
      res.json(
        await ajouterFichier(req.body, {
          infos,
          type: infos.type,
          nomOrigine: infos.nomOrigine,
        }),
      );
    } catch (err) {
      erreurCerveau(res, err, "Impossible de ranger le fichier");
    }
  },
);

app.patch('/api/cerveau/:id', origineLocale, async (req, res) => {
  try {
    res.json(await modifierFichier(req.params.id, req.body ?? {}));
  } catch (err) {
    erreurCerveau(res, err, 'Impossible de modifier le fichier');
  }
});

app.delete('/api/cerveau/:id', origineLocale, async (req, res) => {
  try {
    await supprimerFichier(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    erreurCerveau(res, err, 'Impossible de supprimer le fichier');
  }
});

app.post('/api/cerveau/:id/relire', origineLocale, async (req, res) => {
  try {
    res.json(await relancerAnalyse(req.params.id));
  } catch (err) {
    erreurCerveau(res, err, 'Impossible de relancer la lecture');
  }
});

// « ?telecharger=1 » force le téléchargement au lieu de l'affichage ;
// « ?apercu=1 » renvoie la miniature (images seulement).
app.get('/api/cerveau/:id/fichier', origineLocale, async (req, res) => {
  try {
    const { chemin, entetes } = await trouverFichier(req.params.id, {
      telecharger: req.query.telecharger === '1',
      apercu: req.query.apercu === '1',
    });
    res.set(entetes).sendFile(chemin);
  } catch (err) {
    erreurCerveau(res, err, 'Impossible de lire le fichier');
  }
});

// Réponse en NDJSON : les pistes par mots-clés d'abord, puis la réponse d'Ollama.
app.post('/api/cerveau/demander', origineLocale, async (req, res) => {
  try {
    const { question, historique } = req.body ?? {};
    await demander(question, historique, (evenement) => {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
      }
      res.write(JSON.stringify(evenement) + '\n');
    });
    res.end();
  } catch (err) {
    if (res.headersSent) return res.end();
    erreurCerveau(res, err, 'Impossible de chercher');
  }
});

// Réseaux (voir server/reseaux/index.js) : comptes TikTok, Instagram, YouTube…
// reliés, envoi d'une vidéo sur plusieurs plateformes, stats de chacune.
function erreurReseau(res, err, contexte) {
  if (err instanceof ErreurReseau) return res.status(err.statut).json({ error: err.message });
  console.error(`[Log Pose] Erreur réseaux (${contexte}):`, err?.message ?? err);
  res.status(500).json({ error: `${contexte} : ${err?.message ?? 'erreur inconnue'}` });
}

app.get('/api/reseaux', origineLocale, async (_req, res) => {
  try {
    res.json(await etatReseaux());
  } catch (err) {
    erreurReseau(res, err, 'Impossible de lire les comptes');
  }
});

// La vidéo arrive brute dans le corps (Content-Type = son type), les
// plateformes visées dans « ?vers=tiktok,youtube », la légende (facultative)
// dans l'en-tête X-Reseaux-Legende, encodée (accents compris). Elle passe par
// un fichier temporaire, puis part vers chacune.
app.post('/api/reseaux/videos', origineLocale, async (req, res) => {
  const type = req.get('content-type')?.split(';')[0].trim();
  if (!TYPES_VIDEO.includes(type)) {
    return res.status(415).json({ error: 'Format de vidéo non accepté (MP4, MOV ou WebM).' });
  }
  const temporaire = join(tmpdir(), `log-pose-video-${randomUUID()}`);
  try {
    const cibles = String(req.query.vers ?? '').split(',').filter(Boolean);
    if (cibles.length === 0) throw new ErreurReseau(400, 'Aucune plateforme choisie.');
    cibles.forEach(plateforme); // plateformes inconnues refusées avant l'envoi
    let legende = '';
    try {
      legende = decodeURIComponent(req.get('x-reseaux-legende') ?? '').slice(0, 2200);
    } catch {
      throw new ErreurReseau(400, 'Légende illisible.');
    }
    await pipeline(req, createWriteStream(temporaire));
    res.json({ envois: await envoyerPartout(temporaire, type, cibles, { legende }) });
  } catch (err) {
    erreurReseau(res, err, "Impossible d'envoyer la vidéo");
  } finally {
    await rm(temporaire, { force: true });
  }
});

app.get('/api/reseaux/:plateforme/connexion', origineLocale, (req, res) => {
  try {
    res.json({ lien: plateforme(req.params.plateforme).lienConnexion() });
  } catch (err) {
    erreurReseau(res, err, 'Impossible de préparer la connexion');
  }
});

// Adresse de retour OAuth (ex : TIKTOK_REDIRECT_URI) : la plateforme y renvoie
// le navigateur après l'autorisation. Ouverte par elle, donc sans contrôle
// d'origine : le « state » à usage unique protège la connexion.
app.get('/api/reseaux/:plateforme/retour', async (req, res) => {
  const page = (titre, texte) =>
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${titre}</title>` +
    `<body style="font-family:system-ui;background:#1c130b;color:#f3e6c8;display:grid;place-items:center;min-height:90vh;text-align:center">` +
    `<div><h1>${titre}</h1><p>${texte}</p></div>`;
  try {
    const p = plateforme(req.params.plateforme);
    await p.terminerConnexion(req.query);
    res.send(page(`Compte ${p.nom} relié ✓`, 'Tu peux fermer cet onglet et revenir sur Log Pose.'));
  } catch (err) {
    const texte = String(err?.message ?? 'erreur inconnue').replace(/[<>&]/g, '');
    res.status(err instanceof ErreurReseau ? err.statut : 500).send(page('Connexion ratée', texte));
  }
});

// Variante sans page de retour : on colle l'adresse sur laquelle la
// plateforme a renvoyé le navigateur (elle contient le code).
app.post('/api/reseaux/:plateforme/connexion', origineLocale, async (req, res) => {
  try {
    const p = plateforme(req.params.plateforme);
    let parametres;
    try {
      parametres = Object.fromEntries(new URL(String(req.body?.adresse ?? '')).searchParams);
    } catch {
      throw new ErreurReseau(400, "Adresse illisible : colle l'adresse complète de la page de retour.");
    }
    await p.terminerConnexion(parametres);
    res.json(await p.etat());
  } catch (err) {
    erreurReseau(res, err, 'Impossible de relier le compte');
  }
});

app.delete('/api/reseaux/:plateforme/connexion', origineLocale, async (req, res) => {
  try {
    const p = plateforme(req.params.plateforme);
    await p.deconnecter();
    res.json(await p.etat());
  } catch (err) {
    erreurReseau(res, err, 'Impossible de délier le compte');
  }
});

app.get('/api/reseaux/:plateforme/videos/:id', origineLocale, async (req, res) => {
  try {
    res.json(await plateforme(req.params.plateforme).statutEnvoi(req.params.id));
  } catch (err) {
    erreurReseau(res, err, "Impossible de suivre l'envoi");
  }
});

// « ?forcer=1 » ignore les stats gardées en mémoire.
app.get('/api/reseaux/:plateforme/stats', origineLocale, async (req, res) => {
  try {
    res.json(await plateforme(req.params.plateforme).stats({ forcer: req.query.forcer === '1' }));
  } catch (err) {
    erreurReseau(res, err, 'Impossible de lire les stats');
  }
});

// --- Site compilé ----------------------------------------------------------
// Après « npm run build », le serveur sert aussi le site (dossier dist/) : bien
// plus rapide à ouvrir que le mode dev de Vite, surtout depuis le téléphone.
// Les fichiers sont compressés ; ceux dont le nom porte une empreinte (générés
// par Vite) restent en cache dans le navigateur, puisqu'ils ne changent jamais.
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
if (existsSync(DIST)) {
  // Déclarée après les routes /api : leurs réponses en flux ne sont pas retenues.
  app.use(compression());
  app.use(
    express.static(DIST, {
      index: false,
      setHeaders(res, chemin) {
        if (/-[\w-]{8}\.(js|css|webp|png|svg|woff2?)$/.test(chemin)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
  // Toute autre page : l'appli. Jamais mise en cache, pour voir tout de suite
  // la nouvelle version après un « npm run build ».
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(DIST + 'index.html');
  });
}

app.listen(PORT, () => {
  planifierReleves();
  demarrerReseaux();
  void reprendreAnalyses().catch((err) =>
    console.error('[Log Pose] Cerveau illisible:', err?.message ?? err),
  );
  console.log(`[Log Pose] Serveur relais démarré sur http://localhost:${PORT} (modèle : ${MODEL})`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '[Log Pose] ⚠️  Clé API manquante : renseigne ANTHROPIC_API_KEY dans .env.\n' +
        "            Le serveur tourne, mais /api/chat renverra une erreur claire tant que la clé n'est pas là.",
    );
  }
});
