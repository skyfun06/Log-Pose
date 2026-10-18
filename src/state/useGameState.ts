import { useCallback, useEffect, useMemo, useState } from 'react';
import { iles } from '../data/iles';
import { PROGRAMME_CONSEILLE, VERSION_PROGRAMME } from '../data/programme';
import type { BlocPlanning, JourSemaine, Mission, StatutMission } from '../types';

const STORAGE_KEY = 'log-pose-state';

const JOUR_INDEX: JourSemaine[] = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

function jourSemaineActuel(): JourSemaine {
  return JOUR_INDEX[new Date().getDay()];
}

function dateDuJour(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Avant de remplacer l'emploi du temps par le programme conseillé, l'ancien
// est mis de côté ici (on peut le restaurer à la main au besoin).
const CLE_SAUVEGARDE_PLANNING = 'log-pose-planning-avant-programme';

interface GameState {
  prime: number;
  currentIslandId: number;
  logPose: Record<number, number>;
  blocsPlanning: BlocPlanning[];
  statutsMissions: Record<string, StatutMission>;
  dateStatuts: string;
  // Version du programme conseillé déjà appliquée (voir data/programme.ts).
  versionProgramme?: number;
}

const defaultState: GameState = {
  prime: 0,
  currentIslandId: iles[0].id,
  logPose: {},
  blocsPlanning: PROGRAMME_CONSEILLE,
  statutsMissions: {},
  dateStatuts: dateDuJour(),
  versionProgramme: VERSION_PROGRAMME,
};

// Applique une fois le programme conseillé (nouvelle version) en sauvegardant
// l'ancien emploi du temps ; sinon garde celui de Louis tel quel.
function programmeAJour(parsed: Partial<GameState>): BlocPlanning[] {
  const actuel = parsed.blocsPlanning ?? PROGRAMME_CONSEILLE;
  if ((parsed.versionProgramme ?? 0) >= VERSION_PROGRAMME) return actuel;
  try {
    localStorage.setItem(CLE_SAUVEGARDE_PLANNING, JSON.stringify(actuel));
  } catch {
    /* sauvegarde impossible : on applique quand même le programme */
  }
  return PROGRAMME_CONSEILLE;
}

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<GameState>;
    return {
      prime: typeof parsed.prime === 'number' ? parsed.prime : defaultState.prime,
      currentIslandId:
        typeof parsed.currentIslandId === 'number'
          ? parsed.currentIslandId
          : defaultState.currentIslandId,
      logPose: parsed.logPose ?? defaultState.logPose,
      blocsPlanning: programmeAJour(parsed),
      statutsMissions: parsed.statutsMissions ?? defaultState.statutsMissions,
      dateStatuts: parsed.dateStatuts ?? defaultState.dateStatuts,
      versionProgramme: VERSION_PROGRAMME,
    };
  } catch {
    return defaultState;
  }
}

export function useGameState() {
  const [state, setState] = useState<GameState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const today = dateDuJour();
    if (state.dateStatuts !== today) {
      setState((prev) => ({ ...prev, statutsMissions: {}, dateStatuts: today }));
    }
  }, [state.dateStatuts]);

  const missions = useMemo<Mission[]>(() => {
    const jour = jourSemaineActuel();
    return state.blocsPlanning
      .filter((b) => b.jours.includes(jour))
      .slice()
      .sort((a, b) => a.heureDebut.localeCompare(b.heureDebut))
      .map((b) => ({
        id: b.id,
        texte: b.titre,
        questWeight: b.questWeight,
        statut: state.statutsMissions[b.id] ?? 'pending',
      }));
  }, [state.blocsPlanning, state.statutsMissions]);

  const ajouterGain = useCallback((montant: number) => {
    if (!Number.isFinite(montant) || montant <= 0) return;
    setState((prev) => ({ ...prev, prime: prev.prime + montant }));
  }, []);

  const validerMission = useCallback((id: string) => {
    setState((prev) => {
      if (prev.statutsMissions[id] === 'done') return prev;
      const bloc = prev.blocsPlanning.find((b) => b.id === id);
      if (!bloc) return prev;

      const statutsMissions = { ...prev.statutsMissions, [id]: 'done' as const };

      let logPose = prev.logPose;
      let currentIslandId = prev.currentIslandId;

      if (bloc.questWeight > 0) {
        const current = prev.logPose[prev.currentIslandId] ?? 0;
        const next = Math.min(100, current + bloc.questWeight);
        logPose = { ...prev.logPose, [prev.currentIslandId]: next };

        if (next >= 100) {
          const idx = iles.findIndex((i) => i.id === prev.currentIslandId);
          const nextIle = iles[idx + 1];
          if (nextIle) {
            currentIslandId = nextIle.id;
          }
        }
      }

      return { ...prev, statutsMissions, logPose, currentIslandId };
    });
  }, []);

  const echouerMission = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      statutsMissions: { ...prev.statutsMissions, [id]: 'failed' as const },
    }));
  }, []);

  // Renvoie l'id du créneau créé : indispensable pour que l'IA (GoingMerry)
  // puisse enchaîner plusieurs actions sur l'agenda dans un même tour sans
  // relire un état React pas encore rafraîchi.
  const ajouterBloc = useCallback((bloc: Omit<BlocPlanning, 'id'>): string => {
    const id = crypto.randomUUID();
    setState((prev) => ({
      ...prev,
      blocsPlanning: [...prev.blocsPlanning, { ...bloc, id }],
    }));
    return id;
  }, []);

  const modifierBloc = useCallback((id: string, patch: Omit<BlocPlanning, 'id'>) => {
    setState((prev) => ({
      ...prev,
      blocsPlanning: prev.blocsPlanning.map((b) =>
        b.id === id && !b.fixe ? { ...patch, id, fixe: b.fixe } : b,
      ),
    }));
  }, []);

  const supprimerBloc = useCallback((id: string, jour: JourSemaine) => {
    setState((prev) => {
      const bloc = prev.blocsPlanning.find((b) => b.id === id);
      if (!bloc || bloc.fixe) return prev;

      const joursRestants = bloc.jours.filter((j) => j !== jour);

      // Il reste d'autres jours : on retire seulement ce jour du créneau.
      if (joursRestants.length > 0) {
        return {
          ...prev,
          blocsPlanning: prev.blocsPlanning.map((b) =>
            b.id === id ? { ...b, jours: joursRestants } : b,
          ),
        };
      }

      // Plus aucun jour : on supprime le créneau entièrement.
      const statutsMissions = { ...prev.statutsMissions };
      delete statutsMissions[id];
      return {
        ...prev,
        blocsPlanning: prev.blocsPlanning.filter((b) => b.id !== id),
        statutsMissions,
      };
    });
  }, []);

  const bounty = state.prime * 1000;
  const currentIle = iles.find((i) => i.id === state.currentIslandId) ?? iles[0];
  const logPoseActuel = state.logPose[state.currentIslandId] ?? 0;

  return {
    prime: state.prime,
    bounty,
    currentIle,
    totalIles: iles.length,
    logPose: logPoseActuel,
    missions,
    blocsPlanning: state.blocsPlanning,
    ajouterGain,
    validerMission,
    echouerMission,
    ajouterBloc,
    modifierBloc,
    supprimerBloc,
  };
}
