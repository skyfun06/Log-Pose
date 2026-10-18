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

import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { releverCourrier } from './mails.js';
import { creerRecap, listerRecaps, planifierReleves } from './recaps.js';

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
      /^(10.|192.168.|172.(1[6-9]|2d|3[01]).)/.test(hote)
    ) {
      return next();
    }
  } catch {
    // Origin illisible : refusé ci-dessous.
  }
  res.status(403).json({ error: 'Accessible uniquement depuis le réseau local.' });
}

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
    const { planning, habitudes, refaire } = req.body ?? {};
    res.json(await creerRecap({ planning, habitudes }, { refaire: refaire === true }));
  } catch (err) {
    console.error('[Log Pose] Erreur récap:', err?.message ?? err);
    res.status(500).json({ error: 'Impossible de préparer le récap : ' + (err?.message ?? 'inconnue') });
  }
});

app.listen(PORT, () => {
  planifierReleves();
  console.log(`[Log Pose] Serveur relais démarré sur http://localhost:${PORT} (modèle : ${MODEL})`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '[Log Pose] ⚠️  Clé API manquante : renseigne ANTHROPIC_API_KEY dans .env.\n' +
        "            Le serveur tourne, mais /api/chat renverra une erreur claire tant que la clé n'est pas là.",
    );
  }
});
