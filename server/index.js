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
  if (!client) client = new Anthropic(); // lit ANTHROPIC_API_KEY depuis l'env
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

app.listen(PORT, () => {
  console.log(`[Log Pose] Serveur relais démarré sur http://localhost:${PORT} (modèle : ${MODEL})`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '[Log Pose] ⚠️  Clé API manquante : renseigne ANTHROPIC_API_KEY dans .env.\n' +
        "            Le serveur tourne, mais /api/chat renverra une erreur claire tant que la clé n'est pas là.",
    );
  }
});
