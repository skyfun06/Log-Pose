// État des habitudes, persisté dans le localStorage.
// Deux morceaux : la liste des habitudes (nom + cadence + objectif) et les
// marques (ce qui est fait/raté, par habitude et par date). Séparé du reste du
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
}

const defaultState: HabitudesState = { habitudes: [], marques: {} };

function borner(n: unknown, min: number, max: number, defaut: number): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return defaut;
  return Math.min(max, Math.max(min, v));
}

function loadState(): HabitudesState {
  try {
    const brut = localStorage.getItem(STORAGE_KEY);
    if (!brut) return defaultState;
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
          }))
      : [];
    const marques =
      parsed.marques && typeof parsed.marques === 'object' ? parsed.marques : {};
    return { habitudes, marques };
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
          { id, nom: habitude.nom.trim(), cadence: habitude.cadence, objectifHebdo, icone: habitude.icone },
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
      return { habitudes: prev.habitudes.filter((h) => h.id !== id), marques };
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
  // Quotidiennes d'abord, puis hebdomadaires.
  const habitudesDuJour = useMemo<HabitudeDuJour[]>(() => {
    const today = new Date();
    const iso = isoDeDate(today);
    const [lundi, dimanche] = bornesSemaine(today);

    const items = state.habitudes.map((h): HabitudeDuJour => {
      const parDate = state.marques[h.id] ?? {};
      let faitsCetteSemaine = 0;
      for (const [d, e] of Object.entries(parDate)) {
        if (e === 'fait' && d >= lundi && d <= dimanche) faitsCetteSemaine++;
      }
      return {
        id: h.id,
        nom: h.nom,
        cadence: h.cadence,
        objectifHebdo: h.objectifHebdo,
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
  }, [state.habitudes, state.marques]);

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
    ajouterHabitude,
    modifierHabitude,
    supprimerHabitude,
    marquerJour,
    cocherAujourdhui,
  };
}
