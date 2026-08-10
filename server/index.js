// Serveur relais Log Pose
// Unique rôle : cacher la clé API Anthropic et relayer les messages entre le
// front (Vite) et l'API Claude. La clé n'est JAMAIS envoyée au front.
//
// La clé se lit uniquement depuis process.env.ANTHROPIC_API_KEY (chargée depuis
// le fichier .env via le flag --env-file-if-exists du script npm "server").

import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

// --- Réglages faciles à changer -------------------------------------------

// Modèle le moins cher par défaut. Change juste cette constante pour en essayer
// un autre (ex : "claude-sonnet-5" pour plus de qualité, plus cher).
const MODEL = 'claude-haiku-4-5-20251001';

// Plafond de tokens en sortie : limite le coût de chaque réponse.
const MAX_TOKENS = 1024;

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
app.use(cors()); // le front tourne sur un autre port (5173) → CORS nécessaire
app.use(express.json({ limit: '1mb' }));

// Petit point de contrôle pour vérifier que le serveur tourne (et si la clé est là).
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(process.env.ANTHROPIC_API_KEY), model: MODEL });
});

// Route unique : relaie une conversation vers Claude et renvoie le texte.
app.post('/api/chat', async (req, res) => {
  const anthropic = getClient();
  if (!anthropic) {
    return res.status(503).json({
      error:
        "Clé API manquante : renseigne ANTHROPIC_API_KEY dans le fichier .env, puis relance le serveur.",
    });
  }

  const { systemPrompt, messages } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: "Requête invalide : 'messages' doit être un tableau non vide.",
    });
  }

  try {
    const reponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      messages,
    });

    // On ne renvoie QUE le texte : on concatène les blocs de type "text".
    const text = reponse.content
      .filter((bloc) => bloc.type === 'text')
      .map((bloc) => bloc.text)
      .join('');

    res.json({ text });
  } catch (err) {
    // On loggue le minimum côté serveur, et on renvoie un message clair au front.
    // Les messages d'erreur du SDK ne contiennent jamais la clé.
    console.error('[Log Pose] Erreur API Anthropic:', err?.status ?? '', err?.message ?? err);
    res.status(err?.status ?? 500).json({
      error: "Erreur lors de l'appel à l'API Claude : " + (err?.message ?? 'inconnue'),
    });
  }
});

app.listen(PORT, () => {
  console.log(`[Log Pose] Serveur relais démarré sur http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '[Log Pose] ⚠️  Clé API manquante : renseigne ANTHROPIC_API_KEY dans .env.\n' +
        "            Le serveur tourne, mais /api/chat renverra une erreur claire tant que la clé n'est pas là.",
    );
  }
});
