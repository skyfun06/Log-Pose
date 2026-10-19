// Second cerveau : fichiers rangés sur le serveur relais (server/cerveau.js),
// et conversation pour les retrouver (gardée dans le localStorage).

import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../config';
import type { FicheCerveau, InfosCerveau, MessageCerveau } from '../types';

const CLE_CHAT = 'log-pose-cerveau-chat';
const MAX_MESSAGES = 60;

// Tant qu'Ollama lit des fichiers, on rafraîchit la liste à ce rythme.
const RYTHME_LECTURE_MS = 4000;

const ERREUR_RELAIS =
  'Impossible de joindre le serveur relais. Lance-le dans un autre terminal avec « npm run server ».';

// Appel au serveur relais, avec un message d'erreur lisible.
async function appeler<T>(chemin: string, init?: RequestInit): Promise<T> {
  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}/api/cerveau${chemin}`, init);
  } catch {
    throw new Error(ERREUR_RELAIS);
  }
  const data = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    throw new Error((data as { error?: string } | null)?.error ?? `Le serveur relais a répondu ${reponse.status}.`);
  }
  return data as T;
}

export function urlFichier(id: string, telecharger = false) {
  return `${API_URL}/api/cerveau/${id}/fichier${telecharger ? '?telecharger=1' : ''}`;
}

function chargerChat(): MessageCerveau[] {
  try {
    const lu = JSON.parse(localStorage.getItem(CLE_CHAT) ?? '[]') as unknown;
    return Array.isArray(lu)
      ? lu.filter(
          (m): m is MessageCerveau =>
            typeof m === 'object' && m !== null && typeof (m as MessageCerveau).content === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

export function useCerveau() {
  const [fichiers, setFichiers] = useState<FicheCerveau[]>([]);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const rafraichir = useCallback(async () => {
    try {
      const data = await appeler<{ fichiers: FicheCerveau[] }>('');
      setFichiers(data.fichiers);
      setErreur(null);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setCharge(true);
    }
  }, []);

  useEffect(() => {
    void rafraichir();
  }, [rafraichir]);

  // Suit la lecture des fichiers fraîchement déposés.
  const enLecture = fichiers.some((f) => f.analyse.etat === 'attente' || f.analyse.etat === 'en-cours');
  useEffect(() => {
    if (!enLecture) return;
    const id = setInterval(() => void rafraichir(), RYTHME_LECTURE_MS);
    return () => clearInterval(id);
  }, [enLecture, rafraichir]);

  const remplacer = (fiche: FicheCerveau) =>
    setFichiers((prev) => prev.map((f) => (f.id === fiche.id ? fiche : f)));

  async function deposer(fichier: File, infos: InfosCerveau) {
    const fiche = await appeler<FicheCerveau>('', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Cerveau-Infos': encodeURIComponent(
          JSON.stringify({ ...infos, type: fichier.type, nomOrigine: fichier.name }),
        ),
      },
      body: fichier,
    });
    setFichiers((prev) => [fiche, ...prev]);
    return fiche;
  }

  async function modifier(id: string, infos: InfosCerveau) {
    remplacer(
      await appeler<FicheCerveau>(`/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(infos),
      }),
    );
  }

  async function supprimer(id: string) {
    await appeler(`/${id}`, { method: 'DELETE' });
    setFichiers((prev) => prev.filter((f) => f.id !== id));
  }

  async function relire(id: string) {
    remplacer(await appeler<FicheCerveau>(`/${id}/relire`, { method: 'POST' }));
  }

  // --- Conversation ---------------------------------------------------------

  const [messages, setMessages] = useState<MessageCerveau[]>(chargerChat);
  const [reflechit, setReflechit] = useState(false);
  // Fichiers trouvés par mots-clés, affichés pendant qu'Ollama réfléchit.
  const [pistes, setPistes] = useState<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(CLE_CHAT, JSON.stringify(messages.slice(-MAX_MESSAGES)));
    } catch {
      /* stockage plein ou bloqué : la conversation reste à l'écran */
    }
  }, [messages]);

  async function demander(question: string) {
    const texte = question.trim();
    if (!texte || reflechit) return;
    const historique = messages.slice(-4).map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { role: 'user', content: texte }]);
    setReflechit(true);
    setPistes([]);
    const repondre = (content: string, ids: string[] = []) =>
      setMessages((prev) => [...prev, { role: 'assistant', content, ids }]);
    try {
      let reponse: Response;
      try {
        reponse = await fetch(`${API_URL}/api/cerveau/demander`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: texte, historique }),
        });
      } catch {
        throw new Error(ERREUR_RELAIS);
      }
      if (!reponse.ok || !reponse.body) {
        const data = (await reponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Le serveur relais a répondu ${reponse.status}.`);
      }

      // NDJSON : { type: 'pistes', ids } puis { type: 'reponse', reponse, ids }.
      let finale: { reponse: string; ids: string[] } | null = null;
      const lireLigne = (ligne: string) => {
        if (!ligne.trim()) return;
        const evenement = JSON.parse(ligne) as { type: string; reponse?: string; ids?: string[] };
        if (evenement.type === 'pistes') setPistes(evenement.ids ?? []);
        else if (evenement.type === 'reponse') finale = { reponse: evenement.reponse ?? '', ids: evenement.ids ?? [] };
      };
      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = '';
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });
        let saut: number;
        while ((saut = tampon.indexOf('\n')) !== -1) {
          lireLigne(tampon.slice(0, saut));
          tampon = tampon.slice(saut + 1);
        }
      }
      lireLigne(tampon);
      const resultat = finale as { reponse: string; ids: string[] } | null;
      if (!resultat) throw new Error("La recherche s'est interrompue. Réessaie.");
      repondre(resultat.reponse, resultat.ids);
    } catch (err) {
      repondre(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      setReflechit(false);
      setPistes([]);
    }
  }

  const effacerChat = () => setMessages([]);

  return {
    fichiers,
    charge,
    erreur,
    deposer,
    modifier,
    supprimer,
    relire,
    messages,
    reflechit,
    pistes,
    demander,
    effacerChat,
  };
}
