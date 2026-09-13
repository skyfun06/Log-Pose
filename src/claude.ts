// Client Claude pour l'équipage du Going Merry.
// Envoie une conversation (system prompt + messages) au serveur relais
// (server/index.js) qui la transmet à l'API Anthropic, en streaming, et gère
// la boucle d'appels d'outils (« tool calling ») : le Capitaine peut ainsi
// agir sur l'app (ex : mettre à jour l'agenda). Voir src/config.ts.

import { API_URL } from './config';

export interface MessageChat {
  role: 'user' | 'assistant';
  content: string;
  // Images jointes (data URLs, ex : "data:image/jpeg;base64,..."). Elles
  // servent à l'affichage ET sont envoyées à Claude comme blocs image.
  images?: string[];
}

// --- Outils (tool calling), au format Anthropic ----------------------------

export interface OutilIA {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// --- Blocs de contenu tels qu'attendus / renvoyés par l'API Anthropic ------

type BlocImage = {
  type: 'image';
  source: { type: 'base64'; media_type: string; data: string };
};

type BlocContenu =
  | { type: 'text'; text: string }
  | BlocImage
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

interface MessageApi {
  role: 'user' | 'assistant';
  content: BlocContenu[];
}

// Nombre max de messages envoyés à l'API (l'historique complet reste affiché
// et sauvegardé côté UI ; on borne juste ce qui part au modèle → coût maîtrisé).
const FENETRE_MESSAGES = 30;

// Au-delà de ce nombre de messages en fin d'historique, les images des
// messages plus anciens ne sont plus renvoyées (elles ont déjà été analysées ;
// les re-envoyer à chaque tour coûterait cher pour rien).
const FENETRE_IMAGES = 6;

// Garde-fou : nombre max d'allers-retours modèle ↔ outils pour une réponse.
const MAX_TOURS = 8;

// Formats d'image acceptés par l'API Anthropic.
const TYPES_IMAGE = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// Transforme une data URL en bloc image Anthropic (ou null si inutilisable).
function dataUrlEnBlocImage(dataUrl: string): BlocImage | null {
  const m = dataUrl.match(/^data:([a-z0-9/+.-]+);base64,(.+)$/i);
  if (!m) return null;
  const mediaType = m[1].toLowerCase();
  if (!TYPES_IMAGE.has(mediaType)) return null;
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data: m[2] } };
}

// Convertit l'historique UI en messages API : fenêtre bornée, images
// dépouillées sur les vieux messages, bulles vides ignorées, et on s'assure
// que la conversation commence par un message utilisateur (exigence API).
function versMessagesApi(messages: MessageChat[]): MessageApi[] {
  const fenetre = messages
    .filter((m) => m.content.trim() !== '' || (m.images?.length ?? 0) > 0)
    .slice(-FENETRE_MESSAGES);

  const seuilImages = fenetre.length - FENETRE_IMAGES;

  const convertis = fenetre.map((m, i): MessageApi => {
    const blocs: BlocContenu[] = [];
    if (m.role === 'user' && m.images && i >= seuilImages) {
      for (const img of m.images) {
        const bloc = dataUrlEnBlocImage(img);
        if (bloc) blocs.push(bloc);
      }
    }
    const texte =
      m.content.trim() ||
      (m.images?.length ? '(image jointe, déjà analysée plus haut)' : '');
    if (texte) blocs.push({ type: 'text', text: texte });
    return { role: m.role, content: blocs };
  });

  // L'API exige que le premier message soit un message utilisateur.
  while (convertis.length > 0 && convertis[0].role !== 'user') convertis.shift();
  return convertis;
}

export interface OptionsChat {
  // Appelé à chaque morceau de texte reçu, avec le texte cumulé du tour courant.
  onMorceau?: (texteCumule: string) => void;
  // Outils que le modèle peut appeler.
  tools?: OutilIA[];
  // Exécute un outil et renvoie un résultat texte (renvoyé au modèle).
  executerOutil?: (nom: string, args: Record<string, unknown>) => Promise<string> | string;
  // Signalé quand le modèle déclenche un outil (pratique pour l'UI).
  onOutil?: (nom: string, args: Record<string, unknown>) => void;
}

// Envoie la conversation à Claude (via le relais) et renvoie le texte final.
// Gère automatiquement la boucle d'appels d'outils si `tools` est fourni.
export async function discuterAvecClaude(
  systemPrompt: string,
  messages: MessageChat[],
  options: OptionsChat = {},
): Promise<string> {
  const { onMorceau, tools, executerOutil, onOutil } = options;

  const historique = versMessagesApi(messages);
  let texteFinal = '';

  for (let tour = 0; tour < MAX_TOURS; tour++) {
    const { texte, contenu, stopReason } = await streamerUnTour(
      systemPrompt,
      historique,
      tools,
      onMorceau,
    );
    texteFinal = texte;

    // Pas d'outil demandé : c'est la réponse finale.
    if (stopReason !== 'tool_use') break;

    // Le modèle veut appeler des outils : on renvoie sa réponse telle quelle
    // (blocs tool_use inclus), on exécute chaque outil, puis on reboucle pour
    // qu'il rédige sa réponse en tenant compte des résultats.
    historique.push({ role: 'assistant', content: contenu });

    const resultats: BlocContenu[] = [];
    for (const bloc of contenu) {
      if (bloc.type !== 'tool_use') continue;
      const args = bloc.input ?? {};
      onOutil?.(bloc.name, args);
      let resultat: string;
      let enErreur = false;
      try {
        resultat = executerOutil
          ? await executerOutil(bloc.name, args)
          : `Outil « ${bloc.name} » indisponible.`;
      } catch (err) {
        resultat = `Erreur pendant l'outil « ${bloc.name} » : ${
          err instanceof Error ? err.message : 'inconnue'
        }`;
        enErreur = true;
      }
      resultats.push({
        type: 'tool_result',
        tool_use_id: bloc.id,
        content: resultat,
        ...(enErreur ? { is_error: true } : {}),
      });
    }
    historique.push({ role: 'user', content: resultats });
  }

  return texteFinal;
}

// Effectue UN tour : envoie l'historique au relais, lit le flux NDJSON, et
// renvoie le texte produit, les blocs complets et la raison d'arrêt.
async function streamerUnTour(
  systemPrompt: string,
  historique: MessageApi[],
  tools: OutilIA[] | undefined,
  onMorceau?: (texteCumule: string) => void,
): Promise<{ texte: string; contenu: BlocContenu[]; stopReason: string | null }> {
  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        messages: historique,
        ...(tools && tools.length ? { tools } : {}),
      }),
    });
  } catch {
    throw new Error(
      'Impossible de joindre le serveur relais. Lance-le dans un autre terminal avec « npm run server ».',
    );
  }

  if (!reponse.ok) {
    let detail = '';
    try {
      const data = (await reponse.json()) as { error?: string };
      detail = data.error ?? '';
    } catch {
      detail = await reponse.text().catch(() => '');
    }
    throw new Error(detail || `Le serveur relais a répondu ${reponse.status}.`);
  }

  let texte = '';
  let contenu: BlocContenu[] = [];
  let stopReason: string | null = null;
  let erreurFlux: string | null = null;

  const traiterLigne = (ligne: string) => {
    const propre = ligne.trim();
    if (!propre) return;
    let obj: {
      type?: string;
      texte?: string;
      contenu?: BlocContenu[];
      stop_reason?: string;
      erreur?: string;
    };
    try {
      obj = JSON.parse(propre);
    } catch {
      return; // ligne partielle ou non-JSON : on ignore
    }
    if (obj.type === 'texte' && obj.texte) {
      texte += obj.texte;
      onMorceau?.(texte);
    } else if (obj.type === 'fin') {
      contenu = obj.contenu ?? [];
      stopReason = obj.stop_reason ?? null;
    } else if (obj.type === 'erreur') {
      erreurFlux = obj.erreur ?? 'Erreur inconnue côté serveur.';
    }
  };

  if (!reponse.body) {
    // Pas de flux (vieux navigateur) : lecture du corps entier d'un coup.
    const brut = await reponse.text();
    brut.split('\n').forEach(traiterLigne);
  } else {
    // NDJSON : un objet JSON par ligne.
    const lecteur = reponse.body.getReader();
    const decodeur = new TextDecoder();
    let tampon = '';
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      tampon += decodeur.decode(value, { stream: true });
      let saut: number;
      while ((saut = tampon.indexOf('\n')) !== -1) {
        traiterLigne(tampon.slice(0, saut));
        tampon = tampon.slice(saut + 1);
      }
    }
    traiterLigne(tampon); // reste éventuel sans saut de ligne final
  }

  if (erreurFlux) throw new Error(erreurFlux);
  return { texte, contenu, stopReason };
}
