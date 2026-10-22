// Récaps du matin et du soir.
// Le serveur relais garde l'historique et sait quel créneau est en cours ; ce
// hook lui fournit le planning et les habitudes (qui vivent dans le
// localStorage) et déclenche la préparation du récap dès qu'il manque.

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../config';
import { bilanDuJour, decalerIso, suiviSemaine } from '../data/bilanJournee';
import type {
  BlocPlanning,
  BlocRecap,
  CreneauRecap,
  Habitude,
  HabitudeDuJour,
  JourSemaine,
  MarquesHabitudes,
  Recap,
} from '../types';

// Tant que l'appli reste ouverte, on revérifie régulièrement : c'est ce qui
// fait apparaître le récap du soir (ou du matin) tout seul à l'heure dite.
const VERIFICATION_MS = 5 * 60 * 1000;

const JOUR_INDEX: JourSemaine[] = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

interface ReponseRecaps {
  recaps: Recap[];
  creneau: CreneauRecap;
  error?: string;
}

// Blocs du jour concerné par le récap : le jour même pour le matin, le
// lendemain pour le soir.
function planningDuCreneau(blocs: BlocPlanning[], creneau: CreneauRecap): BlocRecap[] {
  const [annee, mois, jour] = creneau.cle.split('-').map(Number);
  const date = new Date(annee, mois - 1, jour + (creneau.moment === 'soir' ? 1 : 0));
  const cible = JOUR_INDEX[date.getDay()];
  return blocs
    .filter((b) => b.jours.includes(cible))
    .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))
    .map((b) => ({ titre: b.titre, heureDebut: b.heureDebut, heureFin: b.heureFin }));
}

export interface SuiviHabitudes {
  habitudes: Habitude[];
  marques: MarquesHabitudes;
  joursMalades: string[];
}

// Le jour dont le récap fait le bilan : la veille le matin, le jour même le soir.
export function jourDuBilan(cle: string, moment: 'matin' | 'soir'): string {
  const jour = cle.slice(0, 10);
  return moment === 'matin' ? decalerIso(jour, -1) : jour;
}

// Bilan et objectifs de la semaine envoyés au second pour qu'il rédige.
function contexteDuCreneau(suivi: SuiviHabitudes, creneau: CreneauRecap) {
  const { habitudes, marques, joursMalades } = suivi;
  const bilan = bilanDuJour(habitudes, marques, joursMalades, jourDuBilan(creneau.cle, creneau.moment));
  const semaine = suiviSemaine(habitudes, marques, joursMalades, creneau.cle.slice(0, 10), creneau.moment === 'matin');
  return {
    bilan: { reussites: bilan.reussites, ratees: bilan.ratees, oubliees: bilan.oubliees },
    semaine: semaine.filter((h) => h.statut !== 'atteint'),
  };
}

async function appeler(init?: RequestInit): Promise<ReponseRecaps> {
  let reponse: Response;
  try {
    reponse = await fetch(`${API_URL}/api/recaps`, init);
  } catch {
    throw new Error(
      'Impossible de joindre le serveur relais. Lance-le dans un autre terminal avec « npm run server ».',
    );
  }
  const data = (await reponse.json().catch(() => ({}))) as ReponseRecaps;
  if (!reponse.ok) throw new Error(data.error ?? `Le serveur relais a répondu ${reponse.status}.`);
  return data;
}

const CLE_RECAP_VU = 'log-pose-recap-vu';

function lireRecapVu(): string | null {
  try {
    return localStorage.getItem(CLE_RECAP_VU);
  } catch {
    return null;
  }
}

// Vrai tant que le dernier récap n'a pas été ouvert (point « nouveau » sur
// l'onglet). Ouvrir la page Récap le marque comme lu.
export function useRecapNonLu(dernierRecap: string | null, pageRecapOuverte: boolean) {
  const [vu, setVu] = useState(lireRecapVu);

  useEffect(() => {
    if (!pageRecapOuverte || !dernierRecap || dernierRecap === vu) return;
    setVu(dernierRecap);
    try {
      localStorage.setItem(CLE_RECAP_VU, dernierRecap);
    } catch {
      /* stockage indisponible : le point reviendra au prochain chargement */
    }
  }, [pageRecapOuverte, dernierRecap, vu]);

  return dernierRecap !== null && dernierRecap !== vu && !pageRecapOuverte;
}

export function useRecaps(
  blocsPlanning: BlocPlanning[],
  habitudesDuJour: HabitudeDuJour[],
  suivi: SuiviHabitudes,
) {
  const [recaps, setRecaps] = useState<Recap[]>([]);
  const [creneau, setCreneau] = useState<CreneauRecap | null>(null);
  const [enPreparation, setEnPreparation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Données de l'appli lues au moment de l'envoi, sans relancer les effets.
  const donnees = useRef({ blocsPlanning, habitudesDuJour, suivi });
  useEffect(() => {
    donnees.current = { blocsPlanning, habitudesDuJour, suivi };
  });

  const occupe = useRef(false);

  const preparer = useCallback(async (pour: CreneauRecap, refaire: boolean) => {
    if (occupe.current) return;
    occupe.current = true;
    setEnPreparation(true);
    setErreur(null);
    try {
      const { blocsPlanning: blocs, habitudesDuJour: habitudes, suivi: suiviActuel } = donnees.current;
      const data = await appeler({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planning: planningDuCreneau(blocs, pour),
          habitudes: habitudes.map((h) => ({ nom: h.nom, etat: h.etat ?? null })),
          contexte: contexteDuCreneau(suiviActuel, pour),
          refaire,
        }),
      });
      setRecaps(data.recaps);
      setCreneau(data.creneau);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.');
    } finally {
      occupe.current = false;
      setEnPreparation(false);
    }
  }, []);

  const verifier = useCallback(async () => {
    try {
      const data = await appeler();
      setRecaps(data.recaps);
      setCreneau(data.creneau);
      setErreur(null);
      // Récap manquant → on le prépare. Récap incomplet (Ollama éteint, boîte
      // injoignable…) → on retente à chaque vérification jusqu'à ce qu'il passe.
      const actuel = data.recaps.find((r) => r.cle === data.creneau.cle);
      if (!actuel) {
        await preparer(data.creneau, false);
      } else if (actuel.erreurs.length > 0) {
        await preparer(data.creneau, true);
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inconnue.');
    }
  }, [preparer]);

  useEffect(() => {
    void verifier();
    const id = setInterval(() => void verifier(), VERIFICATION_MS);
    return () => clearInterval(id);
  }, [verifier]);

  const refaire = useCallback(() => {
    if (creneau) void preparer(creneau, true);
    else void verifier();
  }, [creneau, preparer, verifier]);

  return { recaps, creneau, enPreparation, erreur, onRefaire: refaire };
}
