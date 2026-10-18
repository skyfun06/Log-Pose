// État des habitudes, persisté dans le localStorage.
// Trois morceaux : la liste des habitudes (nom + cadence + objectif), les
// marques (ce qui est fait/raté, par habitude et par date) et les jours
// « malade », communs à toutes les habitudes : ces jours-là sont désactivés et
// ne comptent ni dans les taux, ni dans les séries, ni dans les objectifs.
// Séparé du reste du
// jeu (useGameState) pour rester simple et indépendant.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CadenceHabitude,
  EtatHabitude,
  Habitude,
  HabitudeDuJour,
  MarquesHabitudes,
} from '../types';

const STORAGE_KEY = 'log-pose-habitudes';

function isoDeDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Bornes (lundi, dimanche) de la semaine ISO contenant `d`, en dates ISO.
function bornesSemaine(d: Date): [string, string] {
  const jour = (d.getDay() + 6) % 7; // 0 = lundi
  const lundi = new Date(d.getFullYear(), d.getMonth(), d.getDate() - jour);
  const dimanche = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (6 - jour));
  return [isoDeDate(lundi), isoDeDate(dimanche)];
}

interface HabitudesState {
  habitudes: Habitude[];
  marques: MarquesHabitudes;
  joursMalades: string[]; // dates « YYYY-MM-DD »
  // Jours de JOURS_MALADES_INITIAUX déjà posés (pour ne jamais les reposer
  // si Louis les retire ensuite).
  maladiesPosees?: string[];
  // Ancien drapeau : vrai = les 5 premiers jours (11 au 15) ont été posés.
  maladieInitialePosee?: boolean;
}

const defaultState: HabitudesState = { habitudes: [], marques: {}, joursMalades: [] };

// Louis a été cloué au lit du 11 au 15 octobre 2026 : chacun de ces jours est
// posé « malade » une seule fois, à l'ouverture suivante (il peut ensuite le
// retirer d'un clic sur l'en-tête du jour). Ajouter une date ici la pose ;
// retirer une date déjà posée l'enlève aussi des jours malades (une fois).
const JOURS_MALADES_INITIAUX = [
  '2026-10-11',
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
  '2026-10-15',
];

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

// « !Drogues » (s'abstenir) se tient même malade : l'option est cochée d'office
// tant que Louis ne l'a pas réglée lui-même dans le formulaire.
function compteMemeMaladeParDefaut(nom: string): boolean {
  return /^!\s*drogues?$/i.test(nom.trim());
}

function borner(n: unknown, min: number, max: number, defaut: number): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return defaut;
  return Math.min(max, Math.max(min, v));
}

function loadState(): HabitudesState {
  try {
    const brut = localStorage.getItem(STORAGE_KEY);
    if (!brut) return { ...defaultState, maladiesPosees: JOURS_MALADES_INITIAUX };
    const parsed = JSON.parse(brut) as Partial<HabitudesState>;
    const habitudes = Array.isArray(parsed.habitudes)
      ? parsed.habitudes
          .filter((h): h is Habitude => typeof h?.id === 'string' && typeof h?.nom === 'string')
          .map((h): Habitude => ({
            id: h.id,
            nom: h.nom,
            cadence: h.cadence === 'hebdomadaire' ? 'hebdomadaire' : 'quotidienne',
            objectifHebdo: borner(h.objectifHebdo, 1, 7, h.cadence === 'hebdomadaire' ? 3 : 7),
            icone: typeof h.icone === 'string' ? h.icone : undefined,
            compteMemeMalade:
              typeof h.compteMemeMalade === 'boolean'
                ? h.compteMemeMalade
                : compteMemeMaladeParDefaut(h.nom),
          }))
      : [];
    const marques =
      parsed.marques && typeof parsed.marques === 'object' ? parsed.marques : {};
    const joursMalades = new Set(
      Array.isArray(parsed.joursMalades)
        ? parsed.joursMalades.filter((d): d is string => typeof d === 'string' && DATE_ISO.test(d))
        : [],
    );
    const dejaPoses = new Set(
      Array.isArray(parsed.maladiesPosees)
        ? parsed.maladiesPosees
        : parsed.maladieInitialePosee
          ? JOURS_MALADES_INITIAUX.slice(0, 5)
          : [],
    );
    JOURS_MALADES_INITIAUX.filter((d) => !dejaPoses.has(d)).forEach((d) => joursMalades.add(d));
    // Dates posées autrefois mais retirées depuis de la liste : on les enlève.
    [...dejaPoses].filter((d) => !JOURS_MALADES_INITIAUX.includes(d)).forEach((d) => joursMalades.delete(d));
    return {
      habitudes,
      marques,
      joursMalades: [...joursMalades].sort(),
      maladiesPosees: JOURS_MALADES_INITIAUX,
    };
  } catch {
    return defaultState;
  }
}

export function useHabitudes() {
  const [state, setState] = useState<HabitudesState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota : tant pis, l'écran reste à jour */
    }
  }, [state]);

  // Crée une habitude et renvoie son id (utile pour l'enchaînement côté IA).
  const ajouterHabitude = useCallback(
    (habitude: {
      nom: string;
      cadence: CadenceHabitude;
      objectifHebdo?: number;
      icone?: string;
      compteMemeMalade?: boolean;
    }): string => {
      const id = crypto.randomUUID();
      const objectifHebdo =
        habitude.cadence === 'quotidienne'
          ? 7
          : borner(habitude.objectifHebdo, 1, 7, 3);
      setState((prev) => ({
        ...prev,
        habitudes: [
          ...prev.habitudes,
          {
            id,
            nom: habitude.nom.trim(),
            cadence: habitude.cadence,
            objectifHebdo,
            icone: habitude.icone,
            compteMemeMalade: habitude.compteMemeMalade ?? compteMemeMaladeParDefaut(habitude.nom),
          },
        ],
      }));
      return id;
    },
    [],
  );

  const modifierHabitude = useCallback(
    (id: string, patch: Partial<Omit<Habitude, 'id'>>) => {
      setState((prev) => ({
        ...prev,
        habitudes: prev.habitudes.map((h) => {
          if (h.id !== id) return h;
          const fusion = { ...h, ...patch };
          if (fusion.cadence === 'quotidienne') fusion.objectifHebdo = 7;
          else fusion.objectifHebdo = borner(fusion.objectifHebdo, 1, 7, 3);
          if (patch.nom != null) fusion.nom = patch.nom.trim();
          return fusion;
        }),
      }));
    },
    [],
  );

  const supprimerHabitude = useCallback((id: string) => {
    setState((prev) => {
      const marques = { ...prev.marques };
      delete marques[id];
      return { ...prev, habitudes: prev.habitudes.filter((h) => h.id !== id), marques };
    });
  }, []);

  // Pose (ou retire) une marque sur un jour. `etat === null` efface la marque
  // (retour à l'état « prévu »/neutre).
  const marquerJour = useCallback(
    (id: string, dateISO: string, etat: EtatHabitude | null) => {
      setState((prev) => {
        const pourHabitude = { ...(prev.marques[id] ?? {}) };
        if (etat === null) delete pourHabitude[dateISO];
        else pourHabitude[dateISO] = etat;
        return { ...prev, marques: { ...prev.marques, [id]: pourHabitude } };
      });
    },
    [],
  );

  // Déclare un jour « malade » (ou le réactive s'il l'était déjà).
  const basculerJourMalade = useCallback((dateISO: string) => {
    setState((prev) => {
      const malade = prev.joursMalades.includes(dateISO);
      return {
        ...prev,
        joursMalades: malade
          ? prev.joursMalades.filter((d) => d !== dateISO)
          : [...prev.joursMalades, dateISO].sort(),
      };
    });
  }, []);

  const aujourdhuiMalade = state.joursMalades.includes(isoDeDate(new Date()));

  // Trie les habitudes : quotidiennes d'abord, puis hebdomadaires, en gardant
  // l'ordre de création à l'intérieur de chaque groupe.
  const habitudesTriees = useMemo(() => {
    const q = state.habitudes.filter((h) => h.cadence === 'quotidienne');
    const hebdo = state.habitudes.filter((h) => h.cadence === 'hebdomadaire');
    return { quotidiennes: q, hebdomadaires: hebdo };
  }, [state.habitudes]);

  // Habitudes à faire aujourd'hui, pour la carte « missions du jour » :
  // - quotidiennes : toujours ;
  // - hebdomadaires : tant que l'objectif de la semaine n'est pas atteint
  //   (ou si déjà marquées aujourd'hui, pour rester visibles jusqu'au soir).
  // Quotidiennes d'abord, puis hebdomadaires. Un jour « malade », seules les
  // habitudes qui comptent même malade restent à faire.
  const habitudesDuJour = useMemo<HabitudeDuJour[]>(() => {
    const today = new Date();
    const iso = isoDeDate(today);
    const [lundi, dimanche] = bornesSemaine(today);
    const malades = new Set(state.joursMalades);
    const aujourdhuiMalade = malades.has(iso);
    const maladesSemaine = state.joursMalades.filter((d) => d >= lundi && d <= dimanche).length;

    const concernees = aujourdhuiMalade
      ? state.habitudes.filter((h) => h.compteMemeMalade)
      : state.habitudes;

    const items = concernees.map((h): HabitudeDuJour => {
      const parDate = state.marques[h.id] ?? {};
      const ignoreMalade = h.compteMemeMalade === true;
      let faitsCetteSemaine = 0;
      for (const [d, e] of Object.entries(parDate)) {
        if (e === 'fait' && d >= lundi && d <= dimanche && (ignoreMalade || !malades.has(d))) {
          faitsCetteSemaine++;
        }
      }
      return {
        id: h.id,
        nom: h.nom,
        cadence: h.cadence,
        // Les jours malades de la semaine réduisent l'objectif d'autant.
        objectifHebdo: ignoreMalade ? h.objectifHebdo : Math.min(h.objectifHebdo, 7 - maladesSemaine),
        etat: parDate[iso],
        faitsCetteSemaine,
      };
    });

    const pertinentes = items.filter((h) =>
      h.cadence === 'quotidienne'
        ? true
        : h.etat !== undefined || h.faitsCetteSemaine < h.objectifHebdo,
    );

    return [
      ...pertinentes.filter((h) => h.cadence === 'quotidienne'),
      ...pertinentes.filter((h) => h.cadence === 'hebdomadaire'),
    ];
  }, [state.habitudes, state.marques, state.joursMalades]);

  // Coche une habitude pour aujourd'hui (raccourci pour la carte missions).
  const cocherAujourdhui = useCallback((id: string, etat: EtatHabitude | null) => {
    marquerJour(id, isoDeDate(new Date()), etat);
  }, [marquerJour]);

  return {
    habitudes: state.habitudes,
    habitudesQuotidiennes: habitudesTriees.quotidiennes,
    habitudesHebdomadaires: habitudesTriees.hebdomadaires,
    habitudesDuJour,
    marques: state.marques,
    joursMalades: state.joursMalades,
    aujourdhuiMalade,
    basculerJourMalade,
    ajouterHabitude,
    modifierHabitude,
    supprimerHabitude,
    marquerJour,
    cocherAujourdhui,
  };
}
