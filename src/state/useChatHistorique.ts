// Sauvegarde automatique des conversations dans le localStorage.
// Une clé par interlocuteur ("capitaine", "equipage-graphiste", ...) : chaque
// discussion survit aux rechargements de page, comme une vraie messagerie.
//
// Le localStorage est limité (~5 Mo) et les images en data URL pèsent lourd :
// on borne donc l'historique sauvegardé et on ne conserve les images que sur
// les messages récents. En cas de quota dépassé malgré tout, on retente sans
// aucune image plutôt que de perdre la conversation.

import { useCallback, useEffect, useState } from 'react';
import type { MessageChat } from '../claude';

const PREFIXE_CLE = 'log-pose-chat:';

// Nombre max de messages conservés sur disque.
const MAX_MESSAGES = 80;

// Seuls les N derniers messages gardent leurs images en sauvegarde.
const MESSAGES_AVEC_IMAGES = 10;

function charger(cle: string): MessageChat[] {
  try {
    const brut = localStorage.getItem(PREFIXE_CLE + cle);
    if (!brut) return [];
    const parsed = JSON.parse(brut) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is MessageChat =>
        typeof m === 'object' &&
        m !== null &&
        ((m as MessageChat).role === 'user' || (m as MessageChat).role === 'assistant') &&
        typeof (m as MessageChat).content === 'string',
    );
  } catch {
    return [];
  }
}

// Prépare la version sauvegardée : bulles vides écartées (ex : réponse IA en
// cours au moment d'un crash), historique borné, vieilles images retirées.
function alleger(messages: MessageChat[]): MessageChat[] {
  const garde = messages
    .filter((m) => m.content.trim() !== '' || (m.images?.length ?? 0) > 0)
    .slice(-MAX_MESSAGES);
  const seuilImages = garde.length - MESSAGES_AVEC_IMAGES;
  return garde.map((m, i) =>
    i < seuilImages && m.images ? { role: m.role, content: m.content } : m,
  );
}

function sauvegarder(cle: string, messages: MessageChat[]) {
  const allege = alleger(messages);
  try {
    localStorage.setItem(PREFIXE_CLE + cle, JSON.stringify(allege));
  } catch {
    // Quota dépassé : on retente sans images, puis on abandonne en silence
    // (la conversation reste intacte à l'écran, seule la sauvegarde saute).
    try {
      const sansImages = allege.map((m) => ({ role: m.role, content: m.content }));
      localStorage.setItem(PREFIXE_CLE + cle, JSON.stringify(sansImages));
    } catch {
      /* tant pis */
    }
  }
}

export function useChatHistorique(cle: string) {
  const [messages, setMessages] = useState<MessageChat[]>(() => charger(cle));

  useEffect(() => {
    sauvegarder(cle, messages);
  }, [cle, messages]);

  const effacer = useCallback(() => {
    setMessages([]);
    try {
      localStorage.removeItem(PREFIXE_CLE + cle);
    } catch {
      /* rien à faire */
    }
  }, [cle]);

  return { messages, setMessages, effacer };
}
