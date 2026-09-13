import { useEffect, useRef, useState } from 'react';
import type { MembreEquipage } from '../data/equipage';
import { equipage } from '../data/equipage';
import { discuterAvecClaude, type MessageChat, type OutilIA } from '../claude';
import { useChatHistorique } from '../state/useChatHistorique';
import type { BlocPlanning, JourSemaine } from '../types';
import styles from './GoingMerry.module.css';

const JOURS_VALIDES: JourSemaine[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

// Contexte temporel injecté dans le prompt pour que le Capitaine sache caler
// « aujourd'hui », « demain », etc. correctement.
function contexteDuJour(): string {
  const d = new Date();
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const abreges: JourSemaine[] = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${jours[d.getDay()]} ${date} (jour abrégé : ${abreges[d.getDay()]})`;
}

// Le Capitaine : mentor personnel de Louis (pas un personnage de fiction). Son
// unique cap : faire de Louis le « Roi des Pirates », c.-à-d. bâtir sa fortune.
// La section AGENDA fixe des règles strictes pour que chaque action sur
// l'emploi du temps soit exacte (ids, format d'heures, anti-doublons...).
function promptCapitaine(): string {
  return `Tu es Le Capitaine : le mentor personnel de Louis. Tu n'es PAS un personnage de fiction pirate, mais un vrai capitaine de vie, exigeant et bienveillant. Ton unique cap, ta boussole dans chaque réponse : faire de Louis le « Roi des Pirates », c'est-à-dire lui faire gagner beaucoup d'argent et bâtir sa liberté financière. Chaque conseil, chaque question, chaque décision doit le rapprocher de cet objectif. Tu penses ROI, effet de levier, priorités et exécution. Tu es direct, orienté action et résultats : tu challenges ses excuses et tu le pousses à passer à l'action, sans jamais être méprisant.

AGENDA — Tu gères toi-même l'emploi du temps hebdomadaire de Louis avec 4 outils : lister_creneaux, ajouter_creneau, modifier_creneau, supprimer_creneau. Règles strictes, à respecter à la lettre :
1. L'agenda est HEBDOMADAIRE et récurrent : un créneau = titre + heure de début + heure de fin + un ou plusieurs jours (lun, mar, mer, jeu, ven, sam, dim). Il n'y a pas de dates : traduis « demain », « vendredi prochain », « le 15 » en jour de semaine à partir de la date du jour.
2. Avant de modifier, supprimer, ou d'ajouter des créneaux issus d'une photo : appelle D'ABORD lister_creneaux pour connaître l'état réel de l'agenda et récupérer les id.
3. Pour modifier_creneau et supprimer_creneau, passe l'id exact renvoyé par lister_creneaux. Ne devine jamais un id.
4. Heures au format 24h HH:MM (ex : 09:00, 17:30). N'invente JAMAIS un horaire ou un jour : s'il manque une information, pose la question à Louis au lieu d'agir.
5. Un créneau qui passe minuit (ex : 22:00–02:00) doit être découpé en deux créneaux (22:00–23:59 le jour J, 00:00–02:00 le lendemain).
6. Quand Louis agit sur son agenda par la parole, agis directement avec les outils, sans demander de confirmation inutile.
7. Photo d'un planning de travail (ex : Shyfter) : lis-la attentivement, extrais TOUS les services (jour + heure de début + heure de fin), puis ajoute chacun avec ajouter_creneau. Vérifie via lister_creneaux qu'ils n'existent pas déjà pour ne rien dupliquer. Termine par un récapitulatif de tout ce que tu as ajouté.
8. Après chaque action, confirme en une phrase précise ce qui a changé (titre, heures, jours). Si un outil renvoie une erreur, corrige tes paramètres et réessaie.

Contexte : nous sommes ${contexteDuJour()}.
Réponds en français, de façon concise et percutante, sur un ton complice de mentor qui embarque son protégé vers la fortune.`;
}

// Outils que le Capitaine peut appeler pour agir sur l'agenda (format Anthropic).
const OUTILS_CAPITAINE: OutilIA[] = [
  {
    name: 'lister_creneaux',
    description:
      "Liste tous les créneaux de l'agenda hebdomadaire de Louis, avec leur id. À appeler avant toute modification/suppression (pour récupérer les id) et avant d'ajouter des créneaux issus d'une photo (pour éviter les doublons).",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'ajouter_creneau',
    description:
      "Ajoute un créneau récurrent dans l'agenda hebdomadaire de Louis. Si un créneau de même titre et mêmes horaires existe déjà, les jours sont fusionnés automatiquement (pas de doublon créé).",
    input_schema: {
      type: 'object',
      properties: {
        titre: { type: 'string', description: "Intitulé du créneau, ex : 'Prospection clients'." },
        heureDebut: { type: 'string', description: "Heure de début, format 24h HH:MM, ex '09:00'." },
        heureFin: { type: 'string', description: "Heure de fin, format 24h HH:MM, ex '10:30'. Doit être après l'heure de début." },
        jours: {
          type: 'array',
          description: 'Jours concernés, abrégés en 3 lettres.',
          items: { type: 'string', enum: JOURS_VALIDES },
        },
      },
      required: ['titre', 'heureDebut', 'heureFin', 'jours'],
    },
  },
  {
    name: 'modifier_creneau',
    description:
      "Modifie un créneau existant de l'agenda de Louis. Fournis son id exact (renvoyé par lister_creneaux). Ne renseigne que les champs à changer.",
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "Id exact du créneau, obtenu via lister_creneaux." },
        titre: { type: 'string', description: "À défaut d'id : titre actuel du créneau à modifier." },
        nouveauTitre: { type: 'string', description: 'Nouveau titre (optionnel).' },
        heureDebut: { type: 'string', description: 'Nouvelle heure de début HH:MM (optionnel).' },
        heureFin: { type: 'string', description: 'Nouvelle heure de fin HH:MM (optionnel).' },
        jours: {
          type: 'array',
          description: 'Nouveaux jours (optionnel), abrégés en 3 lettres. Remplace la liste actuelle.',
          items: { type: 'string', enum: JOURS_VALIDES },
        },
      },
      required: [],
    },
  },
  {
    name: 'supprimer_creneau',
    description:
      "Supprime un créneau de l'agenda de Louis. Fournis son id exact (renvoyé par lister_creneaux). Sans 'jour', supprime le créneau entier ; avec 'jour', retire seulement ce jour-là.",
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: "Id exact du créneau, obtenu via lister_creneaux." },
        titre: { type: 'string', description: "À défaut d'id : titre du créneau à supprimer." },
        jour: {
          type: 'string',
          description: 'Jour précis à retirer (optionnel), abrégé en 3 lettres.',
          enum: JOURS_VALIDES,
        },
      },
      required: [],
    },
  },
];

// Libellé humain affiché pendant qu'un outil s'exécute (petite vie dans l'UI).
const LIBELLE_OUTIL: Record<string, string> = {
  ajouter_creneau: '✍️ met à jour ton agenda…',
  modifier_creneau: '✍️ met à jour ton agenda…',
  supprimer_creneau: '🗑️ met à jour ton agenda…',
  lister_creneaux: '📅 consulte ton agenda…',
};

// Casse et accents normalisés : le modèle écrit souvent « seance » pour
// « Séance », ce qui ferait échouer une comparaison brute.
function normaliserTexte(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

// Accepte « 9h », « 9h30 », « 09:30 », « 9:5 »... et renvoie « HH:MM » — ou
// null si l'heure est invalide. Tolérant sur la forme, strict sur le fond.
function normaliserHeure(brut: unknown): string | null {
  const s = String(brut ?? '')
    .trim()
    .toLowerCase()
    .replace('h', ':')
    .replace(/:$/, '');
  const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mn = m[2] ? Number(m[2]) : 0;
  if (h > 23 || mn > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
}

// Ne garde que les jours valides parmi ceux fournis par le modèle.
function joursValides(brut: unknown): JourSemaine[] {
  return Array.isArray(brut)
    ? (brut
        .map((j) => String(j).trim().toLowerCase())
        .filter((j) => JOURS_VALIDES.includes(j as JourSemaine)) as JourSemaine[])
    : [];
}

function decrireBloc(b: BlocPlanning): string {
  return `« ${b.titre} » de ${b.heureDebut} à ${b.heureFin} le(s) ${b.jours.join(', ')}`;
}

export function GoingMerry({
  blocsPlanning,
  onAjouterBloc,
  onModifierBloc,
  onSupprimerBloc,
}: {
  blocsPlanning: BlocPlanning[];
  onAjouterBloc: (bloc: Omit<BlocPlanning, 'id'>) => string;
  onModifierBloc: (id: string, patch: Omit<BlocPlanning, 'id'>) => void;
  onSupprimerBloc: (id: string, jour: JourSemaine) => void;
}) {
  // Miroir toujours à jour de l'agenda pendant un tour d'outils : les mises à
  // jour React (setState) ne sont pas visibles immédiatement dans la prop
  // `blocsPlanning`, donc un lister_creneaux juste après un ajouter_creneau
  // lirait un état périmé. Chaque exécuteur met ce miroir à jour lui-même.
  const blocsRef = useRef(blocsPlanning);
  useEffect(() => {
    blocsRef.current = blocsPlanning;
  }, [blocsPlanning]);

  // Retrouve un créneau : par id exact d'abord, sinon par titre (exact puis partiel).
  function trouverBloc(args: Record<string, unknown>): BlocPlanning | undefined {
    const blocs = blocsRef.current;
    const id = String(args.id ?? '').trim();
    if (id) {
      const parId = blocs.find((b) => b.id === id);
      if (parId) return parId;
    }
    const cible = normaliserTexte(String(args.titre ?? ''));
    if (!cible) return undefined;
    return (
      blocs.find((b) => normaliserTexte(b.titre) === cible) ??
      blocs.find((b) => normaliserTexte(b.titre).includes(cible))
    );
  }

  // Exécute un outil réclamé par le Capitaine et renvoie un résultat texte.
  // Les messages d'erreur sont explicites : le modèle s'en sert pour corriger
  // ses paramètres et réessayer.
  async function executerOutilCapitaine(
    nom: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (nom === 'lister_creneaux') {
      const blocs = blocsRef.current;
      if (blocs.length === 0) return "L'agenda est vide pour l'instant.";
      return blocs
        .map((b) => `- id=${b.id} | ${b.titre} : ${b.heureDebut}–${b.heureFin} (${b.jours.join(', ')})`)
        .join('\n');
    }

    if (nom === 'ajouter_creneau') {
      const titre = String(args.titre ?? '').trim();
      const heureDebut = normaliserHeure(args.heureDebut);
      const heureFin = normaliserHeure(args.heureFin);
      const jours = joursValides(args.jours);

      if (!titre) return "Erreur : le titre est manquant.";
      if (!heureDebut || !heureFin) {
        return "Erreur : heure invalide. Utilise le format 24h HH:MM (ex : 09:00, 17:30).";
      }
      if (heureFin <= heureDebut) {
        return `Erreur : l'heure de fin (${heureFin}) doit être après l'heure de début (${heureDebut}). Si le créneau passe minuit, découpe-le en deux créneaux.`;
      }
      if (jours.length === 0) {
        return `Erreur : aucun jour valide. Jours acceptés : ${JOURS_VALIDES.join(', ')}.`;
      }

      // Anti-doublon : même titre + mêmes horaires → on fusionne les jours.
      const existant = blocsRef.current.find(
        (b) =>
          normaliserTexte(b.titre) === normaliserTexte(titre) &&
          b.heureDebut === heureDebut &&
          b.heureFin === heureFin,
      );
      if (existant) {
        const joursFusionnes = JOURS_VALIDES.filter(
          (j) => existant.jours.includes(j) || jours.includes(j),
        );
        if (joursFusionnes.length === existant.jours.length) {
          return `Déjà présent : ${decrireBloc(existant)}. Rien à faire.`;
        }
        const patch: Omit<BlocPlanning, 'id'> = {
          titre: existant.titre,
          heureDebut: existant.heureDebut,
          heureFin: existant.heureFin,
          jours: joursFusionnes,
          questWeight: existant.questWeight,
        };
        onModifierBloc(existant.id, patch);
        blocsRef.current = blocsRef.current.map((b) =>
          b.id === existant.id ? { ...patch, id: existant.id } : b,
        );
        return `Créneau existant complété (jours fusionnés) : ${decrireBloc({ ...patch, id: existant.id })}.`;
      }

      const bloc: Omit<BlocPlanning, 'id'> = { titre, heureDebut, heureFin, jours, questWeight: 0 };
      const id = onAjouterBloc(bloc);
      blocsRef.current = [...blocsRef.current, { ...bloc, id }];
      return `Créneau ajouté (id=${id}) : ${decrireBloc({ ...bloc, id })}.`;
    }

    if (nom === 'modifier_creneau') {
      const cible = trouverBloc(args);
      if (!cible) {
        return `Erreur : aucun créneau trouvé (id « ${String(args.id ?? '')} », titre « ${String(args.titre ?? '')} »). Appelle lister_creneaux pour obtenir les id exacts.`;
      }

      const heureDebut = args.heureDebut != null ? normaliserHeure(args.heureDebut) : cible.heureDebut;
      const heureFin = args.heureFin != null ? normaliserHeure(args.heureFin) : cible.heureFin;
      if (!heureDebut || !heureFin) {
        return "Erreur : heure invalide. Utilise le format 24h HH:MM (ex : 09:00, 17:30).";
      }
      if (heureFin <= heureDebut) {
        return `Erreur : l'heure de fin (${heureFin}) doit être après l'heure de début (${heureDebut}).`;
      }
      const joursDemandes = joursValides(args.jours);
      if (Array.isArray(args.jours) && joursDemandes.length === 0) {
        return `Erreur : aucun jour valide dans 'jours'. Jours acceptés : ${JOURS_VALIDES.join(', ')}.`;
      }

      const patch: Omit<BlocPlanning, 'id'> = {
        titre: args.nouveauTitre ? String(args.nouveauTitre).trim() : cible.titre,
        heureDebut,
        heureFin,
        jours: joursDemandes.length ? joursDemandes : cible.jours,
        questWeight: cible.questWeight,
      };

      onModifierBloc(cible.id, patch);
      blocsRef.current = blocsRef.current.map((b) =>
        b.id === cible.id ? { ...patch, id: cible.id } : b,
      );
      return `Créneau mis à jour : ${decrireBloc({ ...patch, id: cible.id })}.`;
    }

    if (nom === 'supprimer_creneau') {
      const cible = trouverBloc(args);
      if (!cible) {
        return `Erreur : aucun créneau trouvé (id « ${String(args.id ?? '')} », titre « ${String(args.titre ?? '')} »). Appelle lister_creneaux pour obtenir les id exacts.`;
      }

      const jour = String(args.jour ?? '').trim().toLowerCase();
      if (jour && JOURS_VALIDES.includes(jour as JourSemaine)) {
        if (!cible.jours.includes(jour as JourSemaine)) {
          return `Le créneau « ${cible.titre} » n'a pas de ${jour} (jours actuels : ${cible.jours.join(', ')}). Rien à faire.`;
        }
        onSupprimerBloc(cible.id, jour as JourSemaine);
        const joursRestants = cible.jours.filter((j) => j !== jour);
        blocsRef.current =
          joursRestants.length > 0
            ? blocsRef.current.map((b) =>
                b.id === cible.id ? { ...b, jours: joursRestants } : b,
              )
            : blocsRef.current.filter((b) => b.id !== cible.id);
        return joursRestants.length > 0
          ? `Le ${jour} a été retiré du créneau « ${cible.titre} » (reste : ${joursRestants.join(', ')}).`
          : `Créneau « ${cible.titre} » supprimé (c'était son dernier jour).`;
      }

      // Aucun jour précisé : on supprime le créneau entièrement (jour par jour).
      for (const j of [...cible.jours]) onSupprimerBloc(cible.id, j);
      blocsRef.current = blocsRef.current.filter((b) => b.id !== cible.id);
      return `Créneau « ${cible.titre} » supprimé de l'agenda.`;
    }

    return `Outil inconnu : ${nom}.`;
  }

  const [ecran, setEcran] = useState<'capitaine' | 'equipage'>('capitaine');
  const [membreActif, setMembreActif] = useState<MembreEquipage | null>(null);

  function retourCapitaine() {
    setMembreActif(null);
    setEcran('capitaine');
  }

  return (
    <section className={styles.page}>
      {ecran === 'capitaine' ? (
        // ---------- LE CAPITAINE : chat plein écran ----------
        <div className={styles.chatPleinePage}>
          <header className={styles.enteteChat}>
            <div className={styles.identiteCapitaine}>
              <span className={styles.avatar} aria-hidden="true">
                🧭
              </span>
              <div className={styles.identiteTxt}>
                <div className={styles.capNom}>Le Capitaine</div>
                <div className={styles.capRole}>Ton mentor — cap sur le Roi des Pirates</div>
              </div>
            </div>
            <button
              type="button"
              className={styles.lienEquipage}
              onClick={() => setEcran('equipage')}
            >
              ⚓ L'équipage
            </button>
          </header>

          <ChatIA
            plein
            cleChat="capitaine"
            systemPrompt={promptCapitaine()}
            nomInterlocuteur="Le Capitaine"
            messageVide="Parle au Capitaine, il est à la barre. Dis-lui ce que tu veux caler — ou colle une capture de ton planning, il remplit ton agenda."
            tools={OUTILS_CAPITAINE}
            executerOutil={executerOutilCapitaine}
          />
        </div>
      ) : (
        // ---------- L'ÉQUIPAGE : hub + discussions ----------
        <div className={styles.equipageEcran}>
          <div className={styles.equipageContenu}>
            <header className={styles.enteteChat}>
              <button type="button" className={styles.lienEquipage} onClick={retourCapitaine}>
                ← Le Capitaine
              </button>
              <div className={styles.capNom}>L'équipage</div>
              <span aria-hidden="true" />
            </header>

            {membreActif ? (
              <Discussion
                key={membreActif.id}
                membre={membreActif}
                onRetour={() => setMembreActif(null)}
              />
            ) : (
              <div className={styles.hub}>
                <header className={styles.enteteHub}>
                  <h1 className={styles.titre}>Choisis un membre</h1>
                  <p className={styles.sousTitre}>
                    Des spécialistes pour t'épauler, en plus du Capitaine.
                  </p>
                </header>

                <div className={styles.grilleMembres}>
                  {equipage.map((membre) => (
                    <button
                      key={membre.id}
                      type="button"
                      className={styles.carteMembre}
                      onClick={() => setMembreActif(membre)}
                    >
                      <span className={styles.membreIcone} aria-hidden="true">
                        {membre.icone}
                      </span>
                      <span className={styles.membreNom}>{membre.nom}</span>
                      <span className={styles.membreRole}>{membre.role}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// Réduit une image (data URL) pour l'envoi : max 1568 px de côté, JPEG
// compressé. Une capture d'écran brute pèse lourd et coûte cher en tokens ;
// redimensionnée, elle reste parfaitement lisible pour Claude. En cas de
// pépin (format exotique...), on renvoie l'image d'origine telle quelle.
function optimiserImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1568;
      const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * ratio));
      canvas.height = Math.max(1, Math.round(img.height * ratio));
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ---------- Chat IA réutilisable (Capitaine + membres d'équipage) ----------
// Gère la conversation, le streaming, la sauvegarde automatique (localStorage,
// via cleChat) et l'affichage des bulles. On lui passe juste le systemPrompt
// qui définit l'interlocuteur et le nom affiché.
function ChatIA({
  cleChat,
  systemPrompt,
  nomInterlocuteur,
  messageVide,
  tools,
  executerOutil,
  plein = false,
}: {
  // Clé de sauvegarde de la conversation (une par interlocuteur).
  cleChat: string;
  systemPrompt: string;
  nomInterlocuteur: string;
  messageVide: string;
  tools?: OutilIA[];
  executerOutil?: (nom: string, args: Record<string, unknown>) => Promise<string> | string;
  // `plein` : la zone messages occupe toute la hauteur dispo (chat plein écran).
  plein?: boolean;
}) {
  const { messages, setMessages, effacer } = useChatHistorique(cleChat);
  const [saisie, setSaisie] = useState('');
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Libellé de l'outil en cours d'exécution (ex : « met à jour ton agenda… »).
  const [actionOutil, setActionOutil] = useState<string | null>(null);
  // Images jointes au prochain message (data URLs).
  const [images, setImages] = useState<string[]>([]);
  const finRef = useRef<HTMLDivElement | null>(null);
  const fichierRef = useRef<HTMLInputElement | null>(null);

  // Lit une image, la réduit, et l'ajoute en data URL (aperçu + envoi).
  function lireImage(fichier: File) {
    if (!fichier.type.startsWith('image/')) return;
    const lecteur = new FileReader();
    lecteur.onload = async () => {
      const optimisee = await optimiserImage(lecteur.result as string);
      setImages((prev) => [...prev, optimisee]);
    };
    lecteur.readAsDataURL(fichier);
  }

  // Depuis le bouton 📎 (sélection de fichiers).
  function ajouterFichiers(liste: FileList | null) {
    if (!liste) return;
    Array.from(liste).forEach(lireImage);
  }

  // Depuis un copier-coller (Ctrl+V) : on récupère les images du presse-papiers.
  function surColler(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const fichiers = Array.from(e.clipboardData.items)
      .filter((it) => it.type.startsWith('image/'))
      .map((it) => it.getAsFile())
      .filter((f): f is File => f !== null);
    if (fichiers.length > 0) {
      e.preventDefault(); // on colle l'image, pas un texte parasite
      fichiers.forEach(lireImage);
    }
  }

  function nouvelleDiscussion() {
    if (chargement) return;
    effacer();
    setErreur(null);
  }

  async function envoyer() {
    const texte = saisie.trim();
    if ((!texte && images.length === 0) || chargement) return;

    // Un message peut être une image seule : on met alors une consigne par défaut.
    const contenu = texte || 'Analyse cette image et prends-la en compte.';
    const conversation: MessageChat[] = [
      ...messages,
      { role: 'user', content: contenu, images: images.length ? images : undefined },
    ];
    // On ajoute tout de suite une bulle IA vide qui se remplira au fil du flux.
    setMessages([...conversation, { role: 'assistant', content: '' }]);
    setSaisie('');
    setImages([]);
    setErreur(null);
    setActionOutil(null);
    setChargement(true);

    // On laisse le navigateur peindre le nouveau message avant de scroller.
    requestAnimationFrame(() => finRef.current?.scrollIntoView({ behavior: 'smooth' }));

    try {
      const texteFinal = await discuterAvecClaude(systemPrompt, conversation, {
        tools,
        executerOutil,
        onMorceau: (texteCumule) => {
          // À chaque morceau reçu, on remplace le contenu de la dernière bulle.
          setActionOutil(null); // du texte arrive → l'outil est terminé
          setMessages([...conversation, { role: 'assistant', content: texteCumule }]);
          finRef.current?.scrollIntoView({ behavior: 'smooth' });
        },
        onOutil: (nom) => {
          setActionOutil(LIBELLE_OUTIL[nom] ?? '⚙️ agit…');
          finRef.current?.scrollIntoView({ behavior: 'smooth' });
        },
      });
      // État final propre (le dernier onMorceau peut dater d'un tour d'outils).
      setMessages([...conversation, { role: 'assistant', content: texteFinal }]);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.');
      // On retire la bulle IA vide restée en place si le flux a échoué.
      setMessages(conversation);
    } finally {
      setChargement(false);
      setActionOutil(null);
      requestAnimationFrame(() => finRef.current?.scrollIntoView({ behavior: 'smooth' }));
    }
  }

  function surTouche(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Entrée = envoyer, Maj+Entrée = nouvelle ligne.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      envoyer();
    }
  }

  return (
    <>
      <div className={`${styles.messages} ${plein ? styles.messagesPlein : ''}`}>
        {messages.length === 0 && !chargement && (
          <p className={styles.messagesVide}>{messageVide}</p>
        )}

        {messages.length > 0 && (
          <button
            type="button"
            className={styles.effacerChat}
            onClick={nouvelleDiscussion}
            disabled={chargement}
            title="Effacer la conversation et repartir de zéro"
          >
            🧹 Nouvelle discussion
          </button>
        )}

        {messages.map((m, i) => {
          const estIA = m.role === 'assistant';
          const enCours = chargement && i === messages.length - 1 && estIA;
          return (
            <div
              key={i}
              className={`${styles.bulle} ${estIA ? styles.bulleIA : styles.bulleUser}`}
            >
              {m.images?.map((src, k) => (
                <img key={k} src={src} alt="pièce jointe" className={styles.imageMessage} />
              ))}
              {enCours && m.content === '' ? (
                <span className={styles.reflexion}>
                  <span className={styles.reflexionTexte}>
                    {actionOutil ?? `${nomInterlocuteur} réfléchit`}
                  </span>
                  <span className={styles.points} aria-hidden="true">
                    <span className={styles.point} />
                    <span className={styles.point} />
                    <span className={styles.point} />
                  </span>
                </span>
              ) : (
                m.content
              )}
              {enCours && m.content !== '' && <span className={styles.curseur} aria-hidden="true" />}
            </div>
          );
        })}

        {erreur && <p className={styles.erreur}>{erreur}</p>}

        <div ref={finRef} />
      </div>

      <div className={styles.saisieZone}>
        {images.length > 0 && (
          <div className={styles.miniatures}>
            {images.map((src, k) => (
              <div key={k} className={styles.miniature}>
                <img src={src} alt="" />
                <button
                  type="button"
                  className={styles.miniatureRetirer}
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== k))}
                  aria-label="Retirer l'image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.saisieBarre}>
          <input
            ref={fichierRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              ajouterFichiers(e.target.files);
              e.target.value = ''; // permet de re-choisir le même fichier ensuite
            }}
          />
          <button
            type="button"
            className={styles.joindre}
            onClick={() => fichierRef.current?.click()}
            disabled={chargement}
            aria-label="Joindre une image"
            title="Joindre une image"
          >
            📎
          </button>
          <textarea
            className={styles.saisieChamp}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={surTouche}
            onPaste={surColler}
            placeholder={`Écris à ${nomInterlocuteur}… (colle une image avec Ctrl+V)`}
            rows={2}
            disabled={chargement}
          />
          <button
            type="button"
            className={styles.envoyer}
            onClick={envoyer}
            disabled={chargement || (saisie.trim() === '' && images.length === 0)}
          >
            Envoyer
          </button>
        </div>
      </div>
    </>
  );
}

// ---------- Vue discussion : chat avec un membre d'équipage ----------
// Monté avec key={membre.id} : changer de membre remonte le composant. La
// conversation de chaque membre est sauvegardée sous sa propre clé.
function Discussion({
  membre,
  onRetour,
}: {
  membre: MembreEquipage;
  onRetour: () => void;
}) {
  return (
    <div className={styles.discussion}>
      <header className={styles.discussionEntete}>
        <button type="button" className={styles.retour} onClick={onRetour}>
          ← L'équipage
        </button>
        <span className={styles.discussionIcone} aria-hidden="true">
          {membre.icone}
        </span>
        <div className={styles.discussionIdentite}>
          <div className={styles.discussionNom}>{membre.nom}</div>
          <div className={styles.discussionRole}>{membre.role}</div>
        </div>
      </header>

      <ChatIA
        cleChat={`equipage-${membre.id}`}
        systemPrompt={membre.systemPrompt}
        nomInterlocuteur={membre.nom}
        messageVide={`Lance la discussion avec ${membre.nom}, il t'écoute.`}
      />
    </div>
  );
}
